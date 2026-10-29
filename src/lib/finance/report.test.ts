import assert from 'node:assert/strict';
import test from 'node:test';
import { allocateProfit, sharedExpenseMinor, sanitizeExpense } from './report';
test('private revenue and direct cost belong exclusively to owner', () => {
    assert.deepEqual(allocateProfit(100000, 0, 20000, 0), { personalProfit: 80000, sharedProfit: 0, ownerProfit: 80000, partnerProfit: 0 });
});
test('shared net profit splits equally including losses', () => {
    assert.equal(allocateProfit(0, 100000, 0, 20000).partnerProfit, 40000);
    assert.equal(allocateProfit(0, 10000, 0, 30000).partnerProfit, -10000);
});
test('a mixed supplier bill allocates exactly forty percent to partnership', () => {
    assert.equal(sharedExpenseMinor({ financeBook: 'PRIVATE', sharedBasisPoints: 4000 }, 10000), 4000);
});
test('mixed invoice only exposes sanitized shared allocation', () => {
    const value = sanitizeExpense({ id: 'x', financeBook: 'PRIVATE', sharedBasisPoints: 4000, amount: 100, currency: 'ILS', frequency: 'MONTHLY', name: 'private customer supplier', vendor: 'secret', notes: 'invoice secret', clientId: 'private', category: 'HOSTING', active: true, isFixed: true }, false);
    assert.equal(value?.amount, 40);
    assert.equal(value?.vendor, '');
    assert.equal(value?.clientId, null);
    assert.equal(value?.name, 'הקצאת הוצאה משותפת');
    assert.equal(value?.notes, null);
    assert.equal(sanitizeExpense({ id: 'p', financeBook: 'PRIVATE', sharedBasisPoints: null, amount: 5, currency: 'ILS', frequency: 'MONTHLY', name: 'secret', vendor: 'secret', notes: null, clientId: null, category: 'OTHER', active: true, isFixed: true }, false), null);
});

test('paid cost snapshots split mixed invoices and reimburse the partner once',async()=>{
 const {recordedExpenseTotals}=await import('./report');
 const rows=[{amountIlsMinor:10000,financeBook:'PRIVATE',sharedBasisPoints:4000,paidById:'roy'},{amountIlsMinor:20000,financeBook:'PRIVATE',sharedBasisPoints:null,paidById:'elad'}];
 assert.deepEqual(recordedExpenseTotals(rows,new Set(['roy'])),{personalCostsMinor:26000,sharedCostsMinor:4000,partnerPaidSharedMinor:4000,paymentCount:2});
});

test('shared expense never exposes raw supplier research notes to a nonowner',()=>{
 const expense={id:'shared-resource',financeBook:'SHARED',sharedBasisPoints:null,amount:10,currency:'ILS',frequency:'MONTHLY',name:'Shared server',vendor:'Provider',notes:'PRIVATE_INVOICE_RESEARCH',clientId:null,category:'SERVERS',active:true,isFixed:true};
 assert.equal(sanitizeExpense(expense,false)?.notes,null);
 assert.equal(sanitizeExpense(expense,true)?.notes,'PRIVATE_INVOICE_RESEARCH');
});
