import { prisma } from "@/lib/prisma";
import { listFailedTransactions, listSuccessfulTransactions } from "@/lib/cardcom";
import { notifyOwner } from "@/lib/notifications";
import { partitionDebtors, type DebtorLists } from "@/lib/debtor-dismissal";
import { buildDebtorSnapshot, isVerifiedSettlement, type DebtorPaymentEvidence, type DebtorObligation } from "./cardcom-debtor-evidence";

/** Terminal-wide failure evidence, with obligation matching before settlement. */

export interface DebtorSnapshotEntry {
  name: string;
  idNumber: string | null;
  amount: number; // latest observed attempt; not an aggregate across obligations
  attempts: number; // failed attempts in the window
  lastAttempt: string;
  responseCode: number;
  reason: string;
  currency?: string;
  amountILS?: number | null;
  accountId?: number | null;
  recurringId?: number | null;
  obligations?: DebtorObligation[];
  chronologyStatus?: "valid" | "ambiguous" | "invalid";
  coverageStatus?: "in_window" | "outside_window";
  settlementEvidence?: "verified" | "unverified";
  laterPayment?: DebtorPaymentEvidence;
  matchedLaterPayment?: DebtorPaymentEvidence;
  /** Legacy rows may have this field without verified settlement evidence. */
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

  // Retain rows outside the rolling window as historical, unvalued evidence.
  const reportBeforeRefresh = await dependencies.loadSnapshot();
  const snapshot = buildDebtorSnapshot(failures, successes, reportBeforeRefresh);
  const byDebtor = new Map(Object.entries(snapshot));
  const current = Object.values(snapshot).filter((row) => row.coverageStatus === "in_window");
  const settledCount = current.filter(isVerifiedSettlement).length;
  summary.debtors = current.length - settledCount;
  summary.settled = settledCount;

  // Quiet scans initialize, but never advance, the scheduled alert baseline.
  const prev = await dependencies.ensureAlertBaseline(reportBeforeRefresh);
  const dismissed = await dependencies.loadDismissed();

  for (const [key, d] of byDebtor) {
    if (options.notify === false) continue; // manual report refresh is quiet
    if (dismissed[key]) continue; // ruled irrelevant — never alert
    if (d.coverageStatus === "outside_window" || isVerifiedSettlement(d)) continue;
    const before = prev[key];
    // Alert on appearance and on growth — silence on the daily retries. A
    // debtor who settled and then failed again counts as new: `before` exists
    // but was settled, so the debt is genuinely back.
    if (!before || isVerifiedSettlement(before)) {
      summary.newDebtorAlerts++;
      await dependencies.notifyOwner({
        type: "AGREEMENT_SIGNED",
        title: `🚨 חייב חדש בקארדקום — ${d.name}`,
        body: `חוב ${d.amount} ${d.currency ?? "UNKNOWN"} · ${d.reason || `קוד ${d.responseCode}`}`,
        url: "/admin/finance/debtors",
      });
    } else if (d.currency === (before.currency ?? "UNKNOWN") && d.amount > before.amount) {
      summary.newDebtorAlerts++;
      await dependencies.notifyOwner({
        type: "AGREEMENT_SIGNED",
        title: `🚨 חוב גדל — ${d.name}`,
        body: `${before.amount} → ${d.amount} ${d.currency ?? "UNKNOWN"} · ${d.reason || `קוד ${d.responseCode}`}`,
        url: "/admin/finance/debtors",
      });
    }
  }

  await dependencies.saveSnapshot(snapshot);
  if (options.notify !== false) await dependencies.saveAlertBaseline(snapshot);

  return snapshot;
}
