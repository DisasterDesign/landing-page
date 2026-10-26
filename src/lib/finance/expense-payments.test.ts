import assert from "node:assert/strict";
import test from "node:test";
import { recordExpensePayment } from "./expense-payments";
import type { Viewer } from "@/lib/auth/viewer";

const owner: Viewer = {userId:"elad",isOwner:true,role:"ADMIN",revenueSharePct:null};
const roy: Viewer = {...owner,userId:"roy",isOwner:false};
const now = new Date("2026-10-26T15:00:00Z");
const input = {paymentKey:"7b4a8622-6bf1-4e7c-9ad1-d2a88af942ab",amountIls:123.45,paidAt:"2026-10-25T12:00:00Z",reference:"invoice-10"};
function store(overrides: Record<string,unknown> = {}) {
  const expense = {id:"expense",financeBook:"PRIVATE",sharedBasisPoints:4000,clientId:"client",clientProductId:"product",frequency:"MONTHLY",...overrides};
  let payment: Record<string,unknown> | null = null;
  let expenseQuery: unknown;
  let writes=0;
  const db = {
    expense:{findFirst:async(query:unknown)=>{expenseQuery=query;return expense;}},
    financeExpensePayment:{findUnique:async({where}:{where:{paymentKey:string}})=>payment?.paymentKey===where.paymentKey?payment:null,create:async({data}:{data:Record<string,unknown>})=>{writes++;payment={id:"payment",...data};return payment;}},
  };
  return {db,expense,get payment(){return payment;},get writes(){return writes;},get expenseQuery(){return expenseQuery;}};
}
test("owner payment inherits immutable saved allocation, frequency and current payer; caller cannot override snapshots", async()=>{
  const state=store();
  await recordExpensePayment(owner,"expense",{...input,financeBook:"SHARED",sharedBasisPoints:10000},{db:state.db as never,now});
  assert.equal(state.payment?.financeBook,"PRIVATE");
  assert.equal(state.payment?.sharedBasisPoints,4000);
  assert.equal(state.payment?.frequency,"MONTHLY");
  assert.equal(state.payment?.paidById,"elad");
  assert.equal(state.payment?.clientProductId,"product");
  assert.equal(state.payment?.amountIlsMinor,12345);
  assert.equal(state.payment?.source,"MANUAL");
});
test("Roy can record only a fully shared saved line, and unassigned lines fail closed for everyone",async()=>{
  for(const [viewer,book,bps] of [[roy,"PRIVATE",null],[roy,"SHARED",4000],[owner,"UNASSIGNED",null]] as const){
    const state=store({financeBook:book,sharedBasisPoints:bps});
    await assert.rejects(recordExpensePayment(viewer,"expense",input,{db:state.db as never,now}),/not found|classified/i);
    assert.equal(state.writes,0);
  }
  const state=store({financeBook:"SHARED",sharedBasisPoints:null});
  await recordExpensePayment(roy,"expense",input,{db:state.db as never,now});
  assert.equal(state.payment?.paidById,"roy");
  assert.deepEqual(state.expenseQuery,{where:{AND:[{id:"expense"},{financeBook:{in:["PRIVATE","SHARED"]}},{financeBook:"SHARED",OR:[{sharedBasisPoints:null},{sharedBasisPoints:10000}]}]}});
});
test("an exact payment replay does not write twice, conflicting key reuse is rejected",async()=>{
  const state=store();
  const first=await recordExpensePayment(owner,"expense",input,{db:state.db as never,now});
  const replay=await recordExpensePayment(owner,"expense",input,{db:state.db as never,now});
  assert.equal(first.replay,false);
  assert.equal(replay.replay,true);
  assert.equal(state.writes,1);
  for(const patch of [{amountIls:999},{paidAt:"2026-10-24T12:00:00Z"},{reference:"different"}])await assert.rejects(recordExpensePayment(owner,"expense",{...input,...patch},{db:state.db as never,now}),/conflict/i);
  assert.equal(state.writes,1);
});
test("payment input requires whole cents, a UUID, positive ILS and a sensible payment date",async()=>{
  for(const patch of [{amountIls:0},{amountIls:-1},{amountIls:12.345},{amountIls:Infinity},{paymentKey:"not-uuid"},{paidAt:"2026-10-30T00:00:00Z"},{paidAt:"not-date"}]){
    const state=store();
    await assert.rejects(recordExpensePayment(owner,"expense",{...input,...patch},{db:state.db as never,now}),/invalid/i);
    assert.equal(state.writes,0);
  }
});
test("persisted admin is required even for an owner flag",async()=>{
  const state=store();
  await assert.rejects(recordExpensePayment({...owner,role:"MEMBER"},"expense",input,{db:state.db as never,now}),/Forbidden/);
  assert.equal(state.writes,0);
});
test("recorded payer follows the saved expense and Roy cannot override it",async()=>{
  const state=store({financeBook:"SHARED",sharedBasisPoints:10000,paidById:"elad"});
  await recordExpensePayment(roy,"expense",input,{db:state.db as never,now});
  assert.equal(state.payment?.paidById,"elad");
  await assert.rejects(recordExpensePayment(roy,"expense",{...input,paidById:"roy"},{db:state.db as never,now}),/Forbidden/);
  assert.equal(state.writes,1);
});
test("owner may specify a persisted admin payer and cannot assign an unknown payer",async()=>{
  const state=store();
  const db={...state.db,user:{findUnique:async({where}:{where:{id:string}})=>where.id==="roy"?{id:"roy",role:"ADMIN",isOwner:false}:null}};
  await recordExpensePayment(owner,"expense",{...input,paidById:"roy"},{db:db as never,now});
  assert.equal(state.payment?.paidById,"roy");
  await assert.rejects(recordExpensePayment(owner,"expense",{...input,paidById:"missing"},{db:db as never,now}),/Invalid payer/);
});
test("a concurrent unique-key replay resolves to the persisted payment without another insert",async()=>{
  const state=store();
  await recordExpensePayment(owner,"expense",input,{db:state.db as never,now});
  let reads=0;
  let attemptedWrites=0;
  const db={...state.db,financeExpensePayment:{findUnique:async()=>++reads===1?null:state.payment,create:async()=>{attemptedWrites++;throw {code:"P2002"};}}};
  const result=await recordExpensePayment(owner,"expense",input,{db:db as never,now});
  assert.equal(result.replay,true);
  assert.equal(attemptedWrites,1);
  assert.equal(state.writes,1);
});

test("UUID spelling does not create a second idempotency identity",async()=>{
  const state=store();
  await recordExpensePayment(owner,"expense",input,{db:state.db as never,now});
  const replay=await recordExpensePayment(owner,"expense",{...input,paymentKey:input.paymentKey.toUpperCase()},{db:state.db as never,now});
  assert.equal(replay.replay,true);
  assert.equal(state.writes,1);
});
