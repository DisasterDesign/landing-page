import assert from 'node:assert/strict';
import test from 'node:test';

const url = process.env.PRODUCT_PRICE_TEST_DATABASE_URL;
test('synthetic price correction and undo preserve receipts, attribution, other products and report scopes', { skip: !url }, async () => {
  const parsed = new URL(url!);
  assert.equal(parsed.hostname, '127.0.0.1');
  assert.equal(parsed.port, '55449');
  assert.equal(parsed.pathname, '/product_price_test');
  process.env.DATABASE_URL = url; process.env.DIRECT_URL = url;
  const { prisma } = await import('@/lib/prisma');
  const { correctProductPrice } = await import('./product-price-write');
  const { buildFinanceReport } = await import('./report-data');
  const { applyPaymentToProduct } = await import('@/lib/client-products');
  const { searchClients } = await import('@/lib/mcp/data');
  const prefix = 'synthetic-price-';
  const ownerId = prefix + 'owner', partnerId = prefix + 'partner';
  const clientId = prefix + 'client', productId = prefix + 'product', otherId = prefix + 'other';
  const agreementId = prefix + 'agreement';
  const viewer = { userId: ownerId, isOwner: true, role: 'ADMIN' as const, revenueSharePct: null };
  const write = (input: Record<string, unknown>, actor = ownerId) => prisma.$transaction(db => correctProductPrice(db, actor, clientId, productId, input), { isolationLevel: 'Serializable' });
  const cleanup = async () => {
    await prisma.clientProductPriceRevision.deleteMany({ where: { productId: { startsWith: prefix } } });
    await prisma.financeTransaction.deleteMany({ where: { providerTransactionId: { startsWith: prefix } } });
    await prisma.agreement.deleteMany({ where: { id: { startsWith: prefix } } });
    await prisma.client.deleteMany({ where: { id: { startsWith: prefix } } });
    await prisma.user.deleteMany({ where: { id: { startsWith: prefix } } });
  };
  await cleanup();
  try {
    await prisma.user.createMany({ data: [
      { id: ownerId, name: 'synthetic owner', email: 'price-owner@example.invalid', passwordHash: 'fixture', role: 'ADMIN', isOwner: true },
      { id: partnerId, name: 'synthetic partner', email: 'price-partner@example.invalid', passwordHash: 'fixture', role: 'ADMIN', isOwner: false },
    ] });
    await prisma.client.create({ data: { id: clientId, name: 'SYNTHETIC_PRIVATE', monthlyAmount: 399, status: 'בוצע', vatExempt: true, ownerId, products: { create: [
      { id: productId, name: 'SYNTHETIC_PRIVATE_PRODUCT', monthlyAmount: 250, financeBook: 'PRIVATE', status: 'בוצע', agreementId },
      { id: otherId, name: 'synthetic shared product', monthlyAmount: 100, financeBook: 'SHARED', status: 'בוצע' },
    ] } } });
    await prisma.agreement.create({ data: { id: agreementId, clientId, financeBook: 'PRIVATE', monthlyPrice: 75, customerName: 'synthetic customer', email: 'price@example.invalid', phone: '0', content: 'synthetic', createdBy: ownerId } });
    await prisma.financeTransaction.create({ data: { provider: 'CARDCOM', terminalId: 'synthetic', providerTransactionId: prefix + 'receipt', kind: 'CHARGE', amountMinor: 8000, currency: 'USD', ilsAmountMinor: 24000, occurredAt: new Date(), financeBook: 'PRIVATE', clientId } });
    const receiptBefore = await prisma.financeTransaction.findMany();
    const otherBefore = await prisma.clientProduct.findUniqueOrThrow({ where: { id: otherId } });
    const before = await buildFinanceReport(viewer, 'combined');
    const sharedBefore = await buildFinanceReport({ ...viewer, isOwner: false, userId: partnerId }, 'fuzion');
    const input = { expectedVersion: 0, amount: 75, currency: 'USD', reason: 'Synthetic owner confirmation', source: 'Synthetic source' };
    await assert.rejects(prisma.$transaction(async db => {
      await correctProductPrice(db, ownerId, clientId, productId, input);
      throw new Error('Synthetic transaction rollback');
    }, { isolationLevel: 'Serializable' }), /Synthetic transaction rollback/);
    assert.equal((await prisma.clientProduct.findUniqueOrThrow({ where: { id: productId } })).monthlyAmount, 250);
    assert.equal((await prisma.client.findUniqueOrThrow({ where: { id: clientId } })).monthlyAmount, 399);
    assert.equal(await prisma.clientProductPriceRevision.count({ where: { productId } }), 0);
    await assert.rejects(write(input, partnerId), /Forbidden/);
    for (const invalid of [1.234, -1, NaN, '75']) await assert.rejects(write({ ...input, amount: invalid }));
    const corrected = await write(input);
    assert.equal(corrected.product.monthlyOriginalAmount, 75);
    assert.equal(corrected.product.monthlyOriginalCurrency, 'USD');
    assert.equal(corrected.product.monthlyAmount, null);
    assert.equal(corrected.monthlyAmount, null);
    assert.equal(corrected.product.financeBook, 'PRIVATE');
    assert.equal(corrected.product.agreementId, agreementId);
    const clientRead = await searchClients(viewer, { query: 'SYNTHETIC_PRIVATE', limit: 3 });
    const originalPrice = clientRead.clients[0].products.find(p => p.name === 'SYNTHETIC_PRIVATE_PRODUCT')!;
    assert.equal(originalPrice.originalMonthlyGross, 75);
    assert.equal(originalPrice.originalCurrency, 'USD');
    assert.equal(originalPrice.monthlyGross, null);
    const sharedRead = await searchClients({ ...viewer, isOwner: false, userId: partnerId }, { query: 'SYNTHETIC_PRIVATE', limit: 3 });
    assert.equal(sharedRead.clients[0].products.some(p => p.originalCurrency === 'USD'), false);
    const revision = await prisma.clientProductPriceRevision.findFirstOrThrow({ where: { productId } });
    assert.deepEqual(revision.before, { monthlyAmount: 250, monthlyOriginalAmount: null, monthlyOriginalCurrency: null, clientMonthlyAmount: 399 });
    assert.equal((revision.after as {clientMonthlyAmount: number | null}).clientMonthlyAmount, null);
    assert.equal(revision.actorId, ownerId);
    assert.equal(revision.source, input.source);
    await assert.rejects(write(input), /המחיר השתנה/);
    await assert.rejects(write({ expectedVersion: 1, restoreRevisionId: 'wrong-revision', reason: 'Synthetic undo' }));
    // Old editors and callbacks cannot reinterpret or overwrite the corrected price.
    assert.equal((await prisma.clientProduct.updateMany({ where: { id: productId, monthlyPriceVersion: 0 }, data: { monthlyAmount: 999 } })).count, 0);
    await prisma.$transaction(db => applyPaymentToProduct(db, clientId, agreementId, 999, new Date()));
    const afterPayment = await prisma.clientProduct.findUniqueOrThrow({ where: { id: productId } });
    assert.equal(afterPayment.monthlyOriginalAmount, 75);
    assert.equal(afterPayment.monthlyAmount, null);
    const after = await buildFinanceReport(viewer, 'combined');
    assert.equal(after.bottomLine.totalMrr, before.bottomLine.totalMrr - 250);
    assert.equal(after.forecastUnvaluedCount, before.forecastUnvaluedCount + 1);
    assert.deepEqual(after.actual, before.actual);
    const sharedAfter = await buildFinanceReport({ ...viewer, isOwner: false, userId: partnerId }, 'fuzion');
    assert.equal(sharedAfter.bottomLine.totalMrr, sharedBefore.bottomLine.totalMrr);
    assert.equal(JSON.stringify(sharedAfter).includes('SYNTHETIC_PRIVATE_PRODUCT'), false);
    assert.deepEqual(await prisma.financeTransaction.findMany(), receiptBefore);
    assert.deepEqual(await prisma.clientProduct.findUniqueOrThrow({ where: { id: otherId } }), otherBefore);
    const undone = await write({ expectedVersion: 1, restoreRevisionId: revision.id, reason: 'Synthetic exact undo' });
    assert.equal(undone.product.monthlyOriginalAmount, null);
    assert.equal(undone.product.monthlyOriginalCurrency, null);
    assert.equal(undone.product.monthlyAmount, 250);
    assert.equal(undone.monthlyAmount, 350);
    assert.equal(undone.product.monthlyPriceVersion, 2);
    assert.equal(await prisma.clientProductPriceRevision.count({ where: { productId } }), 2);
    assert.deepEqual((await buildFinanceReport(viewer, 'combined')).actual, before.actual);
    await assert.rejects(write({ expectedVersion: 2, restoreRevisionId: revision.id, reason: 'Outdated undo' }), /השינוי האחרון/);
    const raced = await Promise.allSettled([write({ ...input, expectedVersion: 2, amount: 76 }), write({ ...input, expectedVersion: 2, amount: 77 })]);
    assert.equal(raced.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(raced.filter(result => result.status === 'rejected').length, 1);
    assert.equal((await prisma.clientProduct.findUniqueOrThrow({ where: { id: productId } })).monthlyPriceVersion, 3);
    // Revocation is checked inside the financial transaction, independently of route/session claims.
    await prisma.user.update({ where: { id: ownerId }, data: { isOwner: false } });
    await assert.rejects(write({ ...input, expectedVersion: 3 }), /Forbidden/);
    assert.equal(await prisma.clientProductPriceRevision.count({ where: { productId } }), 3);
  } finally { await cleanup(); await prisma.$disconnect(); }
});
