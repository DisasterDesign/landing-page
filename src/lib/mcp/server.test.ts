import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { McpPrincipal } from './auth';

test('official MCP client initializes, lists scoped read tools and calls strict tools without cross-user session cache', async () => {
 const mod=await import('./server').catch(()=>null);assert.ok(mod,'MCP server must exist');
 let principal: McpPrincipal={viewer:{userId:'elad',isOwner:true,role:'ADMIN',revenueSharePct:null},scopes:['finance:read','clients:read','debtors:read']};
 let debtorReads=0;
 const calls: string[]=[];
 const handle=mod.createMcpHandler({resourceUrl:'https://app.example.invalid/api/mcp',issuer:'https://identity.example.invalid/',authenticate:async()=>principal,data:{
  financeSummary:async(v,p)=>{calls.push(v.userId);return {period:p,forecast:true};},
  financeReceipts:async()=>({rows:[],rowCoverage:{total:0}}),
  searchClients:async(v,p)=>({clients:[{name:v.isOwner?'owner-visible':'shared-only'}],limit:p.limit}),
  debtorsReport:async()=>{debtorReads++;return {hidden:[]};}
 }});
 const transport=new StreamableHTTPClientTransport(new URL('https://app.example.invalid/api/mcp'),{fetch:async(input,init)=>handle(new Request(input,init))});
 const client=new Client({name:'synthetic-test',version:'1'});
 try{
  await client.connect(transport);
  let listed=await client.listTools();assert.deepEqual(listed.tools.map(t=>t.name).sort(),['debtors_report','finance_receipts','finance_summary','search_clients']);
  assert.ok(listed.tools.every(t=>t.annotations?.readOnlyHint===true&&t.annotations?.openWorldHint===false));
  assert.equal((await client.callTool({name:'finance_summary',arguments:{from:'2026-10-01',to:'2026-11-01'}})).isError,undefined);
  assert.equal((await client.callTool({name:'finance_receipts',arguments:{from:'2026-09-30T21:00:00Z',to:'2026-10-31T22:00:00Z',timezone:'Asia/Jerusalem',asOf:'2026-10-30T00:00:00Z'}})).isError,undefined);
  assert.equal((await client.callTool({name:'finance_summary',arguments:{from:'2026-02-30',to:'2026-11-01'}})).isError,true);
  assert.equal((await client.callTool({name:'search_clients',arguments:{query:'x',userId:'elad',financeBook:'PRIVATE'}})).isError,true);
  principal={...principal,viewer:{...principal.viewer,userId:'roy',isOwner:false}};
  listed=await client.listTools();assert.equal(listed.tools.some(t=>t.name==='debtors_report'),false);
  assert.equal(listed.tools.some(t=>t.name==='finance_receipts'),false);
  assert.equal((await client.callTool({name:'finance_receipts',arguments:{}})).isError,true);
  const denied=await client.callTool({name:'debtors_report',arguments:{}});assert.equal(denied.isError,true);assert.equal(debtorReads,0);
  await client.callTool({name:'finance_summary',arguments:{}});assert.deepEqual(calls,['elad','roy']);
  assert.equal((await client.callTool({name:'search_clients',arguments:{query:' ',limit:1000}})).isError,true);
  assert.equal((await handle(new Request('https://app.example.invalid/api/mcp',{method:'POST',headers:{Origin:'https://evil.invalid'}}))).status,403);
 }finally{await client.close();}
});

test('rate limit reports retry timing without executing a tool',async()=>{
 const {createMcpHandler,McpRateLimitError}=await import('./server');
 const data={financeSummary:async()=>{throw Error('must not run');},financeReceipts:async()=>{throw Error('must not run');},searchClients:async()=>{throw Error('must not run');},debtorsReport:async()=>{throw Error('must not run');}};
 const handler=createMcpHandler({resourceUrl:'https://app.example.invalid/api/mcp',issuer:'https://id.example.invalid/',authenticate:async()=>{throw new McpRateLimitError();},data});
 const response=await handler(new Request('https://app.example.invalid/api/mcp',{method:'POST'}));assert.equal(response.status,429);assert.equal(response.headers.get('retry-after'),'60');
});
