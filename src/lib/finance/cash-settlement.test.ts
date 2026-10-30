import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveCashPeriod } from './cash-period';
import { calculateCashSettlement, type CashInput } from './cash-settlement';

const period = () => resolveCashPeriod({from:'2026-10-01',to:'2026-11-01',asOf:'2026-11-02T00:00:00Z'},new Date('2026-11-03T00:00:00Z'));
const receipt = (overrides = {}) => ({provider:'CARDCOM',terminalId:'synthetic',providerTransactionId:'r1',kind:'CHARGE',amountMinor:11800,currency:'ILS',ilsAmountMinor:11800,vatIlsMinor:1800,feeIlsMinor:0,occurredAt:new Date('2026-10-15T12:00:00Z'),financeBook:'SHARED',clientId:'shared',...overrides});
const input = (): CashInput => ({period:period(),isOwner:true,receipts:[receipt()],clients:[{id:'shared',name:'Synthetic shared',number:1}],expenses:[],advances:[],coverage:{sourceComplete:true,expensesConfirmed:true,advancesConfirmed:true}});

test('Israel month boundaries honor the October clock change; UTC and exact instants stay explicit',()=>{
 const p=period();assert.equal(p.from,'2026-09-30T21:00:00.000Z');assert.equal(p.toExclusive,'2026-10-31T22:00:00.000Z');assert.equal(p.timezone,'Asia/Jerusalem');
 const utc=resolveCashPeriod({from:'2026-10-01',to:'2026-11-01',timezone:'UTC'},new Date('2026-11-02T00:00:00Z'));assert.equal(utc.from,'2026-10-01T00:00:00.000Z');
 assert.throws(()=>resolveCashPeriod({from:'2026-02-30',to:'2026-03-01'}));assert.throws(()=>resolveCashPeriod({asOf:'2099-01-01T00:00:00Z'}));
});
test('real shared cash, signed refunds and deduplication reconcile; private revenue never funds the split',()=>{
 const x=input();x.receipts=[receipt(),receipt(),receipt({providerTransactionId:'refund',kind:'REFUND',amountMinor:-1180,ilsAmountMinor:-1180,vatIlsMinor:-180}),receipt({providerTransactionId:'PRIVATE_REF',financeBook:'PRIVATE',amountMinor:99900,ilsAmountMinor:99900})];
 const s=calculateCashSettlement(x);assert.equal(s.totals.receiptCount,2);assert.equal(s.totals.grossIlsMinor,10620);assert.equal(s.totals.vatIlsMinor,1620);assert.equal(s.totals.refundsIlsMinor,-1180);assert.equal(s.roy.shareBeforeVatIlsMinor,4500);assert.equal(s.roy.invoiceVatIlsMinor,810);assert.equal(s.roy.finalPayableIlsMinor,5310);
 assert.equal(s.clients.reduce((sum,c)=>sum+c.grossIlsMinor,0),s.totals.grossIlsMinor);
 assert.equal(s.clients.reduce((sum,c)=>sum+c.refundsIlsMinor,0),s.totals.refundsIlsMinor);
 assert.equal(s.clients[0].refundCount,1);
 const partner=calculateCashSettlement({...x,isOwner:false});assert.equal('privateExcluded' in partner,false);assert.equal('receiptRows' in partner,false);assert.equal(JSON.stringify(partner).includes('PRIVATE_REF'),false);assert.equal(partner.roy.finalPayableIlsMinor,5310);
});
test('paid annual cost uses its evidenced net VAT basis once; reimbursement is outside Roy invoice VAT',()=>{
 const x=input();x.receipts=[receipt({amountMinor:118000,ilsAmountMinor:118000,vatIlsMinor:18000})];
 x.expenses=[{id:'p',name:'Synthetic annual',grossIlsMinor:11800,deductibleVatIlsMinor:1800,financeBook:'SHARED',paidBy:'ROY',paidAt:'2026-10-10T00:00:00Z'}];
 x.advances=[{reference:'confirmed',amountIlsMinor:1000,paidAt:'2026-10-12T00:00:00Z',confirmed:true,periodFrom:x.period.from,periodToExclusive:x.period.toExclusive},{reference:'old',amountIlsMinor:100000,paidAt:'2026-09-10T00:00:00Z',confirmed:true,periodFrom:'2026-09-01T00:00:00Z',periodToExclusive:'2026-10-01T00:00:00Z'},{reference:'unconfirmed',amountIlsMinor:100000,paidAt:'2026-10-11T00:00:00Z',confirmed:false,periodFrom:x.period.from,periodToExclusive:x.period.toExclusive}];
 const s=calculateCashSettlement(x);assert.equal(s.totals.expenseNetIlsMinor,10000);assert.equal(s.roy.shareBeforeVatIlsMinor,45000);assert.equal(s.roy.invoiceVatIlsMinor,8100);assert.equal(s.roy.reimbursementIlsMinor,11800);assert.equal(s.roy.confirmedAdvanceIlsMinor,1000);assert.equal(s.roy.finalPayableIlsMinor,63900);
});
test('missing FX, source VAT, fee evidence, cost VAT, payment coverage and freshness block final payable',()=>{
 const x=input();x.receipts=[receipt({vatIlsMinor:null,feeIlsMinor:undefined}),receipt({providerTransactionId:'usd',currency:'USD',ilsAmountMinor:null,vatIlsMinor:null})];
 x.expenses=[{id:'p',name:'Known gross, VAT unknown',grossIlsMinor:1180,deductibleVatIlsMinor:null,financeBook:'SHARED',paidBy:'OWNER',paidAt:'2026-10-10T00:00:00Z'}];
 x.coverage={sourceComplete:false,expensesConfirmed:false,advancesConfirmed:false};
 const s=calculateCashSettlement(x);assert.equal(s.status,'PROVISIONAL');assert.equal(s.roy.finalPayableIlsMinor,null);assert.equal(s.totals.missingFxCount,1);assert.equal(s.receiptRows?.[0].vatBasis,'CALCULATED');assert.equal(s.totals.expenseNetIlsMinor,0);assert.equal(s.expenses[0].netIlsMinor,null);
 for(const code of ['SOURCE_INCOMPLETE','EXPENSE_COVERAGE_UNKNOWN','ADVANCE_COVERAGE_UNKNOWN','RECEIPT_FX_MISSING','VAT_CALCULATED','FEES_ESTIMATED','EXPENSE_VAT_UNKNOWN'])assert.ok(s.blockers.includes(code),code);
});
test('source zero VAT and signed rounding survive; current incomplete month never becomes final',()=>{
 const x=input();x.receipts=[receipt({amountMinor:101,ilsAmountMinor:101,vatIlsMinor:0})];const s=calculateCashSettlement(x);assert.equal(s.roy.shareBeforeVatIlsMinor,50);assert.equal(s.rounding.ownerRemainderIlsMinor,1);assert.equal(s.receiptRows?.[0].vatBasis,'SOURCE');
 const current=calculateCashSettlement({...x,period:resolveCashPeriod({from:'2026-10-01',to:'2026-11-01',asOf:'2026-10-30T00:00:00Z'},new Date('2026-10-30T01:00:00Z'))});assert.ok(current.blockers.includes('PERIOD_OPEN'));assert.equal(current.roy.finalPayableIlsMinor,null);
});
test('mixed private invoice gives a partner only the shared allocation; unknown payer blocks final',()=>{
 const x=input();x.expenses=[{id:'mixed',name:'PRIVATE_SUPPLIER_SECRET',grossIlsMinor:10000,deductibleVatIlsMinor:0,financeBook:'PRIVATE',sharedBasisPoints:4000,paidBy:'UNKNOWN',paidAt:'2026-10-10T00:00:00Z'}];
 const s=calculateCashSettlement({...x,isOwner:false});assert.equal(s.expenses[0].grossIlsMinor,4000);assert.equal(JSON.stringify(s).includes('PRIVATE_SUPPLIER_SECRET'),false);assert.ok(s.blockers.includes('EXPENSE_PAYER_UNKNOWN'));
});

