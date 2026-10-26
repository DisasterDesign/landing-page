import { prisma } from '@/lib/prisma';
import { authenticateMcp, mcpConfig, verifyMcpToken } from '@/lib/mcp/auth';
import { createMcpHandler, McpRateLimitError } from '@/lib/mcp/server';
import { mcpData } from '@/lib/mcp/data';
import { rateLimit } from '@/lib/rate-limit';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=30;
export async function POST(request:Request){
 try{
  const config=mcpConfig();
  if(!config)return Response.json({error:'Service unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});
  return await createMcpHandler({resourceUrl:config.audience,issuer:config.issuer,allowedOrigins:(process.env.MCP_ALLOWED_ORIGINS??'').split(',').filter(Boolean),data:mcpData,authenticate:async req=>{
   const principal=await authenticateMcp(req,config,{
    verify:token=>verifyMcpToken(token,config),
    loadGrant:(issuer,subject,clientId)=>prisma.mcpAccessGrant.findUnique({where:{issuer_subject_clientId:{issuer,subject,clientId}},include:{user:{select:{id:true,isOwner:true,role:true,revenueSharePct:true,mustChangePassword:true}}}}),
   });
   if(!rateLimit(`mcp:${principal.viewer.userId}`,30).ok)throw new McpRateLimitError('Rate limited');
   return principal;
  }})(request);
 }catch{return Response.json({error:'Service unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
export const GET=POST;
export const DELETE=POST;
