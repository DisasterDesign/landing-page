import assert from 'node:assert/strict';
import test from 'node:test';
import { loadRoute } from '../payments/route-harness';
import * as details from './debtor-report-details';
import * as dismissal from '../debtor-dismissal';
import type * as Report from './debtors-report';
const owner={userId:'synthetic-owner',isOwner:true,role:'ADMIN' as const,revenueSharePct:null};
function fixture(){
 const at=new Date('2026-10-20T00:00:00Z');
 const old={id:'old-order',clientId:'synthetic-client',customerName:'Synthetic Customer',businessName:'Synthetic Studio',monthlyPrice:100,vatExempt:false,cardcomAccountId:11,cardcomRecurringId:12,cardcomSyncedAt:at,client:{id:'synthetic-client',name:'Synthetic client',number:1,monthlyAmount:118,cardcomAccountIds:[11]}};
 const alternative={id:'active-order',clientId:null,cardcomIsActive:true,cardcomAccountId:11,cardcomRecurringId:13,cardcomSyncedAt:at};
 const reads:unknown[]=[];
 const db={agreementCharge:{findMany:async()=>[]},agreement:{findMany:async(args:{where:{cardcomIsActive:boolean}})=>{reads.push(args);return args.where.cardcomIsActive===false?[old]:[alternative];}},keyValue:{findUnique:async({where}:{where:{key:string}})=>where.key==='cardcom_debtors_snapshot'?{value:{},updatedAt:new Date('2026-10-27T12:00:00Z')}:{value:{}}}};
 const route=loadRoute<typeof Report>(new URL('./debtors-report.ts',import.meta.url),{'@/lib/prisma':{prisma:db},'@/lib/debtor-dismissal':dismissal,'./debtor-report-details':details});
 return {route,db,old,alternative,reads};
}
test('inactive stored order reports active same-account alternatives without claiming replacement or debt',async()=>{
 const f=fixture();const report=await f.route.loadDebtorsReport(owner,f.db as never);
 const row=report.inactiveOrders[0] as unknown as {alternatives:{status:string;count:number};priceBasis:string;expectedAgreementGross:number};
 assert.equal(row.alternatives?.status,'ACTIVE_ALTERNATIVE_RECORDED');assert.equal(row.alternatives.count,1);
 assert.equal(row.priceBasis,'AGREEMENT_NET');assert.equal(row.expectedAgreementGross,118);
});
test('terminal snapshot freshness does not update older agreement state freshness',async()=>{
 const f=fixture();const report=await f.route.loadDebtorsReport(owner,f.db as never);
 const fresh=(report as unknown as {freshness:{terminalSnapshotAt:Date;oldestOrderStateAt:Date}}).freshness;
 assert.equal(fresh?.terminalSnapshotAt.toISOString(),'2026-10-27T12:00:00.000Z');assert.equal(fresh.oldestOrderStateAt.toISOString(),'2026-10-20T00:00:00.000Z');
});
test('non-owner is denied before any order-state lookup',async()=>{
 const f=fixture();await assert.rejects(()=>f.route.loadDebtorsReport({...owner,isOwner:false},f.db as never));assert.equal(f.reads.length,0);
});

test('duplicate references to the same provider order are not counted as alternatives',async()=>{
 const f=fixture();f.alternative.cardcomRecurringId=f.old.cardcomRecurringId;
 const r=await f.route.loadDebtorsReport(owner,f.db as never);
 assert.equal((r.inactiveOrders[0] as unknown as {alternatives:{status:string}}).alternatives.status,'NOT_ESTABLISHED');
});
test('an unrelated active order is not presented as a recorded alternative',async()=>{
 const f=fixture();f.alternative.cardcomAccountId=99;
 const r=await f.route.loadDebtorsReport(owner,f.db as never);
 assert.equal((r.inactiveOrders[0] as unknown as {alternatives:{count:number}}).alternatives.count,0);
});

test('an active agreement without a recurring identifier does not prove a distinct alternative order',async()=>{
 const f=fixture();(f.alternative as {cardcomRecurringId:number|null}).cardcomRecurringId=null;
 const r=await f.route.loadDebtorsReport(owner,f.db as never);
 assert.equal(r.inactiveOrders[0].alternatives.status,'NOT_ESTABLISHED');assert.equal(r.inactiveOrders[0].alternatives.count,0);
});
test('agreement duplicates count as one provider alternative, not multiple standing orders',async()=>{
 const f=fixture();f.db.agreement.findMany=async(args:{where:{cardcomIsActive:boolean}})=>args.where.cardcomIsActive===false?[f.old]:[f.alternative,{...f.alternative,id:'duplicate-agreement'}];
 const r=await f.route.loadDebtorsReport(owner,f.db as never);
 assert.equal(r.inactiveOrders[0].alternatives.count,1);
});
