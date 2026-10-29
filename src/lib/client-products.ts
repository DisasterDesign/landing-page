import { FinanceAccessError } from "@/lib/finance/access";
import { prisma } from "@/lib/prisma";
import type { Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Client.monthlyAmount is a denormalised rollup of the client's active
 * products. Keeping it maintained (rather than making every reader JOIN and
 * SUM) is deliberate: the partner report, the finance page and the Cardcom
 * webhook all already read Client.monthlyAmount and are load-bearing for the
 * 50/50 profit split. Rewriting them to sum products would have put the
 * partnership money through a refactor to ship a table grouping.
 *
 * The trade is the usual denormalisation risk — drift. It is contained by
 * routing every product write through here, so there is exactly one writer.
 */
export async function syncClientMonthly(clientId: string, db: Db = prisma): Promise<number | null> {
  const products = await db.clientProduct.findMany({
    where: { clientId, archivedAt: null },
    select: { monthlyAmount: true, status: true },
  });

  // Only products marked "בוצע" bill. This mirrors the client-level rule the
  // partner report has always applied (status "בוצע" filter): a project that
  // has not started paying (ריק) or is mid-setup (חצי) carries its agreed
  // amount for reference but contributes nothing to MRR until flipped. An
  // active unvalued product makes the client ILS rollup unknown, never zero.
  // Without this, יוני's not-yet-billing admin system was counted as revenue.
  const total = products.some(p => p.status === "בוצע" && p.monthlyAmount === null) ? null :
    Math.round(
      products
        .filter((p) => p.status === "בוצע")
        .reduce((s, p) => s + (p.monthlyAmount ?? 0), 0) * 100
    ) / 100;

  await db.client.update({
    where: { id: clientId },
    data: { monthlyAmount: total },
  });

  return total;
}

/**
 * A verified payment landed for an agreement — reflect it on the product that
 * agreement covers, then re-derive the client rollup.
 *
 * Resolution order: the product explicitly linked to the agreement, else the
 * client's only unlinked product with the same finance book. A product linked
 * to another agreement is never reassigned. A multi-product client with no agreement link gets
 * NO product write — guessing which of יוני's sites a charge belongs to would
 * corrupt the per-product figures the rollup is built on.
 *
 * A product that takes a real charge is by definition billing, so it is also
 * flipped to "בוצע" and stamped with its first payment date as startDate —
 * this is what feeds the "MRR חדש לפי חודש" chart automatically from here on.
 */
export async function applyPaymentToProduct(
  db: Db,
  clientId: string,
  agreementId: string,
  grossMonthly: number,
  paidAt: Date
): Promise<void> {
  if (grossMonthly <= 0) return;

  const agreement = await db.agreement.findUnique({ where: { id: agreementId }, select: { financeBook: true } });
  const financeBook = agreement?.financeBook ?? "UNASSIGNED";
  const products = await db.clientProduct.findMany({
    where: { clientId, archivedAt: null },
    select: { id: true, agreementId: true, startDate: true, financeBook: true, monthlyPriceVersion: true },
  });

  const target =
    products.find((p) => p.agreementId === agreementId) ??
    (products.length === 1 && products[0].agreementId === null && products[0].financeBook === financeBook ? products[0] : null);

  if (target) {
    await db.clientProduct.updateMany({
      where: { id: target.id, clientId, archivedAt: null, financeBook, agreementId: target.agreementId, monthlyPriceVersion: target.monthlyPriceVersion ?? 0 },
      data: {
        ...(target.monthlyPriceVersion ? {} : { monthlyAmount: grossMonthly }),
        status: "בוצע",
        agreementId,
        ...(target.startDate ? {} : { startDate: paidAt }),
      },
    });
  } else if (products.length === 0) {
    // A client auto-created at signing is born with no products. Without this
    // branch the rollup below would pin its monthly at ₪0 right after its
    // first real payment — the product IS what just got paid for.
    const client = await db.client.findUnique({ where: { id: clientId }, select: { name: true } });
    await db.clientProduct.create({
      data: {
        clientId,
        financeBook,
        name: client?.name || "מנוי",
        monthlyAmount: grossMonthly,
        status: "בוצע",
        startDate: paidAt,
        agreementId,
      },
    });
  }

  await syncClientMonthly(clientId, db);
}

/** Shape the clients table and client card both render. */
export const CLIENT_PRODUCT_SELECT = {
  financeBook: true,
  id: true,
  name: true,
  websiteUrl: true,
  monthlyAmount: true,
  monthlyOriginalAmount: true,
  monthlyOriginalCurrency: true,
  monthlyPriceVersion: true,
  lane: true,
  status: true,
  startDate: true,
  paymentDate: true,
  agreementId: true,
  notes: true,
  createdAt: true,
} as const;

export function parseProductBody(body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};
  const num = (v: unknown) => (v !== null && v !== "" && v !== undefined ? parseFloat(String(v)) : null);
  const str = (v: unknown) => (v ? String(v).trim() || null : null);

  if ("name" in body) data.name = String(body.name ?? "").trim();
  if ("websiteUrl" in body) data.websiteUrl = str(body.websiteUrl);
  if ("monthlyAmount" in body) data.monthlyAmount = num(body.monthlyAmount);
  if ("lane" in body) {
    const v = String(body.lane ?? "").trim();
    data.lane = v === "bet" || v === "floor" ? v : null;
  }
  if ("status" in body) data.status = String(body.status ?? "");
  if ("notes" in body) data.notes = str(body.notes);
  if ("agreementId" in body) data.agreementId = str(body.agreementId);
  if ("startDate" in body) data.startDate = body.startDate ? new Date(String(body.startDate)) : null;
  if ("paymentDate" in body) data.paymentDate = body.paymentDate ? new Date(String(body.paymentDate)) : null;

  return data;
}

/** Call inside the agreement creation transaction so a failed claim rolls back the new agreement. */
export async function claimUnlinkedProductForAgreement(
 db: Db,
 input: { productId: string; clientId: string; financeBook: "PRIVATE" | "SHARED" | "UNASSIGNED"; agreementId: string },
): Promise<void> {
 const result = await db.clientProduct.updateMany({
  where: { id: input.productId, clientId: input.clientId, financeBook: input.financeBook, archivedAt: null, agreementId: null },
  data: { agreementId: input.agreementId },
 });
 if (result.count !== 1) throw new FinanceAccessError("המוצר כבר מקושר להסכם; יש ליצור מוצר חדש", 409);
}
