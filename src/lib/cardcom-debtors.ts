import { prisma } from "@/lib/prisma";
import { listFailedTransactions, listSuccessfulTransactions } from "@/lib/cardcom";
import { notifyOwner } from "@/lib/notifications";
import { partitionDebtors, type DebtorLists } from "@/lib/debtor-dismissal";

/**
 * Terminal-wide debt sweep — shared by the daily reconcile cron and the
 * on-demand refresh behind the debtors screen. Collapses the failed
 * transactions of the last 45 days into one row per debtor (collection
 * retries fire several times a week and each attempt bills the ACCUMULATED
 * debt, so the newest attempt per debtor is the current truth), diffs against
 * the last scheduled alert baseline, and alerts only on a new debtor or grown debt.
 *
 * Failures alone can only ever ADD debtors, so the sweep also pulls the
 * SUCCESSFUL transactions of the same window and marks a debtor settled once
 * a payment lands AFTER their last failed attempt. Ordering is the whole
 * rule: אלי אלוני and Yoni Levi both have successes in the window that are
 * OLDER than their latest failures — they are still debtors. Only a payment
 * that post-dates the last failure clears the row.
 */

export interface DebtorSnapshotEntry {
  name: string;
  idNumber: string | null;
  amount: number; // latest attempted amount = the accumulated debt
  attempts: number; // failed attempts in the window
  lastAttempt: string;
  responseCode: number;
  reason: string;
  /** Payment date that post-dates lastAttempt — the debt is closed. */
  settledAt?: string;
  /** Amount of that payment (may differ from the last attempted debt). */
  settledAmount?: number;
}

export const DEBTORS_SNAPSHOT_KEY = "cardcom_debtors_snapshot";
// A quiet report refresh must not acknowledge new/grown debt for the cron.
export const DEBTORS_ALERT_BASELINE_KEY = "cardcom_debtors_alert_baseline";
// key → { name, dismissedAt }. A dismissed debtor stays in the snapshot (it
// is still the truth at Cardcom) but is hidden from the main list and never
// alerts — for debt rows Elad has ruled irrelevant (old test cards, customers
// billed through a different card).
export const DEBTORS_DISMISSED_KEY = "cardcom_debtors_dismissed";

export async function getDismissedDebtors(): Promise<Record<string, { name: string; dismissedAt: string }>> {
  const row = await prisma.keyValue.findUnique({ where: { key: DEBTORS_DISMISSED_KEY } });
  return (row?.value as Record<string, { name: string; dismissedAt: string }> | null) ?? {};
}

/** The snapshot key of a debtor entry — mirrors the sweep's grouping key. */
export function debtorKey(d: { idNumber: string | null; name: string }): string {
  return d.idNumber || d.name;
}

/**
 * Split a snapshot into the three lists the debtors screen renders. Shared by
 * the read route and the refresh route so both can never disagree about what
 * counts as an open debt.
 */
export async function bucketDebtors(snapshot: Record<string, DebtorSnapshotEntry>): Promise<DebtorLists> {
  return partitionDebtors(snapshot, await getDismissedDebtors());
}

/** Grouping key — an identity number when Cardcom has one, else the name. */
function txKey(t: {
  CardOwnerIdentityNumber?: string;
  CardOwnerName?: string;
  TranzactionId: number;
}): string {
  return t.CardOwnerIdentityNumber || t.CardOwnerName || `tx-${t.TranzactionId}`;
}

export interface TerminalDebtorSweepDependencies {
  listFailedTransactions: typeof listFailedTransactions;
  listSuccessfulTransactions: typeof listSuccessfulTransactions;
  loadSnapshot(): Promise<Record<string, DebtorSnapshotEntry>>;
  ensureAlertBaseline(initial: Record<string, DebtorSnapshotEntry>): Promise<Record<string, DebtorSnapshotEntry>>;
  saveAlertBaseline(snapshot: Record<string, DebtorSnapshotEntry>): Promise<void>;
  loadDismissed: typeof getDismissedDebtors;
  saveSnapshot(snapshot: Record<string, DebtorSnapshotEntry>): Promise<void>;
  notifyOwner: typeof notifyOwner;
}