test('every partial allocation hides its invoice description, including SHARED partial invoices',()=>{
 const x=input();x.expenses=[{id:'mixed',name:'PRIVATE_INVOICE_DESCRIPTION',grossIlsMinor:10000,deductibleVatIlsMinor:0,financeBook:'SHARED',sharedBasisPoints:4000,paidBy:'OWNER',paidAt:'2026-10-10T00:00:00Z'}];
 assert.equal(JSON.stringify(calculateCashSettlement({...x,isOwner:false})).includes('PRIVATE_INVOICE_DESCRIPTION'),false);
});
test('malformed monetary evidence and overflowing aggregates cannot produce a final balance',()=>{
 for(const amount of [NaN,Infinity,1.5,Number.MAX_SAFE_INTEGER+1]){
  const x=input();x.receipts=[receipt({ilsAmountMinor:amount})];assert.throws(()=>calculateCashSettlement(x),/monetary|integer|overflow/i);
 }
 for(const row of [receipt({vatIlsMinor:20000}),receipt({vatIlsMinor:-1800}),receipt({kind:'REFUND'})]){const x=input();x.receipts=[row];assert.throws(()=>calculateCashSettlement(x),/VAT|sign/i);}
 const x=input();x.receipts=[receipt({amountMinor:Number.MAX_SAFE_INTEGER,ilsAmountMinor:Number.MAX_SAFE_INTEGER,vatIlsMinor:0}),receipt({providerTransactionId:'second',amountMinor:Number.MAX_SAFE_INTEGER,ilsAmountMinor:Number.MAX_SAFE_INTEGER,vatIlsMinor:0})];assert.throws(()=>calculateCashSettlement(x),/overflow/i);
 const e=input();e.expenses=[{id:'bad',name:'bad VAT',grossIlsMinor:100,deductibleVatIlsMinor:101,financeBook:'SHARED',paidBy:'OWNER',paidAt:'2026-10-10T00:00:00Z'}];assert.throws(()=>calculateCashSettlement(e),/VAT/i);
});
test('duplicate advance and expense evidence counts once and conflicting identities are rejected',()=>{
 const x=input();const advance={reference:'a',amountIlsMinor:1000,paidAt:'2026-10-12T00:00:00Z',confirmed:true,periodFrom:x.period.from,periodToExclusive:x.period.toExclusive};
 x.advances=[advance,{...advance}];assert.equal(calculateCashSettlement(x).roy.confirmedAdvanceIlsMinor,1000);
 x.advances=[advance,{...advance,amountIlsMinor:1001}];assert.throws(()=>calculateCashSettlement(x),/Conflicting/);
 x.advances=[];const expense={id:'e',name:'once',grossIlsMinor:1000,deductibleVatIlsMinor:0,financeBook:'SHARED',paidBy:'OWNER' as const,paidAt:'2026-10-10T00:00:00Z'};x.expenses=[expense,{...expense}];assert.equal(calculateCashSettlement(x).totals.expenseGrossIlsMinor,1000);
 x.expenses=[expense,{...expense,grossIlsMinor:1001}];assert.throws(()=>calculateCashSettlement(x),/Conflicting/);
});
test('receipt references include terminal identity and pagination order is stable across loader order',()=>{
 const x=input();x.receipts=[receipt({terminalId:'z'}),receipt({terminalId:'a'})];const a=calculateCashSettlement(x);const b=calculateCashSettlement({...x,receipts:[...x.receipts].reverse()});
 assert.equal(new Set(a.receiptRows?.map(r=>r.reference)).size,2);assert.deepEqual(a.receiptRows,b.receiptRows);
});
test('unassigned receipt coverage is never silently treated as zero shared income',()=>{
 const x=input();x.receipts.push(receipt({providerTransactionId:'unassigned',financeBook:'UNASSIGNED'}));const s=calculateCashSettlement(x);assert.equal(s.unassignedReceiptCount,1);assert.equal(s.roy.finalPayableIlsMinor,null);assert.ok(s.blockers.includes('RECEIPT_CLASSIFICATION_UNKNOWN'));
});
