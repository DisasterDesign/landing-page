import test from 'node:test';
import assert from 'node:assert/strict';
import type { Prisma } from '@prisma/client';
import { updateAgreementDraftFields, type AgreementLifecycleStore } from '@/lib/leads/agreement-lifecycle';
const stamp = '2026-10-29T10:00:00.000Z';
function fixture(overrides: Record<string, unknown> = {}, owner = true, archived = false) {
 const row = {id:'synthetic',status:'DRAFT',signedAt:null,signatureData:null,updatedAt:new Date(stamp),businessName:'Old',businessNameCorrections:[],content:'<tr><th>שם עסק</th><td>Old</td></tr><p>terms unchanged</p>',monthlyPrice:99,customerName:'Contact',signToken:'synthetic-token',paymentId:'synthetic-payment',invoiceNumber:'synthetic-invoice', ...overrides};
 let writes = 0;
 const tx = {$queryRaw: async()=>[{archivedAt:archived ? stamp : null}],user:{findUnique:async()=>({isOwner:owner,role:'ADMIN'})},agreement:{findUnique:async()=>row,update:async({data}: {data:Record<string,unknown>})=>{writes++;return {...row,...data};}}};
 const store: AgreementLifecycleStore = {transaction:cb=>cb(tx as unknown as Prisma.TransactionClient)};
 return {row,store,writes:()=>writes};
}
function correct(store: AgreementLifecycleStore, expectedUpdatedAt=stamp) {return updateAgreementDraftFields({agreementId:'synthetic',actor:{userId:'synthetic-owner',role:'ADMIN'},data:{},correction:{businessName:'New',expectedUpdatedAt}}, {store});}
test('correction writes only name/document/history; identity, token, billing and contact stay unchanged',async()=>{
 const f=fixture();const result=await correct(f.store);
 assert.equal(result.businessName,'New');assert.match(result.content,/>New</);assert.match(result.content,/terms unchanged/);
 for(const key of ['id','signToken','monthlyPrice','customerName','paymentId','invoiceNumber'] as const) assert.equal(result[key],f.row[key]);
 const history=result.businessNameCorrections as Array<{before:string;after:string;userId:string;occurredAt:string}>;
 assert.equal(history.length,1);assert.deepEqual({...history[0],occurredAt:undefined},{before:'Old',after:'New',userId:'synthetic-owner',occurredAt:undefined});assert.ok(Date.parse(history[0].occurredAt));assert.equal(f.writes(),1);
 // The fake exposes no payment/notification/client methods: any such side effect fails.
});
for(const status of ['SIGNED','CANCELLED','ARCHIVED']) test(`reject ${status} under lock`,async()=>{const f=fixture({status});await assert.rejects(correct(f.store));assert.equal(f.writes(),0);});
for(const evidence of [{signedAt:new Date(stamp)},{signatureData:'signature'}]) test('signature evidence blocks correction even if status is stale',async()=>{const f=fixture(evidence);await assert.rejects(correct(f.store));assert.equal(f.writes(),0);});
test('persisted non-owner forbidden',async()=>{const f=fixture({},false);await assert.rejects(correct(f.store),/Owner required/);assert.equal(f.writes(),0);});
test('archived metadata blocks DRAFT',async()=>{const f=fixture({},true,true);await assert.rejects(correct(f.store),/archived/);assert.equal(f.writes(),0);});
test('changed since opening, including signature winning lock, never overwrites',async()=>{const f=fixture({updatedAt:new Date('2026-10-29T11:00:00Z'),status:'SIGNED',signatureData:'completed'});await assert.rejects(correct(f.store));assert.equal(f.writes(),0);assert.equal(f.row.signatureData,'completed');});
test('second stale correction cannot overwrite first',async()=>{const f=fixture({updatedAt:new Date('2026-10-29T11:00:00Z')});await assert.rejects(correct(f.store),/ההסכם השתנה/);assert.equal(f.writes(),0);});
test('ordinary editor cannot overwrite corrected document using a stale rendered snapshot',async()=>{
 const f=fixture({updatedAt:new Date('2026-10-29T11:00:00Z'),businessName:'Corrected'});
 await assert.rejects(updateAgreementDraftFields({agreementId:'synthetic',actor:{userId:'synthetic-owner',role:'ADMIN'},expectedUpdatedAt:stamp,data:{content:'Old HTML'}},{store:f.store}),/ההסכם השתנה/);
 assert.equal(f.writes(),0);
});
