import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import { McpAuthError, type McpPrincipal } from './auth';
import type { Viewer } from '@/lib/auth/viewer';
import { resolveCashPeriod } from '@/lib/finance/cash-period';

const periodFields={from:z.string().optional(),to:z.string().optional(),timezone:z.enum(['Asia/Jerusalem','UTC']).optional(),asOf:z.string().optional()};
const validPeriod=(p:z.infer<typeof periodSchemaBase>)=>{try{resolveCashPeriod(p);return true;}catch{return false;}};
const periodSchemaBase=z.object(periodFields).strict();
export const periodSchema=periodSchemaBase.refine(validPeriod,'Invalid cash period or cutoff');
const receiptSchema=z.object({...periodFields,limit:z.number().int().min(1).max(200).default(100),offset:z.number().int().min(0).max(Number.MAX_SAFE_INTEGER-200).default(0)}).strict().refine(validPeriod,'Invalid cash period or cutoff');
const searchSchema=z.object({query:z.string().trim().min(1).max(100),limit:z.number().int().min(1).max(20).default(10)}).strict();
const debtorSchema=z.object({limit:z.number().int().min(1).max(100).default(20)}).strict();
export type PeriodInput=z.infer<typeof periodSchema>;
export interface McpData {
 financeSummary(viewer:Viewer,input:PeriodInput):Promise<unknown>;
 financeReceipts(viewer:Viewer,input:z.infer<typeof receiptSchema>):Promise<unknown>;
 searchClients(viewer:Viewer,input:z.infer<typeof searchSchema>):Promise<unknown>;
 debtorsReport(viewer:Viewer,input:z.infer<typeof debtorSchema>):Promise<unknown>;
}
export interface McpHandlerOptions {resourceUrl:string;issuer:string;allowedOrigins?:string[];authenticate(request:Request):Promise<McpPrincipal>;data:McpData}
const annotations={readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false};
export class McpRateLimitError extends Error {}
const failure=()=>({isError:true,content:[{type:'text' as const,text:'Unable to read requested data.'}]});
export function protectedResourceMetadata(resourceUrl:string,issuer:string){
 return {resource:resourceUrl,authorization_servers:[issuer],scopes_supported:['finance:read','clients:read','debtors:read'],bearer_methods_supported:['header']};
}
export function createMcpHandler(options:McpHandlerOptions) {
 return async(request:Request):Promise<Response>=>{
  const headers={'Cache-Control':'no-store, private','X-Robots-Tag':'noindex, nofollow','Vary':'Authorization, Origin'};
  const respond=(body:unknown,status:number,extra:Record<string,string>={})=>Response.json(body,{status,headers:{...headers,...extra}});
  const origin=request.headers.get('origin');
  if(new URL(request.url).origin!==new URL(options.resourceUrl).origin || (origin && ![new URL(options.resourceUrl).origin,...(options.allowedOrigins??[])].includes(origin))) return respond({error:'Forbidden'},403);
  let principal:McpPrincipal;
  try{principal=await options.authenticate(request);}catch(error){
   const status=error instanceof McpAuthError?error.status:error instanceof McpRateLimitError?429:503;
   const metadata=new URL('/.well-known/oauth-protected-resource/api/mcp',options.resourceUrl).href;
   return respond({error:status===503?'Service unavailable':status===401?'Unauthorized':status===429?'Too many requests':'Forbidden'},status,status===429?{'Retry-After':'60'}:status===401?{'WWW-Authenticate':`Bearer resource_metadata="${metadata}"`}:{});
  }
  if(request.method!=='POST')return respond({error:'Method not allowed'},405,{Allow:'POST'});
  // Enforce the bound even with chunked requests; do not trust Content-Length.
  const reader=request.body?.getReader();const chunks:Uint8Array[]=[];let size=0;
  if(reader){try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>16384){await reader.cancel();return respond({error:'Request too large'},413);}chunks.push(value);}}catch{return respond({error:'Invalid request'},400);}}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const bounded=new Request(request.url,{method:'POST',headers:request.headers,body:bytes});
  const server=new McpServer({name:'fuzion-webz-readonly',version:'1.0.0'},{capabilities:{tools:{}}});
  const add=(name:string,scope:string,schema:z.ZodObject,description:string,run:(args:Record<string,unknown>)=>Promise<unknown>)=>{
   if(!principal.scopes.includes(scope))return;
   server.registerTool(name,{description,inputSchema:schema,annotations,_meta:{securitySchemes:[{type:'oauth2',scopes:[scope]}]}},async (args) =>{
    try{const value=await run(args);return {content:[{type:'text' as const,text:JSON.stringify(value)}]};}catch{return failure();}
   });
  };
  add('finance_summary','finance:read',periodSchema,'Read cash settlement and separately labeled forecast. Explicit [from,to) and cash cutoff; date-only boundaries default to Asia/Jerusalem, or request UTC. Missing evidence never final payable. No synchronization.',args=>options.data.financeSummary(principal.viewer,periodSchema.parse(args)));
  if(principal.viewer.isOwner)add('finance_receipts','finance:read',receiptSchema,'Owner-only actual shared receipt rows and canonical settlement, client totals and private exclusion totals. Bounded period, pagination, VAT/FX provenance, incomplete evidence and freshness. No synchronization.',args=>options.data.financeReceipts(principal.viewer,receiptSchema.parse(args)));
  add('search_clients','clients:read',searchSchema,'Search visible clients by name only; bounded results and necessary status, without identity or payment identifiers.',args=>options.data.searchClients(principal.viewer,searchSchema.parse(args)));
  if(principal.viewer.isOwner)add('debtors_report','debtors:read',debtorSchema,'Owner-only stored debtor report including hidden records, unknown historical amounts, freshness and scan-window limitations. Never refreshes Cardcom.',args=>options.data.debtorsReport(principal.viewer,debtorSchema.parse(args)));
  const transport=new WebStandardStreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
  try{
   await server.connect(transport);const response=await transport.handleRequest(bounded);
   for(const [key,value]of Object.entries(headers))response.headers.set(key,value);
   return response;
  }catch{return respond({error:'Invalid request'},400);}finally{await server.close();}
 };
}
