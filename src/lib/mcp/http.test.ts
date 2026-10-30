import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { generateKeyPair, SignJWT, jwtVerify } from 'jose';
import { createMcpHandler } from './server';
import { authenticateMcp } from './auth';

test('real loopback Streamable HTTP + signed OAuth-shaped tokens: initialize/list/call, expiry, revocation, both users, no stale session',async()=>{
 const {privateKey,publicKey}=await generateKeyPair('RS256');
 const now=Math.floor(Date.now()/1000);let businessReads=0;
 const user={id:'actual-user',role:'ADMIN' as const,isOwner:true,revenueSharePct:50,mustChangePassword:false};
 const grant={userId:user.id,issuer:'https://id.example.invalid/',subject:'subject',clientId:'test-client',scopes:['finance:read','clients:read','debtors:read'],notBefore:new Date((now-1)*1000),expiresAt:new Date((now+600)*1000),revokedAt:null as Date|null,user};
 let resourceUrl='';
 const http=createServer(async(req,res)=>{
  try{
   const chunks:Buffer[]=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));
   const headers=new Headers();for(const [k,v]of Object.entries(req.headers))if(v)headers.set(k,Array.isArray(v)?v.join(','):v);
   const request=new Request(resourceUrl,{method:req.method,headers,...(req.method==='POST'?{body:Buffer.concat(chunks)}:{})});
   const result=await handle(request);res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()));
  }catch{res.writeHead(500);res.end();}
 });
 const config={issuer:grant.issuer,audience:'synthetic',jwksUri:'https://id.example.invalid/keys'};
 const handle=(request:Request)=>createMcpHandler({resourceUrl,issuer:grant.issuer,authenticate:r=>authenticateMcp(r,config,{verify:token=>jwtVerify(token,publicKey,{issuer:grant.issuer,audience:config.audience,requiredClaims:['exp','iat','sub'],algorithms:['RS256']}),loadGrant:async()=>({...grant,user:{...user}})}),data:{financeReceipts:async()=>({rows:[]}),financeSummary:async(v)=>{businessReads++;return {visibility:v.isOwner?'owner':'shared'};},searchClients:async()=>{businessReads++;return {clients:[]};},debtorsReport:async()=>{businessReads++;return {hidden:[]};}}})(request);
 const sign=(expires=now+300)=>new SignJWT({scope:grant.scopes.join(' '),azp:grant.clientId,userId:'attacker',role:'OWNER'}).setProtectedHeader({alg:'RS256'}).setIssuer(grant.issuer).setSubject(grant.subject).setAudience(config.audience).setIssuedAt(now).setExpirationTime(expires).sign(privateKey);
 http.listen(0,'127.0.0.1');await once(http,'listening');const address=http.address();assert.ok(address&&typeof address==='object');resourceUrl=`http://127.0.0.1:${address.port}/api/mcp`;
 const token=await sign();
 const client=new Client({name:'real-http-test',version:'1'});
 const post=(credential?:string)=>fetch(resourceUrl,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream',...(credential?{Authorization:`Bearer ${credential}`}:{})},body:JSON.stringify({jsonrpc:'2.0',id:3,method:'tools/list'})});
 try{
  for(const credential of [undefined,'invalid',await sign(now-1)]){const response=await post(credential);assert.equal(response.status,401);assert.match(response.headers.get('www-authenticate')??'',/resource_metadata/);assert.equal(response.headers.get('cache-control'),'no-store, private');}
  assert.equal(businessReads,0);
  await client.connect(new StreamableHTTPClientTransport(new URL(resourceUrl),{requestInit:{headers:{Authorization:`Bearer ${token}`}}}));
  assert.equal((await client.listTools()).tools.length,4);
  const result=await client.callTool({name:'finance_summary',arguments:{}});assert.ok(JSON.stringify(result).includes('owner'));assert.equal(businessReads,1);
  user.isOwner=false;
  assert.equal((await client.listTools()).tools.length,2);
  assert.equal((await client.callTool({name:'debtors_report',arguments:{}})).isError,true);assert.equal(businessReads,1);
  assert.ok(JSON.stringify(await client.callTool({name:'finance_summary',arguments:{}})).includes('shared'));
  grant.scopes=['clients:read'];assert.deepEqual((await client.listTools()).tools.map(t=>t.name),['search_clients']);
  const deniedScope=await client.callTool({name:'finance_summary',arguments:{}});assert.equal(deniedScope.isError,true);assert.equal(businessReads,2);
  grant.revokedAt=new Date();assert.equal((await post(token)).status,401);
  grant.revokedAt=null;grant.expiresAt=new Date(0);assert.equal((await post(token)).status,401);
 }finally{await client.close();http.closeAllConnections();await new Promise<void>(resolve=>http.close(()=>resolve()));}
});
