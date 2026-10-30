import { deduplicateReceipts, type Receipt } from './transactions';
import type { CashPeriod } from './cash-period';

function integer(n:number) { if(!Number.isSafeInteger(n))throw new Error('Invalid monetary integer or overflow');return n; }
function add(...values:number[]) {return values.reduce((sum,n)=>integer(sum+integer(n)),0);}
function ratio(n:number,numerator:number,denominator:number) {
  integer(n);const a=BigInt(n);const abs=a<BigInt(0)?-a:a;
  const result=(abs*BigInt(numerator)+BigInt(Math.trunc(denominator/2)))/BigInt(denominator);
  return integer(Number(a<BigInt(0)?-result:result));
}
function distinctEvidence<T>(rows:T[],key:(r:T)=>string,fingerprint:(r:T)=>string):T[] {
  const seen=new Map<string,string>();return rows.filter(r=>{const id=key(r),value=fingerprint(r);if(!id.trim())throw new Error('Missing evidence identity');if(seen.has(id)){if(seen.get(id)!==value)throw new Error('Conflicting monetary evidence');return false;}seen.set(id,value);return true;});
}
function receiptAmounts(r:Receipt&{feeIlsMinor?:number|null}) {
  integer(r.amountMinor);if(!['CHARGE','REFUND'].includes(r.kind)||(r.kind==='REFUND'&&r.amountMinor>0)||(r.kind==='CHARGE'&&r.amountMinor<0))throw new Error('Invalid receipt sign');
  const gross=r.ilsAmountMinor;if(gross!=null){integer(gross);if(gross!==0&&Math.sign(gross)!==Math.sign(r.amountMinor))throw new Error('Invalid ILS sign');}
  if(r.vatIlsMinor!=null){integer(r.vatIlsMinor);if(gross!=null&&(Math.abs(r.vatIlsMinor)>Math.abs(gross)||(r.vatIlsMinor!==0&&Math.sign(r.vatIlsMinor)!==Math.sign(gross))))throw new Error('Invalid source VAT');}
  if(r.feeIlsMinor!=null)integer(r.feeIlsMinor);
  const vatBasis=gross==null?'UNKNOWN' as const:r.vatIlsMinor!=null?'SOURCE' as const:r.vatExempt?'EXEMPT' as const:'CALCULATED' as const;
  const vat=gross==null?null:r.vatIlsMinor??(r.vatExempt?0:ratio(gross,18,118));
  const fee=gross==null?null:r.feeApplies===false?0:r.feeIlsMinor??ratio(gross,2,100);
  return {gross,vat,fee,vatBasis,feeEstimated:r.feeApplies!==false&&r.feeIlsMinor==null,net:gross==null||vat==null||fee==null?null:add(gross,-vat,-fee)};
}
export interface CashExpense {
  id:string; name:string; grossIlsMinor:number; deductibleVatIlsMinor:number|null;
  financeBook:string; sharedBasisPoints?:number|null; paidBy:'OWNER'|'ROY'|'UNKNOWN'; paidAt:string;
}
export interface CashAdvance { reference:string; amountIlsMinor:number; paidAt:string; confirmed:boolean; periodFrom:string; periodToExclusive:string }
export interface CashInput {
  period:CashPeriod; isOwner:boolean; receipts:(Receipt & {feeIlsMinor?:number|null})[];
  clients:{id:string;name:string;number?:number|null}[]; expenses:CashExpense[]; advances:CashAdvance[];
  coverage:{sourceComplete:boolean;expensesConfirmed:boolean;advancesConfirmed:boolean};
}
type ReceiptLine = {
  reference:string; clientId:string|null; clientName:string; clientNumber:number|null; occurredAt:string; kind:string;
  originalAmountMinor:number; currency:string; grossIlsMinor:number|null; sourceVatIlsMinor:number|null;
  vatIlsMinor:number|null; vatBasis:'SOURCE'|'CALCULATED'|'EXEMPT'|'UNKNOWN';
  feeIlsMinor:number|null; feeEstimated:boolean; netIlsMinor:number|null; fxBasis:'ORIGINAL_ILS'|'RECORDED_ILS'|'MISSING';
};
function inPeriod(at:string|Date,p:CashPeriod) {const time=new Date(at).getTime();if(!Number.isFinite(time))throw new Error('Invalid evidence date');return time>=Date.parse(p.from)&&time<Date.parse(p.cashToExclusive);}
function allocation(book:string,bps:number|null|undefined) {
  const value=bps??(book==='SHARED'?10000:0);
  if(!Number.isInteger(value)||value<0||value>10000)throw new Error('Invalid shared allocation');
  return book==='UNASSIGNED'?0:value;
}
/** All arithmetic is signed integer agorot. No product budget or assumed FX enters here. */
export function calculateCashSettlement(input:CashInput) {
  const {period}=input;
  const blockers=new Set<string>();
  if(!period.closed)blockers.add('PERIOD_OPEN');
  if(!input.coverage.sourceComplete)blockers.add('SOURCE_INCOMPLETE');
  if(!input.coverage.expensesConfirmed)blockers.add('EXPENSE_COVERAGE_UNKNOWN');
  if(!input.coverage.advancesConfirmed)blockers.add('ADVANCE_COVERAGE_UNKNOWN');
  const all=deduplicateReceipts(input.receipts).filter(r=>inPeriod(r.occurredAt,period)).sort((a,b)=>{
    const delta=a.occurredAt.getTime()-b.occurredAt.getTime();if(delta)return delta;
    const x=JSON.stringify([a.provider,a.terminalId,a.providerTransactionId,a.kind]),y=JSON.stringify([b.provider,b.terminalId,b.providerTransactionId,b.kind]);return x<y?-1:x>y?1:0;
  });
  const clients=new Map(input.clients.map(c=>[c.id,c]));
  if(all.some(r=>r.financeBook==='UNASSIGNED'))blockers.add('RECEIPT_CLASSIFICATION_UNKNOWN');
  const receiptRows:ReceiptLine[]=all.filter(r=>r.financeBook==='SHARED').map(r=>{
    const {gross,vat,fee,vatBasis,feeEstimated}=receiptAmounts(r);
    if(gross==null)blockers.add('RECEIPT_FX_MISSING');
    if(vatBasis==='CALCULATED')blockers.add('VAT_CALCULATED');
    if(feeEstimated)blockers.add('FEES_ESTIMATED');
    const client=r.clientId?clients.get(r.clientId):undefined;
    if(!client)blockers.add('RECEIPT_CLIENT_UNLINKED');
    return {reference:JSON.stringify([r.provider,r.terminalId,r.providerTransactionId,r.kind]),clientId:client||input.isOwner?r.clientId??null:null,clientName:client?.name??'תקבול ללא לקוח מזוהה',clientNumber:client?.number??null,occurredAt:r.occurredAt.toISOString(),kind:r.kind,originalAmountMinor:r.amountMinor,currency:r.currency,grossIlsMinor:gross,sourceVatIlsMinor:r.vatIlsMinor??null,vatIlsMinor:vat,vatBasis,feeIlsMinor:fee,feeEstimated,netIlsMinor:gross==null||vat==null||fee==null?null:add(gross,-vat,-fee),fxBasis:gross==null?'MISSING':r.currency==='ILS'?'ORIGINAL_ILS':'RECORDED_ILS'};
  });
  const sum=(field:'grossIlsMinor'|'vatIlsMinor'|'feeIlsMinor'|'netIlsMinor',rows=receiptRows)=>rows.reduce((s,r)=>add(s,r[field]??0),0);
  const clientRows=[...new Set(receiptRows.map(r=>r.clientId))].map(id=>{
    const rows=receiptRows.filter(r=>r.clientId===id);
    return {clientId:id,name:rows[0].clientName,number:rows[0].clientNumber,receiptCount:rows.length,refundCount:rows.filter(r=>r.kind==='REFUND').length,refundsIlsMinor:rows.filter(r=>r.kind==='REFUND').reduce((s,r)=>add(s,r.grossIlsMinor??0),0),grossIlsMinor:sum('grossIlsMinor',rows),vatIlsMinor:sum('vatIlsMinor',rows),feeIlsMinor:sum('feeIlsMinor',rows),netIlsMinor:sum('netIlsMinor',rows),missingFxCount:rows.filter(r=>r.grossIlsMinor==null).length,calculatedVatCount:rows.filter(r=>r.vatBasis==='CALCULATED').length};
  });
  const expenseEvidence=distinctEvidence(input.expenses,e=>e.id,e=>JSON.stringify([e.grossIlsMinor,e.deductibleVatIlsMinor,e.financeBook,e.sharedBasisPoints,e.paidBy,e.paidAt]));
  const expenses=expenseEvidence.filter(e=>inPeriod(e.paidAt,period)&&allocation(e.financeBook,e.sharedBasisPoints)>0).map(e=>{
    const bps=allocation(e.financeBook,e.sharedBasisPoints);
    integer(e.grossIlsMinor);if(e.grossIlsMinor<0)throw new Error('Invalid expense monetary sign');
    if(e.deductibleVatIlsMinor!=null&&(integer(e.deductibleVatIlsMinor)<0||e.deductibleVatIlsMinor>e.grossIlsMinor))throw new Error('Invalid expense VAT');
    const gross=ratio(e.grossIlsMinor,bps,10000);
    const vat=e.deductibleVatIlsMinor==null?null:ratio(e.deductibleVatIlsMinor,bps,10000);
    if(vat==null)blockers.add('EXPENSE_VAT_UNKNOWN');
    if(e.paidBy==='UNKNOWN')blockers.add('EXPENSE_PAYER_UNKNOWN');
    return {id:e.id,name:e.financeBook==='PRIVATE'||bps<10000?'הקצאת הוצאה משותפת':e.name,paidAt:e.paidAt,paidBy:e.paidBy,grossIlsMinor:gross,deductibleVatIlsMinor:vat,netIlsMinor:vat==null?null:gross-vat};
  });
  const expenseNet=expenses.reduce((s,e)=>add(s,e.netIlsMinor??0),0);
  const knownPool=add(sum('netIlsMinor'),-expenseNet);
  const share=Math.trunc(knownPool/2);
  const invoiceVat=ratio(share,1800,10000);
  const reimbursement=expenses.filter(e=>e.paidBy==='ROY').reduce((s,e)=>add(s,e.grossIlsMinor),0);
  const advances=distinctEvidence(input.advances.filter(a=>a.confirmed&&inPeriod(a.paidAt,period)&&a.periodFrom===period.from&&a.periodToExclusive===period.toExclusive),a=>a.reference,a=>JSON.stringify([a.amountIlsMinor,a.paidAt,a.periodFrom,a.periodToExclusive]));
  advances.forEach(a=>{integer(a.amountIlsMinor);if(a.amountIlsMinor<0)throw new Error('Invalid advance monetary sign');});
  const advance=advances.reduce((s,a)=>add(s,a.amountIlsMinor),0);
  const candidate=add(share,invoiceVat,reimbursement,-advance);
  const privateRows=all.filter(r=>r.financeBook==='PRIVATE');
  const privateAmounts=privateRows.map(receiptAmounts);
  return {
    basis:'ACTUAL_RECORDED_CASH' as const,scope:'SHARED' as const,period,status:blockers.size?'PROVISIONAL' as const:'FINAL' as const,blockers:[...blockers],
    totals:{receiptCount:receiptRows.length,grossIlsMinor:sum('grossIlsMinor'),vatIlsMinor:sum('vatIlsMinor'),feeIlsMinor:sum('feeIlsMinor'),netIncomeIlsMinor:sum('netIlsMinor'),refundsIlsMinor:receiptRows.filter(r=>r.kind==='REFUND').reduce((s,r)=>add(s,r.grossIlsMinor??0),0),missingFxCount:receiptRows.filter(r=>r.grossIlsMinor==null).length,sourceVatCount:receiptRows.filter(r=>r.vatBasis==='SOURCE').length,calculatedVatCount:receiptRows.filter(r=>r.vatBasis==='CALCULATED').length,feeEstimated:receiptRows.some(r=>r.feeEstimated),expenseGrossIlsMinor:expenses.reduce((s,e)=>add(s,e.grossIlsMinor),0),expenseNetIlsMinor:expenseNet,expenseVatUnknownCount:expenses.filter(e=>e.deductibleVatIlsMinor==null).length,knownSharedPoolIlsMinor:knownPool},
    roy:{shareBeforeVatIlsMinor:share,invoiceVatRateBps:1800,invoiceVatIlsMinor:invoiceVat,reimbursementIlsMinor:reimbursement,confirmedAdvanceIlsMinor:advance,knownInputsTransferIlsMinor:candidate,finalPayableIlsMinor:blockers.size?null:candidate},
    rounding:{rule:'TRUNCATE_PARTNER_HALF_OWNER_RETAINS_REMAINDER',ownerRemainderIlsMinor:knownPool-share*2},
    clients:clientRows,expenses,advances,
    ...(input.isOwner?{receiptRows,privateExcluded:{receiptCount:privateRows.length,grossIlsMinor:privateAmounts.reduce((s,r)=>add(s,r.gross??0),0),vatIlsMinor:privateAmounts.reduce((s,r)=>add(s,r.vat??0),0),feeIlsMinor:privateAmounts.reduce((s,r)=>add(s,r.fee??0),0),netIncomeIlsMinor:privateAmounts.reduce((s,r)=>add(s,r.net??0),0),missingFxCount:privateRows.filter(r=>r.ilsAmountMinor==null).length},unassignedReceiptCount:all.filter(r=>r.financeBook==='UNASSIGNED').length}:{}),
  };
}
export type CashSettlement = ReturnType<typeof calculateCashSettlement>;
