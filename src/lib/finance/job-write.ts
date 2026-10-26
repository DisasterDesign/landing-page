import { FinanceAccessError } from "./access";

type ExistingJob = { status: string; paidAt: Date | null; closedAt: Date; amount: number; vatIncluded: boolean; cardcomFee: boolean };
type JobPatch = { status?: string; paidAt?: string | null; closedAt?: string; amount?: number; vatIncluded?: boolean; cardcomFee?: boolean };

/** A settled job is also its legacy receipt: monetary values and dates are immutable. */
export function jobPaymentUpdate(existing: ExistingJob, patch: JobPatch, now = new Date()): { status?: string; paidAt?: Date | null } {
  const settled = Boolean(existing.paidAt) || existing.status === "PAID";
  if (settled) {
    const monetaryChange = (["amount", "vatIncluded", "cardcomFee"] as const).some(key => patch[key] !== undefined && patch[key] !== existing[key]);
    const dateChange = (patch.paidAt !== undefined && (patch.paidAt ? new Date(patch.paidAt).getTime() : null) !== (existing.paidAt?.getTime() ?? null)) ||
      (patch.closedAt !== undefined && new Date(patch.closedAt).getTime() !== existing.closedAt.getTime());
    if (monetaryChange || dateChange || (patch.status !== undefined && patch.status !== "PAID")) throw new FinanceAccessError("לא ניתן לשנות נתונים כספיים של עבודה ששולמה; תיקון מחייב רישום כספי נפרד", 409);
  }
  const data: { status?: string; paidAt?: Date | null } = {};
  if (patch.paidAt !== undefined) {
    data.paidAt = patch.paidAt ? new Date(patch.paidAt) : null;
    data.status = patch.paidAt ? "PAID" : "PENDING";
  }
  if (patch.status !== undefined) {
    data.status = patch.status;
    if (patch.status === "PAID" && patch.paidAt === undefined && !settled) data.paidAt = now;
    if (patch.status === "PENDING") data.paidAt = null;
  }
  return data;
}
