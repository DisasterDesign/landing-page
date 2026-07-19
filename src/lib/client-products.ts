import { prisma } from "@/lib/prisma";

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
export async function syncClientMonthly(clientId: string): Promise<number> {
  const products = await prisma.clientProduct.findMany({
    where: { clientId, archivedAt: null },
    select: { monthlyAmount: true },
  });

  // Round to agora — floats sum badly and this figure drives the profit split.
  const total = Math.round(products.reduce((s, p) => s + (p.monthlyAmount ?? 0), 0) * 100) / 100;

  await prisma.client.update({
    where: { id: clientId },
    data: { monthlyAmount: total },
  });

  return total;
}

/** Shape the clients table and client card both render. */
export const CLIENT_PRODUCT_SELECT = {
  id: true,
  name: true,
  websiteUrl: true,
  monthlyAmount: true,
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
