import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRoute } from '../payments/route-harness';
import * as period from './cash-period';
import * as cash from './cash-settlement';
import * as access from './access';
import type * as Adapter from './cash-data';
const at=new Date('2026-10-15T00:00:00Z');
const request={from:'2026-10-01',to:'2026-11-01',asOf:'2026-10-30T00:00:00Z'};
const owner={userId:'owner',isOwner:true,role:'ADMIN' as const,revenueSharePct:null};
function fixture(payer={id:'roy',isOwner:false,role:'ADMIN',revenueSharePct:50}){
 const calls:unknown[]=[];
 const rows=[{provider:'CARDCOM',terminalId:'synthetic',providerTransactionId:'shared',kind:'CHARGE',amountMinor:11800,ilsAmountMinor:11800,currency:'ILS',vatIlsMinor:1800,occurredAt:at,financeBook:'SHARED',clientId:'archived'},{provider:'CARDCOM',terminalId:'synthetic',providerTransactionId:'PRIVATE_SECRET',kind:'CHARGE',amountMinor:99999,ilsAmountMinor:99999,currency:'ILS',occurredAt:at,financeBook:'PRIVATE',clientId:'private'}];
 const db={
  client:{findMany:async(a:unknown)=>{calls.push(a);return [{id:'archived',name:'Archived shared client',number:1}];}},
  expense:{findMany:async(a:unknown)=>{calls.push(a);return [{id:'mixed',name:'PRIVATE_VENDOR_SECRET',financeBook:'PRIVATE',sharedBasisPoints:4000,active:true}];}},
  financeExpensePayment:{findMany:async(a:unknown)=>{calls.push(a);return [{id:'p',expenseId:'mixed',amountIlsMinor:10000,paidAt:at,financeBook:'PRIVATE',sharedBasisPoints:4000,paidById:'roy'}];}},
  financeSyncState:{findUnique:async()=>({status:'FAILED',lastSuccessAt:new Date('2026-10-26T15:00:00Z'),coveredFrom:new Date('2026-10-01T00:00:00Z'),coveredTo:new Date('2026-10-26T15:00:00Z')})},
  user:{findMany:async()=>[payer]},
 };
 const loader=async(from:Date,book?:string,to?:Date)=>{calls.push({from,book,to});return rows.filter(r=>!book||r.financeBook===book);};
 const adapter=loadRoute<typeof Adapter>(new URL('./cash-data.ts',import.meta.url),{'./access':access,'@/lib/prisma':{prisma:db},'./cash-period':period,'./cash-settlement':cash,'./receipts':{loadReceipts:loader}});
 return {adapter,calls};
}
test('read adapter uses exact period cutoff and immutable receipt names including archived clients, with no provider or mutation dependencies',async()=>{
 const f=fixture();const s=await f.adapter.buildCashSettlement(owner,request);
 assert.equal(s.period.from,'2026-09-30T21:00:00.000Z');assert.equal(s.clients[0].name,'Archived shared client');assert.equal(s.totals.grossIlsMinor,11800);assert.equal(s.expenses[0].grossIlsMinor,4000);assert.equal(s.expenses[0].netIlsMinor,null);assert.equal(s.status,'PROVISIONAL');assert.equal(s.roy.finalPayableIlsMinor,null);
 assert.ok(f.calls.some(a=>JSON.stringify(a).includes('2026-10-30T00:00:00.001Z')));
 assert.equal(s.source.stale,true);assert.equal(s.expenseCoverage,'NOT_CONFIRMED');assert.equal(s.advanceCoverage,'NOT_RECORDED');
 const partner=await f.adapter.buildCashSettlement({...owner,isOwner:false},request);assert.equal(JSON.stringify(partner).includes('PRIVATE_'),false);assert.equal('privateExcluded' in partner,false);assert.equal('receiptRows' in partner,false);
 assert.equal(partner.totals.grossIlsMinor,s.totals.grossIlsMinor);assert.equal(partner.roy.shareBeforeVatIlsMinor,s.roy.shareBeforeVatIlsMinor);
});
test('owner-only receipt reader denies before any I/O and reports full pagination coverage',async()=>{
 const f=fixture();await assert.rejects(()=>f.adapter.readOwnerReceipts({...owner,isOwner:false},{...request,limit:1,offset:0}),/Forbidden/);assert.equal(f.calls.length,0);
 const s=await f.adapter.readOwnerReceipts(owner,{...request,limit:1,offset:0});assert.equal(s.rowCoverage.total,1);assert.equal(s.rowCoverage.truncated,false);assert.equal(s.receiptRows?.length,1);
 const end=await f.adapter.readOwnerReceipts(owner,{...request,limit:200,offset:10200});assert.equal(end.receiptRows?.length,0);assert.equal(end.rowCoverage.nextOffset,null);
});
test('a member or seller payer is unknown and cannot become Roy reimbursement',async()=>{
 const f=fixture({id:'roy',isOwner:false,role:'MEMBER',revenueSharePct:0});const s=await f.adapter.buildCashSettlement(owner,request);assert.equal(s.expenses[0].paidBy,'UNKNOWN');assert.equal(s.roy.reimbursementIlsMinor,0);assert.ok(s.blockers.includes('EXPENSE_PAYER_UNKNOWN'));
});
