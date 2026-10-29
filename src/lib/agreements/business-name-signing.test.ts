import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { signAgreementSchema } from '@/lib/validations';
import { assertAgreementSnapshot } from './business-name';
import { LeadDomainError } from '@/lib/leads/errors';
const stamp='2026-10-29T10:00:00.000Z';
function signingRoute(existing: Record<string,unknown>, archivedAt: string | null = null) {
 const calls: string[]=[];
 const tx={$queryRaw:async()=>[{id:'synthetic',archivedAt}],agreement:{findUnique:async()=>existing}};
 const modules: Record<string,unknown>={
  'next/server':{NextResponse:{json:(data:unknown,init?:ResponseInit)=>Response.json(data,init)}},
  '@/lib/prisma':{prisma:{$transaction:async(cb:(t:unknown)=>unknown)=>cb(tx)}},
  '@/lib/validations':{signAgreementSchema},
  '@/lib/agreements/business-name':{assertAgreementSnapshot},
  '@/lib/leads/errors':{LeadDomainError},
  '@/lib/leads/http':{leadDomainErrorResponse:(e:Error)=>Response.json({error:e.message},{status:409})},
  '@/lib/agreement-templates':{renderAgreement:()=>{calls.push('render');throw Error('unexpected render');}},
  '@/lib/notifications':{notifyAllAdmins:async()=>{calls.push('notification');}},
  '@/lib/payments':{ensurePaymentUrlForAgreement:async()=>{calls.push('payment');return null;}},
  '@/lib/agreements/one-time':{}, '@/lib/leads/agreement-lifecycle':{},
 };
 const source=fs.readFileSync('src/app/api/agreements/sign/[token]/route.ts','utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const exports: {POST?: (request: unknown, context: unknown)=>Promise<Response>}={};
 new Function('require','exports',compiled)((id:string)=>{if(!(id in modules))throw Error(id);return modules[id];},exports);
 return {calls,post:(expectedUpdatedAt?:string)=>exports.POST!({headers:new Headers(),json:async()=>({customerName:'Synthetic Contact',businessName:'Old name',phone:'0500000000',email:'test@example.com',signatureData:'synthetic-signature',expectedUpdatedAt})},{params:Promise.resolve({token:'synthetic'})})};
}
for(const snapshot of [undefined,'2026-10-28T10:00:00.000Z']) test('old client cannot restore old name or trigger billing/notification',async()=>{
 const route=signingRoute({status:'DRAFT',updatedAt:new Date(stamp),businessName:'Corrected'});
 const response=await route.post(snapshot);assert.equal(response.status,409);assert.deepEqual(route.calls,[]);
});
test('already committed signature survives old client retry',async()=>{
 const route=signingRoute({id:'synthetic',status:'SIGNED',customerName:'Synthetic',tier:'BASIC',monthlyPrice:99});
 const response=await route.post();assert.equal(response.status,200);assert.deepEqual(route.calls,['payment']);
});
for(const archived of [false,true]) test('closed/archived agreement refuses signing without effects',async()=>{
 const route=signingRoute({status:archived?'DRAFT':'CANCELLED',updatedAt:new Date(stamp)},archived?stamp:null);
 const response=await route.post(stamp);assert.equal(response.status,410);assert.deepEqual(route.calls,[]);
});
