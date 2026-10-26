import { prisma } from '@/lib/prisma';
import type { Viewer } from '@/lib/auth/viewer';
import { buildFinanceReport } from '@/lib/finance/report-data';
import { financeClientScope, financeAgreementScope, financeProductScope } from '@/lib/finance/access';
import { loadDebtorsReport } from '@/lib/finance/debtors-report';
import { hasDebtorSnapshot } from '@/lib/debtor-dismissal';
import type { McpData, PeriodInput } from './server';

export async function financeSummary(viewer:Viewer,input:PeriodInput){
 const asOf=new Date();
 const from=input.from?new Date(input.from):new Date(Date.UTC(asOf.getUTCFullYear(),asOf.getUTCMonth(),1));
 const to=input.to?new Date(input.to):new Date(asOf.getTime()+1);
 const report=await buildFinanceReport(viewer,viewer.isOwner?'combined':'fuzion',{from,to});
 return {
  currency:'ILS',asOf:report.snapshotAt,period:{from:from.toISOString(),toExclusive:to.toISOString(),cashAsOf:report.snapshotAt,timezone:'UTC'},
  recurringMonthly:{basis:'CURRENT_PRODUCT_RUN_RATE',gross:report.bottomLine.totalMrr,vat:report.bottomLine.totalVat,netBeforeFees:report.bottomLine.totalMrr-report.bottomLine.totalVat,estimatedFee:report.bottomLine.totalCardcomFee,feesEstimated:true,books:report.books,unvaluedCount:report.forecastUnvaluedCount},
  collectedCash:{...report.actual,allocationAfterRecordedExpenses:report.actualAllocation},
  forecast:{basis:'CURRENT_RUN_RATE_AFTER_MONTHLY_EXPENSES',myShare:report.myProfit,sharedExpenses:report.settlement.sharedExpenses,...(viewer.isOwner?{privateProfit:report.personalProfit,privateExpenses:report.settlement.personalExpenses}:{}),sharedProfit:report.settlement.profit,partnerShare:report.settlement.royEntitlement},
  freshness:{status:report.sync.status,lastSuccessAt:report.sync.lastSuccessAt,stale:report.sync.stale},
  ...(viewer.isOwner?{unclassified:{receiptRowsObserved:report.unassignedTransactions?.length??0,receiptSourceLimit:100,receiptMayBeTruncated:(report.unassignedTransactions?.length??0)===100,activeExpenseCount:report.unassignedExpenseCount}}:{}),
  limitations:['Forecast is not collected cash. Product run-rate does not guarantee active collection.','Cash includes recorded receipts/refunds only; estimated fees and missing expense/FX coverage are reported.','Current subscriptions and costs are not reconstructed historically.'],
 };
}
export async function searchClients(viewer:Viewer,input:{query:string;limit:number}){
 const rows=await prisma.client.findMany({
  where:{AND:[financeClientScope(viewer),{name:{contains:input.query,mode:'insensitive'}}]},
  orderBy:[{name:'asc'},{id:'asc'}],take:input.limit+1,
  select:{name:true,archivedAt:true,products:{where:financeProductScope(viewer),take:11,orderBy:{id:'asc'},select:{name:true,status:true,monthlyAmount:true,financeBook:true,archivedAt:true}},agreements:{where:financeAgreementScope(viewer),take:11,orderBy:{id:'asc'},select:{kind:true,paymentStatus:true,cardcomIsActive:true,financeBook:true}}},
 });
 return {asOf:new Date().toISOString(),limit:input.limit,truncated:rows.length>input.limit,clients:rows.slice(0,input.limit).map(c=>({name:c.name,archived:!!c.archivedAt,products:c.products.slice(0,10).map(p=>({name:p.name,status:p.status,monthlyGross:p.monthlyAmount,book:p.financeBook,archived:!!p.archivedAt})),agreements:c.agreements.slice(0,10).map(a=>({kind:a.kind,paymentStatus:a.paymentStatus,recurringActive:a.cardcomIsActive,book:a.financeBook})),detailsTruncated:c.products.length>10||c.agreements.length>10}))};
}
function debtorDisplayName(d:{name:string;idNumber?:string|null}){
 // The upstream sweep falls back to identity/transaction keys when a name is absent.
 return !d.name||d.name===d.idNumber||/^tx-\d+$/.test(d.name)||/^\d{5,}$/.test(d.name)?'Unnamed debtor':d.name;
}
export async function debtorsReport(viewer:Viewer,input:{limit:number}){
 // Check BEFORE any query/count. Terminal-wide data has no safe partner scope.
 if(!viewer.isOwner)throw new Error('Forbidden');
 const report=await loadDebtorsReport(viewer);
 const snapshotAt=report.snapshotUpdatedAt;
 const stale=!snapshotAt||Date.now()-snapshotAt.getTime()>36*3600000;
 const snapshot=(rows:typeof report.dismissedDebtors)=>({
  count:rows.length,knownOpenAmount:rows.reduce((sum,d)=>sum+(hasDebtorSnapshot(d)&&!d.settledAt?d.amount:0),0),unknownAmountCount:rows.filter(d=>!hasDebtorSnapshot(d)).length,truncated:rows.length>input.limit,
  rows:rows.slice(0,input.limit).map(d=>hasDebtorSnapshot(d)?{name:debtorDisplayName(d),amount:d.amount,lastAttempt:d.lastAttempt,settledAt:d.settledAt??null,settledAmount:d.settledAmount??null,snapshotMissing:false,outsideScanWindow:!snapshotAt||!Number.isFinite(Date.parse(d.lastAttempt))||Date.parse(d.lastAttempt)<snapshotAt.getTime()-45*86400000,stale:stale||!snapshotAt||!Number.isFinite(Date.parse(d.lastAttempt))||Date.parse(d.lastAttempt)<snapshotAt.getTime()-45*86400000}:{name:debtorDisplayName(d),amount:null,snapshotMissing:true,outsideScanWindow:true,stale:true}),
 });
 return {asOf:new Date().toISOString(),currency:'ILS',snapshotUpdatedAt:snapshotAt,stale,scanWindowDays:45,coverage:'Stored Cardcom snapshot only; debt outside the scan window is unknown. Hidden does not mean paid.',visible:snapshot(report.terminalDebtors),hidden:snapshot(report.dismissedDebtors),settled:snapshot(report.settledDebtors),
  problemCharges:{returnedBySource:report.problemCharges.length,sourceLimit:100,sourceMayBeTruncated:report.problemCharges.length===100,truncated:report.problemCharges.length>input.limit,rows:report.problemCharges.slice(0,input.limit).map(c=>({name:c.agreement.client?.name??c.agreement.businessName??c.agreement.customerName,amount:c.amount,status:c.status,chargedAt:c.cardcomChargeDate??c.chargedAt}))},
  inactiveOrders:{count:report.inactiveOrders.length,truncated:report.inactiveOrders.length>input.limit,rows:report.inactiveOrders.slice(0,input.limit).map(a=>({name:a.client?.name??a.businessName??a.customerName,monthlyPrice:a.monthlyPrice,syncedAt:a.cardcomSyncedAt}))},
  totalsCaveat:'Bucket totals are separate and may overlap agreement problem charges; never sum the categories.'};
}
export const mcpData:McpData={financeSummary,searchClients,debtorsReport};
