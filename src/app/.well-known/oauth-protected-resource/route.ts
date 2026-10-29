import { mcpConfig } from '@/lib/mcp/auth';
import { protectedResourceMetadata } from '@/lib/mcp/server';
export const dynamic='force-dynamic';
export async function GET(){
 try{
  const config=mcpConfig();
  return config?Response.json(protectedResourceMetadata(config.audience,config.issuer),{headers:{'Cache-Control':'no-store'}}):Response.json({error:'Service unavailable'},{status:503});
 }catch{return Response.json({error:'Service unavailable'},{status:503});}
}