const sweepDependencies: TerminalDebtorSweepDependencies = {
  listFailedTransactions,
  listSuccessfulTransactions,
  async loadSnapshot() {
    const row = await prisma.keyValue.findUnique({ where: { key: DEBTORS_SNAPSHOT_KEY } });
    return (row?.value as Record<string, DebtorSnapshotEntry> | null) ?? {};
  },
  async ensureAlertBaseline(initial) {
    // Create only: a late quiet scan must never replace a baseline already
    // initialized or advanced by another scan. Return the winning row.
    const row = await prisma.keyValue.upsert({
      where: { key: DEBTORS_ALERT_BASELINE_KEY },
      create: { key: DEBTORS_ALERT_BASELINE_KEY, value: initial as object },
      update: {},
    });
    return (row.value as Record<string, DebtorSnapshotEntry> | null) ?? {};
  },
  async saveAlertBaseline(snapshot) {
    await prisma.keyValue.upsert({
      where: { key: DEBTORS_ALERT_BASELINE_KEY },
      create: { key: DEBTORS_ALERT_BASELINE_KEY, value: snapshot as object },
      update: { value: snapshot as object },
    });
  },
  loadDismissed: getDismissedDebtors,
  async saveSnapshot(snapshot) {
    await prisma.keyValue.upsert({
      where: { key: DEBTORS_SNAPSHOT_KEY },
      create: { key: DEBTORS_SNAPSHOT_KEY, value: snapshot as object },
      update: { value: snapshot as object },
    });
  },
  notifyOwner,
};

export async function sweepTerminalFailures(
  now: Date,
  summary: { debtors: number; newDebtorAlerts: number; settled?: number },
  options: { notify?: boolean } = {},
  dependencies: TerminalDebtorSweepDependencies = sweepDependencies,
): Promise<Record<string, DebtorSnapshotEntry>> {
  const fromDate = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000);
  const [failures, successes] = await Promise.all([
    dependencies.listFailedTransactions({ fromDate, toDate: now }),
    dependencies.listSuccessfulTransactions({ fromDate, toDate: now }),
  ]);

  // Newest successful debit per payer — the settlement candidate.
  const latestPayment = new Map<string, { at: string; amount: number }>();
  for (const t of successes) {
    if (t.DealType && t.DealType !== "Debit") continue; // refunds are not payments
    const key = txKey(t);
    const cur = latestPayment.get(key);
    if (!cur || t.CreateDate > cur.at) {
      latestPayment.set(key, { at: t.CreateDate, amount: t.Amount });
    }
  }

  const byDebtor = new Map<string, DebtorSnapshotEntry>();
  for (const t of failures) {
    if (t.DealType && t.DealType !== "Debit") continue; // refunds etc. are not debt
    const key = txKey(t);
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

  // Settle: a payment that post-dates the last failed attempt closes the debt.
  // A NaN date fails the comparison, which leaves the row a debtor — the safe
  // direction to fail in.
  let settledCount = 0;
  for (const d of byDebtor.values()) {
    const paid = latestPayment.get(debtorKey(d));
    if (paid && Date.parse(paid.at) > Date.parse(d.lastAttempt)) {
      d.settledAt = paid.at;
      d.settledAmount = paid.amount;
      settledCount++;
    }
  }

  summary.debtors = byDebtor.size - settledCount;
  summary.settled = settledCount;

  // On first use, retain the PRE-refresh report as the migration baseline.
  // Quiet scans can initialize it, but only scheduled scans acknowledge debt.
  const reportBeforeRefresh = await dependencies.loadSnapshot();
  const prev = await dependencies.ensureAlertBaseline(reportBeforeRefresh);
  const dismissed = await dependencies.loadDismissed();

  for (const [key, d] of byDebtor) {
    if (options.notify === false) continue; // manual report refresh is quiet
    if (dismissed[key]) continue; // ruled irrelevant — never alert
    if (d.settledAt) continue; // paid — nothing to chase
    const before = prev[key];
    // Alert on appearance and on growth — silence on the daily retries. A
    // debtor who settled and then failed again counts as new: `before` exists
    // but was settled, so the debt is genuinely back.
    if (!before || before.settledAt) {
      summary.newDebtorAlerts++;
      await dependencies.notifyOwner({
        type: "AGREEMENT_SIGNED",
        title: `🚨 חייב חדש בקארדקום — ${d.name}`,
        body: `חוב ₪${d.amount} · ${d.reason || `קוד ${d.responseCode}`}`,
        url: "/admin/finance/debtors",
      });
    } else if (d.amount > before.amount) {
      summary.newDebtorAlerts++;
      await dependencies.notifyOwner({
        type: "AGREEMENT_SIGNED",
        title: `🚨 חוב גדל — ${d.name}`,
        body: `₪${before.amount} → ₪${d.amount} · ${d.reason || `קוד ${d.responseCode}`}`,
        url: "/admin/finance/debtors",
      });
    }
  }

  const snapshot = Object.fromEntries(byDebtor);
  await dependencies.saveSnapshot(snapshot);
  if (options.notify !== false) await dependencies.saveAlertBaseline(snapshot);

  return snapshot;
}
