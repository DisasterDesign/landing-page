import { prisma } from "@/lib/prisma";
import { listFailedTransactions } from "@/lib/cardcom";
import { notifyAllAdmins } from "@/lib/notifications";

/**
 * Terminal-wide debt sweep — shared by the daily reconcile cron and the
 * on-demand refresh behind the debtors screen. Collapses the failed
 * transactions of the last 45 days into one row per debtor (collection
 * retries fire several times a week and each attempt bills the ACCUMULATED
 * debt, so the newest attempt per debtor is the current truth), diffs against
 * the previous snapshot, and alerts only on a new debtor or grown debt.
 */

export interface DebtorSnapshotEntry {
  name: string;
  idNumber: string | null;
  amount: number; // latest attempted amount = the accumulated debt
  attempts: number; // failed attempts in the window
  lastAttempt: string;
  responseCode: number;
  reason: string;
}

export const DEBTORS_SNAPSHOT_KEY = "cardcom_debtors_snapshot";

export async function sweepTerminalFailures(
  now: Date,
  summary: { debtors: number; newDebtorAlerts: number }
): Promise<Record<string, DebtorSnapshotEntry>> {
  const fromDate = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000);
  const failures = await listFailedTransactions({ fromDate, toDate: now });

  const byDebtor = new Map<string, DebtorSnapshotEntry>();
  for (const t of failures) {
    if (t.DealType && t.DealType !== "Debit") continue; // refunds etc. are not debt
    const key = t.CardOwnerIdentityNumber || t.CardOwnerName || `tx-${t.TranzactionId}`;
    const cur = byDebtor.get(key);
    const entry: DebtorSnapshotEntry = {
      name: t.CardOwnerName || key,
      idNumber: t.CardOwnerIdentityNumber ?? null,
      amount: t.Amount,
      attempts: (cur?.attempts ?? 0) + 1,
      lastAttempt: t.CreateDate,
      responseCode: t.ResponseCode,
      reason: t.IssuerAuthCodeDescription || t.Description || "",
    };
    // ListTransactions returns newest-first; keep the first-seen (= newest)
    // amount/date and just accumulate the attempt count.
    if (cur) {
      entry.amount = cur.amount;
      entry.lastAttempt = cur.lastAttempt;
      entry.responseCode = cur.responseCode;
      entry.reason = cur.reason;
    }
    byDebtor.set(key, entry);
  }

  summary.debtors = byDebtor.size;

  const prevRow = await prisma.keyValue.findUnique({ where: { key: DEBTORS_SNAPSHOT_KEY } });
  const prev = (prevRow?.value as Record<string, DebtorSnapshotEntry> | null) ?? {};

  for (const [key, d] of byDebtor) {
    const before = prev[key];
    // Alert on appearance and on growth — silence on the daily retries.
    if (!before) {
      summary.newDebtorAlerts++;
      await notifyAllAdmins({
        type: "AGREEMENT_SIGNED",
        title: `🚨 חייב חדש בקארדקום — ${d.name}`,
        body: `חוב ₪${d.amount} · ${d.reason || `קוד ${d.responseCode}`}`,
        url: "/admin/finance/debtors",
      });
    } else if (d.amount > before.amount) {
      summary.newDebtorAlerts++;
      await notifyAllAdmins({
        type: "AGREEMENT_SIGNED",
        title: `🚨 חוב גדל — ${d.name}`,
        body: `₪${before.amount} → ₪${d.amount} · ${d.reason || `קוד ${d.responseCode}`}`,
        url: "/admin/finance/debtors",
      });
    }
  }

  const snapshot = Object.fromEntries(byDebtor);
  await prisma.keyValue.upsert({
    where: { key: DEBTORS_SNAPSHOT_KEY },
    create: { key: DEBTORS_SNAPSHOT_KEY, value: snapshot as object },
    update: { value: snapshot as object },
  });

  return snapshot;
}
