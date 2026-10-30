import { prisma } from '@/lib/prisma';
import type { Viewer } from '@/lib/auth/viewer';
import { resolveCashPeriod, type CashPeriodInput } from './cash-period';
import { calculateCashSettlement } from './cash-settlement';
import { loadReceipts } from './receipts';
import { financeClientScope } from './access';

export class CashAccessError extends Error { readonly status=403 }
/** Application-owned reads only; no provider, synchronization, or write dependency. */
export async function buildCashSettlement(viewer:Viewer,input:CashPeriodInput={}) {
  if(viewer.role!=='ADMIN')throw new CashAccessError('Forbidden');
  const generatedAt=new Date();
  const period=resolveCashPeriod(input,generatedAt);
  const sharedCosts={OR:[{financeBook:'SHARED' as const},{financeBook:'PRIVATE' as const,sharedBasisPoints:{gt:0}}]};
  const [receipts,payments,expenseDefinitions,sync]=await Promise.all([
    loadReceipts(new Date(period.from),viewer.isOwner?undefined:'SHARED',new Date(period.cashToExclusive)),
    prisma.financeExpensePayment.findMany({where:{...sharedCosts,paidAt:{gte:new Date(period.from),lt:new Date(period.cashToExclusive)}},select:{id:true,expenseId:true,amountIlsMinor:true,paidAt:true,financeBook:true,sharedBasisPoints:true,paidById:true}}),
    prisma.expense.findMany({where:sharedCosts,select:{id:true,name:true,financeBook:true,sharedBasisPoints:true,active:true}}),
    prisma.financeSyncState.findUnique({where:{key:'cardcom:transactions'}}),
  ]);
  const [clients,payers]=await Promise.all([
    prisma.client.findMany({where:{AND:[{id:{in:[...new Set(receipts.filter(r=>r.financeBook==='SHARED').flatMap(r=>r.clientId?[r.clientId]:[]))]}},financeClientScope(viewer)]},select:{id:true,name:true,number:true}}),
    prisma.user.findMany({where:{OR:[{id:{in:[...new Set(payments.map(p=>p.paidById))]}},{isOwner:false,role:'ADMIN',revenueSharePct:50}]},select:{id:true,isOwner:true,role:true,revenueSharePct:true}}),
  ]);
  const names=new Map(expenseDefinitions.map(e=>[e.id,e]));
  const candidates=payers.filter(p=>!p.isOwner&&p.role==='ADMIN'&&p.revenueSharePct===50);
  const partnerId=candidates.length===1?candidates[0].id:null;
  const payerOwner=new Map(payers.map(p=>[p.id,p.isOwner]));
  const stale=!sync?.lastSuccessAt||generatedAt.getTime()-sync.lastSuccessAt.getTime()>36*3600000;
  const sourceComplete=sync?.status==='SUCCESS'&&!stale&&!!sync.coveredFrom&&!!sync.coveredTo&&sync.coveredFrom<=new Date(period.from)&&sync.coveredTo>=new Date(period.cashToExclusive);
  const settlement=calculateCashSettlement({period,isOwner:viewer.isOwner,receipts,clients,
    expenses:payments.map(p=>({id:p.id,name:names.get(p.expenseId)?.name??'תשלום הוצאה מתועד',grossIlsMinor:p.amountIlsMinor,
      // The persisted ledger has no deductible VAT evidence. Do not assume zero.
      deductibleVatIlsMinor:null,financeBook:p.financeBook,sharedBasisPoints:p.sharedBasisPoints,paidAt:p.paidAt.toISOString(),paidBy:payerOwner.get(p.paidById)===true?'OWNER':p.paidById===partnerId?'ROY':'UNKNOWN'})),
    // There is no confirmed advance/expense-completeness ledger in this schema.
    // Empty records are not evidence of a confirmed zero balance.
    advances:[],coverage:{sourceComplete,expensesConfirmed:false,advancesConfirmed:false},
  });
  return {...settlement,generatedAt:generatedAt.toISOString(),asOfBasis:'EVENT_TIME_CUTOFF_CURRENT_RECORDS' as const,
    source:{status:sync?.status??'NOT_SYNCED',lastSuccessAt:sync?.lastSuccessAt?.toISOString()??null,coveredFrom:sync?.coveredFrom?.toISOString()??null,coveredTo:sync?.coveredTo?.toISOString()??null,stale,complete:sourceComplete},
    expenseCoverage:'NOT_CONFIRMED' as const,advanceCoverage:'NOT_RECORDED' as const,expenseFxCoverage:'ORIGINAL_CURRENCY_NOT_RECORDED' as const,
    missingExpensePaymentCount:expenseDefinitions.filter(e=>e.active&&!payments.some(p=>p.expenseId===e.id)).length,
  };
}
export type CashSettlementReport=Awaited<ReturnType<typeof buildCashSettlement>>;
export async function readOwnerReceipts(viewer:Viewer,input:CashPeriodInput&{limit:number;offset:number}) {
  if(!viewer.isOwner||viewer.role!=='ADMIN')throw new CashAccessError('Forbidden');
  if(!Number.isInteger(input.limit)||input.limit<1||input.limit>200||!Number.isInteger(input.offset)||input.offset<0||!Number.isSafeInteger(input.offset))throw new Error('Invalid receipt page');
  const report=await buildCashSettlement(viewer,input);
  const rows=report.receiptRows??[];
  const receiptRows=rows.slice(input.offset,input.offset+input.limit);
  const next=input.offset+receiptRows.length;
  return {...report,receiptRows,rowCoverage:{total:rows.length,offset:input.offset,limit:input.limit,returned:receiptRows.length,truncated:next<rows.length,nextOffset:next<rows.length?next:null}};
}
