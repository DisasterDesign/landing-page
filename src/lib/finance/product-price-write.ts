import type { Prisma } from '@prisma/client';
import { syncClientMonthly, CLIENT_PRODUCT_SELECT } from '@/lib/client-products';
import { planPriceCorrection, priceText, ProductPriceError, readPriceSnapshot } from './product-price';

/** Caller must wrap this in a Serializable transaction. No provider or receipt writes. */
export async function correctProductPrice(db: Prisma.TransactionClient, actorId: string, clientId: string, productId: string, input: Record<string, unknown>) {
  const actor = await db.user.findUnique({ where: { id: actorId }, select: { isOwner: true, role: true } });
  if (!actor?.isOwner || actor.role !== 'ADMIN') throw new ProductPriceError('Forbidden', 403);
  if (!Number.isSafeInteger(input.expectedVersion) || Number(input.expectedVersion) < 0) throw new ProductPriceError('נדרשת גרסת מחיר');
  const product = await db.clientProduct.findFirst({ where: { id: productId, clientId, archivedAt: null, client: { archivedAt: null } }, include: { client: { select: { monthlyAmount: true } } } });
  if (!product) throw new ProductPriceError('Not found', 404);
  if (input.expectedVersion !== product.monthlyPriceVersion) throw new ProductPriceError('המחיר השתנה; יש לטעון מחדש', 409);
  const before = readPriceSnapshot(product);
  let after, reason, source;
  let restoredFromId: string | null = null;
  if ('restoreRevisionId' in input) {
    if (typeof input.restoreRevisionId !== 'string') throw new ProductPriceError('Invalid revision');
    const revision = await db.clientProductPriceRevision.findFirst({ where: { id: input.restoreRevisionId, productId, version: product.monthlyPriceVersion } });
    if (!revision) throw new ProductPriceError('ניתן לבטל רק את השינוי האחרון', 409);
    after = readPriceSnapshot(revision.before);
    reason = priceText(input.reason, 'נדרשת סיבת שחזור');
    source = `Restore revision ${revision.id}`;
    restoredFromId = revision.id;
  } else {
    ({ after, reason, source } = planPriceCorrection(before, input));
  }
  const version = product.monthlyPriceVersion + 1;
  const updated = await db.clientProduct.updateMany({
    where: { id: productId, clientId, archivedAt: null, monthlyPriceVersion: product.monthlyPriceVersion },
    data: { ...after, monthlyPriceVersion: version },
  });
  if (updated.count !== 1) throw new ProductPriceError('המחיר השתנה; יש לטעון מחדש', 409);
  const monthlyAmount = await syncClientMonthly(clientId, db);
  await db.clientProductPriceRevision.create({ data: {
    productId, actorId, version, action: restoredFromId ? 'RESTORE' : 'CORRECT', reason, source, restoredFromId,
    // Retain old client rollups too: a pre-existing drift is evidence, even
    // though undo restores the product price and re-derives the rollup.
    before: { ...before, clientMonthlyAmount: product.client.monthlyAmount }, after: { ...after, clientMonthlyAmount: monthlyAmount },
  } });
  return { product: await db.clientProduct.findUniqueOrThrow({ where: { id: productId }, select: CLIENT_PRODUCT_SELECT }), monthlyAmount };
}
