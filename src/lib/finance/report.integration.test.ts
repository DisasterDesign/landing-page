import assert from 'node:assert/strict';
import test from 'node:test';
const url = process.env.FINANCE_TEST_DATABASE_URL;
test('synthetic database: scoped mixed-client forecast, allocation, real receipts and archives', { skip: !url }, async () => {
    const parsed = new URL(url!);
    assert.equal(parsed.hostname, '127.0.0.1');
    assert.equal(parsed.port, '55448');
    assert.equal(parsed.pathname, '/finance_test');
    process.env.DATABASE_URL = url;
    process.env.DIRECT_URL = url;
    const { prisma } = await import('@/lib/prisma');
    const { buildFinanceReport } = await import('./report-data');
    const { loadReceipts, receiptTotals } = await import('./receipts');
    const prefix = 'finance-isolation-integration-';
    const cId = prefix + 'mixed';
    const archivedId = prefix + 'archived';
    const privateOnlyId = prefix + 'private';
    const paidAt = new Date();
    const cleanup = async () => {
        await prisma.financeExpensePayment.deleteMany({where:{paymentKey:{startsWith:prefix}}});
        await prisma.financeTransaction.deleteMany({ where: { providerTransactionId: { startsWith: prefix } } });
        await prisma.expense.deleteMany({ where: { id: { startsWith: prefix } } });
        await prisma.agreementCharge.deleteMany({ where: { id: { startsWith: prefix } } });
        await prisma.agreement.deleteMany({ where: { id: { startsWith: prefix } } });
        await prisma.client.deleteMany({ where: { id: { startsWith: prefix } } });
        await prisma.user.deleteMany({where:{id:prefix+'payer-roy'}});
    };
    await cleanup();
    const viewer = { userId: 'roy', role: 'ADMIN' as const, isOwner: false, revenueSharePct: 50 };
    const baseline = await buildFinanceReport(viewer,'fuzion');
    try {
        await prisma.client.create({ data: { id: cId, name: 'shared client', partner: 'fuzion', status: 'בוצע', monthlyAmount: 9000, cardcomAccountIds: [], products: { create: [{ id: prefix + 'shared-product', name: 'shared product', financeBook: 'SHARED', monthlyAmount: 1000, status: 'בוצע' }, { id: prefix + 'private-product', name: 'PRIVATE_PRODUCT_SECRET', financeBook: 'PRIVATE', monthlyAmount: 8000, status: 'בוצע' }] } } });
        await prisma.client.create({ data: { id: privateOnlyId, name: 'PRIVATE_CLIENT_SECRET', partner: 'fuzion', status: 'בוצע', monthlyAmount: 123456, cardcomAccountIds: [], products: { create: { name: 'PRIVATE_ONLY_SECRET', financeBook: 'PRIVATE', monthlyAmount: 123456, status: 'בוצע' } } } });
        await prisma.client.create({ data: { id: archivedId, name: 'archived receipt client', partner: 'personal', vatExempt: true, status: 'בוצע', archivedAt: paidAt, cardcomAccountIds: [98001] } });
        await prisma.expense.create({ data: { id: prefix + 'mixed-invoice', name: 'PRIVATE_SUPPLIER_SECRET', vendor: 'PRIVATE_VENDOR_SECRET', amount: 100, currency: 'ILS', financeBook: 'PRIVATE', sharedBasisPoints: 4000, notes: 'PRIVATE_INVOICE_SECRET' } });
        const agreementId = prefix + 'quote';
        await prisma.agreement.create({ data: { id: agreementId, kind: 'ONE_TIME', monthlyPrice: 0, customerName: 'quote customer', phone: '0', email: 'test@example.invalid', content: 'test', createdBy: 'test', financeBook: 'SHARED', paymentStatus: 'COMPLETED', paidAt, paidAmount: 118, cardcomDealId: prefix + 'receipt', clientId: cId } });
        await prisma.agreementCharge.create({ data: { id: prefix + 'charge', agreementId, amount: 118, success: true, cardcomDealId: prefix + 'receipt', chargedAt: paidAt } });
        const terminal = process.env.CARDCOM_TERMINAL ?? 'legacy';
        await prisma.financeTransaction.createMany({ data: [
                { provider: 'CARDCOM', terminalId: terminal, providerTransactionId: prefix + 'receipt', kind: 'CHARGE', amountMinor: 11800, currency: 'ILS', ilsAmountMinor: 11800, occurredAt: paidAt, financeBook: 'SHARED', agreementId, clientId: cId },
                { provider: 'CARDCOM', terminalId: terminal, providerTransactionId: prefix + 'archived-receipt', kind: 'CHARGE', amountMinor: 10400, currency: 'USD', ilsAmountMinor: 35000, occurredAt: paidAt, financeBook: 'PRIVATE', clientId: archivedId },
                { provider: 'CARDCOM', terminalId: terminal, providerTransactionId: prefix + 'refund', kind: 'REFUND', amountMinor: -11800, currency: 'ILS', ilsAmountMinor: -11800, occurredAt: paidAt, financeBook: 'SHARED', clientId: cId },
                { provider: 'CARDCOM', terminalId: terminal, providerTransactionId: prefix + 'fx-unvalued', kind: 'CHARGE', amountMinor: 10400, currency: 'USD', ilsAmountMinor: null, occurredAt: paidAt, financeBook: 'PRIVATE', clientId: archivedId },
                { provider: 'CARDCOM', terminalId: terminal, providerTransactionId: prefix + 'unassigned', kind: 'CHARGE', amountMinor: 8850, currency: 'ILS', ilsAmountMinor: 8850, occurredAt: paidAt, financeBook: 'UNASSIGNED' },
            ] });
        await prisma.client.create({data:{id:prefix+'no-products-mixed',name:'shared agreement client',partner:'fuzion',status:'בוצע',monthlyAmount:9000,paymentDate:new Date('2099-01-01'),cardcomAccountIds:[],agreements:{create:[{id:prefix+'no-products-private-agreement',monthlyPrice:8000,customerName:'PRIVATE_AGREEMENT_SECRET',phone:'0',email:'private@example.invalid',content:'test',createdBy:'test',financeBook:'PRIVATE'},{id:prefix+'no-products-shared-agreement',monthlyPrice:1000,customerName:'shared agreement',phone:'0',email:'shared@example.invalid',content:'test',createdBy:'test',financeBook:'SHARED'}]}}});
        await prisma.expense.create({data:{id:prefix+'one-time-mixed-cost',name:'PRIVATE_ONE_TIME_COST_SECRET',vendor:'PRIVATE_ONE_TIME_VENDOR_SECRET',amount:100,currency:'ILS',frequency:'ONE_TIME',financeBook:'PRIVATE',sharedBasisPoints:4000,startedAt:paidAt}});
        await prisma.agreement.create({data:{id:prefix+'initial-subscription',kind:'SUBSCRIPTION',monthlyPrice:100,customerName:'initial subscription payment',phone:'0',email:'test@example.invalid',content:'test',createdBy:'test',financeBook:'SHARED',paymentStatus:'COMPLETED',paidAt,paidAmount:118,cardcomDealId:prefix+'initial-receipt',clientId:cId}});
        await prisma.agreementCharge.create({data:{id:prefix+'initial-recurring-charge',agreementId:prefix+'initial-subscription',amount:118,success:true,cardcomDealId:prefix+'distinct-recurring-receipt',chargedAt:paidAt}});
        await prisma.user.create({data:{id:prefix+'payer-roy',name:'synthetic payer',email:prefix+'roy@example.invalid',passwordHash:'fixture',isOwner:false,role:'ADMIN',revenueSharePct:50}});
        await prisma.expense.create({data:{id:prefix+'private-paid-cost',name:'PRIVATE_DIRECT_COST_SECRET',vendor:'PRIVATE_DIRECT_VENDOR_SECRET',amount:200,financeBook:'PRIVATE',frequency:'ONE_TIME'}});
        await prisma.financeExpensePayment.createMany({data:[{paymentKey:prefix+'mixed-payment',expenseId:prefix+'one-time-mixed-cost',amountIlsMinor:10000,paidAt,financeBook:'PRIVATE',sharedBasisPoints:4000,paidById:prefix+'payer-roy',frequency:'ONE_TIME'},{paymentKey:prefix+'private-payment',expenseId:prefix+'private-paid-cost',amountIlsMinor:20000,paidAt,financeBook:'PRIVATE',sharedBasisPoints:null,paidById:'synthetic-owner',frequency:'ONE_TIME'}]});
        await prisma.expense.create({data:{id:prefix+'unlinked-cost',name:'PRIVATE_UNASSIGNED_SERVER_SECRET',vendor:'PRIVATE_SERVER_SECRET',amount:100,financeBook:'UNASSIGNED'}});
        const {execFileSync}=await import('node:child_process');
        const dryRun=JSON.parse(execFileSync(process.execPath,['node_modules/tsx/dist/cli.mjs','scripts/finance-backfill.ts'],{env:{...process.env,DATABASE_URL:url,DIRECT_URL:url},encoding:'utf8'}));
        assert.equal(dryRun.mode,'DRY_RUN');
        assert.equal(dryRun.unknown.some((r:{id:string})=>r.id===prefix+'unlinked-cost'),true);
        assert.equal(dryRun.updates.some((r:{id:string})=>r.id===prefix+'unlinked-cost'),false);
        const {writeFileSync,unlinkSync}=await import('node:fs');
        const reviewMap=`/private/tmp/finance-reviewed-map-${process.pid}.json`;
        try{
         writeFileSync(reviewMap,JSON.stringify({[prefix+'private-paid-cost']:'PRIVATE'}));
         const replay=JSON.parse(execFileSync(process.execPath,['node_modules/tsx/dist/cli.mjs','scripts/finance-backfill.ts',`--expense-map=${reviewMap}`],{env:{...process.env,DATABASE_URL:url,DIRECT_URL:url},encoding:'utf8'}));
         assert.equal(replay.updates.some((r:{id:string})=>r.id===prefix+'private-paid-cost'),false);
        }finally{unlinkSync(reviewMap);}

        assert.equal((await prisma.expense.findUniqueOrThrow({where:{id:prefix+'unlinked-cost'}})).financeBook,'UNASSIGNED');
        const roy = await buildFinanceReport(viewer, 'fuzion');
        const json = JSON.stringify(roy);
        assert.equal(json.includes('PRIVATE_'), false);
        assert.equal('personalProfit' in roy, false);
        assert.equal('personal' in roy.books, false);
        assert.equal('unassignedTransactions' in roy, false);
        const row = roy.perClient.find(c => c.id === cId)!;
        assert.equal(row.mrr, 1000);
        assert.equal(row.royShare, Math.trunc((100000 - Math.round(100000 * 18 / 118) - 2000) / 2) / 100);
        assert.equal(roy.perClient.some(c => c.id === privateOnlyId), false);
        assert.equal(roy.perClient.some(c=>c.id===prefix+'no-products-mixed'),false);
        assert.equal(row.paymentDate,null);
        assert.equal(Math.round((roy.actualAllocation.sharedCosts-baseline.actualAllocation.sharedCosts)*100),4000);
        assert.equal(Math.round((roy.actualAllocation.partnerProfit-baseline.actualAllocation.partnerProfit)*100),7764);
        assert.equal(Math.round((roy.oneOffAllocation.partnerProfit-baseline.oneOffAllocation.partnerProfit)*100),2882);
        assert.equal(roy.actualAllocation.expenseTreatment,'AFTER_RECORDED_PAYMENTS');
        assert.equal(roy.actualAllocation.recordedPaymentCount-baseline.actualAllocation.recordedPaymentCount,1);
        assert.equal(Math.round((roy.actualSettlement.royEntitlement-baseline.actualSettlement.royEntitlement)*100),7764);
        assert.equal(Math.round((roy.actualSettlement.partnerPaidShared-baseline.actualSettlement.partnerPaidShared)*100),4000);
        assert.equal(Math.round((roy.actualSettlement.transferToRoy-baseline.actualSettlement.transferToRoy)*100),11764);
        assert.equal(roy.settlement.basis,'FORECAST_ONLY');
        assert.equal(roy.expenses.find(e => e.id === prefix + 'mixed-invoice')?.amount, 40);
        const receipts = (await loadReceipts(new Date(Date.now() - 86400000))).filter(r => r.providerTransactionId.startsWith(prefix));
        assert.equal(receipts.filter(r => r.providerTransactionId === prefix + 'receipt').length, 1);
        const totals = receiptTotals(receipts.filter(r => r.financeBook === 'PRIVATE'));
        assert.equal(totals.gross, 350);
        assert.equal(totals.vat, 0);
        assert.equal(totals.unvaluedCount, 1);
        assert.equal(receiptTotals(receipts.filter(r => r.financeBook === 'SHARED')).gross, 236);
        assert.equal(receipts.some(r=>r.providerTransactionId===prefix+'initial-receipt'),true);
        assert.equal(receipts.some(r=>r.providerTransactionId===prefix+'distinct-recurring-receipt'),true);
        assert.equal((await buildFinanceReport({ ...viewer, isOwner: true }, 'combined')).unassignedTransactions?.some(r => r.providerTransactionId === prefix + 'unassigned'), true);
        // The ledger's authoritative timestamp wins even if the webhook arrived this month.
        await prisma.financeTransaction.updateMany({ where: { providerTransactionId: prefix + 'receipt' }, data: { occurredAt: new Date('2020-01-01') } });
        const current = (await loadReceipts(new Date(Date.now() - 86400000))).filter(r => r.providerTransactionId === prefix + 'receipt');
        assert.equal(current.length, 0);
        const { expenseAttribution } = await import('./expense-write');
        await assert.rejects(expenseAttribution(viewer, { clientId: privateOnlyId, clientProductId: prefix + 'private-product' }), /Forbidden/);
        const sharedCost = await expenseAttribution(viewer, {});
        assert.equal(sharedCost.financeBook, 'SHARED');
        const { planLegacyProducts } = await import('./legacy-import');
        const archived = await prisma.client.findUniqueOrThrow({ where: { id: archivedId }, include: { products: { select: { id: true } }, agreements: { select: { id: true, financeBook: true } } } });
        const plans = planLegacyProducts([archived]);
        for (let iteration = 0; iteration < 2; iteration++)
            for (const p of plans)
                await prisma.clientProduct.upsert({ where: { id: p.data.id }, create: p.data, update: {} });
        assert.equal(await prisma.clientProduct.count({ where: { clientId: archivedId } }), 1);
        assert.equal((await prisma.clientProduct.findFirstOrThrow({ where: { clientId: archivedId } })).archivedAt?.getTime(), paidAt.getTime());
    }
    finally {
        await cleanup();
        await prisma.$disconnect();
    }
});
