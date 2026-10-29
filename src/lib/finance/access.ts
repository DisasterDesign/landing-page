import type { FinanceBook, Prisma } from "@prisma/client";
import type { Viewer } from "@/lib/auth/viewer";

export class FinanceAccessError extends Error {
  readonly status: 403 | 409;
  constructor(message = "Forbidden", status: 403 | 409 = 403) {
    super(message);
    this.name = "FinanceAccessError";
    this.status = status;
  }
}
export function canReadFinanceBook(viewer: Viewer, book: unknown): boolean {
  return viewer.isOwner || (book === "SHARED" && (viewer.role === "ADMIN" || viewer.role === "SELLER"));
}
export function requireFinanceBookAccess(viewer: Viewer, book: unknown): void {
  if (!canReadFinanceBook(viewer, book)) throw new FinanceAccessError();
}
export function requireBookSelection(viewer: Viewer, requested: unknown, fallback: FinanceBook): FinanceBook {
  if (requested !== undefined) {
    if (!viewer.isOwner) throw new FinanceAccessError();
    if (requested !== "PRIVATE" && requested !== "SHARED") throw new FinanceAccessError("Invalid finance book");
    return requested;
  }
  requireFinanceBookAccess(viewer, fallback);
  return fallback;
}
export function requireUnpaidBookChange(existing: FinanceBook, next: FinanceBook, hasPayments: boolean): void {
  if (existing !== next && hasPayments) throw new FinanceAccessError("לא ניתן לשנות שיוך של רשומה ששולמה; יש ליצור עסקה או מוצר חדש", 409);
}
export function financeAgreementScope(viewer: Viewer): Prisma.AgreementWhereInput {
  if (viewer.isOwner) return {};
  if (viewer.role === "ADMIN") return { financeBook: "SHARED" };
  if (viewer.role !== "SELLER") return { id: { in: [] } };
  return { financeBook: "SHARED", OR: [{ partnerId: viewer.userId }, { partnerId: null, creditedSellerId: viewer.userId }, { lead: { ownerId: viewer.userId, migrationReviewRequired: false } }] };
}
export function financeProductScope(viewer: Viewer): Prisma.ClientProductWhereInput {
  if (viewer.isOwner) return {};
  return { financeBook: "SHARED", ...(viewer.role === "ADMIN" ? {} : { client: { ownerId: viewer.userId } }) };
}
export function financeClientScope(viewer: Viewer): Prisma.ClientWhereInput {
  if (viewer.isOwner) return {};
  return { ...(viewer.role === "ADMIN" ? {} : { ownerId: viewer.userId }), OR: [{ products: { some: { financeBook: "SHARED" } } }, { agreements: { some: { financeBook: "SHARED" } } }, { jobs: { some: { financeBook: "SHARED" } } }] };
}
export function financeExpenseScope(viewer: Viewer): Prisma.ExpenseWhereInput {
  if (viewer.isOwner) return {};
  return viewer.role === "ADMIN" ? { financeBook: "SHARED", OR: [{ sharedBasisPoints: null }, { sharedBasisPoints: 10000 }] } : { id: { in: [] } };
}
/** Client-level financial columns aggregate ALL products and are never safe on a mixed identity. */
export function redactFinanceClient<T extends Record<string, unknown>>(viewer: Viewer, client: T): T {
  if (viewer.isOwner) return client;
  const result: Record<string, unknown> = { ...client };
  for (const key of ["amount", "expense", "cardcomFee", "partner", "notes", "clientNotes", "cardcomAccountId", "cardcomAccountIds", "paymentDate", "startDate"]) delete result[key];
  for (const key of ["products", "agreements", "jobs", "expenses"]) {
    if (Array.isArray(result[key])) result[key] = (result[key] as Record<string, unknown>[]).filter(row => row.financeBook === "SHARED");
  }
  const products = (result.products ?? []) as { monthlyAmount?: number | null; status?: string }[];
  const active = products.filter(p => p.status === "בוצע");
  result.monthlyAmount = active.some(p => p.monthlyAmount == null) ? null : Math.round(active.reduce((sum, p) => sum + (p.monthlyAmount ?? 0), 0) * 100) / 100;
  return result as T;
}

export function redactFinanceAgreement<T extends Record<string, unknown>>(viewer: Viewer, agreement: T): T {
  if (viewer.isOwner) return agreement;
  const result: Record<string, unknown> = { ...agreement };
  for (const key of Object.keys(result)) if (key.startsWith("cardcom") || ["signatureData", "signedIp", "signedUserAgent", "paymentId", "archivedById", "archiveReason"].includes(key)) delete result[key];
  if (result.client && typeof result.client === "object") result.client = { id: (result.client as Record<string, unknown>).id, name: (result.client as Record<string, unknown>).name };
  return result as T;
}
