import type { DebtorSnapshotEntry } from "./cardcom-debtors";

export type DismissedDebtors = Record<string, { name: string; dismissedAt: string }>;
export interface HistoricalDismissedDebtor {
  key: string;
  name: string;
  idNumber: null;
  snapshotMissing: true;
}
export type DismissedDebtor = DebtorSnapshotEntry | HistoricalDismissedDebtor;
export interface DebtorLists {
  terminalDebtors: DebtorSnapshotEntry[];
  settledDebtors: DebtorSnapshotEntry[];
  dismissedDebtors: DismissedDebtor[];
}

export class DebtorDismissalError extends Error {
  readonly status = 400;
}

export function validateDebtorDismissal(
  body: unknown,
  snapshot: Record<string, DebtorSnapshotEntry>,
  dismissed: DismissedDebtors,
): { key: string; dismissed: boolean; name: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new DebtorDismissalError("key ובחירה מפורשת של dismissed חובה");
  }
  const input = body as Record<string, unknown>;
  const key = typeof input.key === "string" ? input.key.trim() : "";
  if (!key || typeof input.dismissed !== "boolean") {
    throw new DebtorDismissalError("key ובחירה מפורשת של dismissed חובה");
  }
  const current = Object.hasOwn(snapshot, key) ? snapshot[key] : undefined;
  const hidden = Object.hasOwn(dismissed, key) ? dismissed[key] : undefined;
  if (input.dismissed ? !current : !current && !hidden) {
    throw new DebtorDismissalError("החייב לא נמצא בדוח");
  }
  return { key, dismissed: input.dismissed, name: current?.name ?? hidden!.name };
}

export const debtorRowKey = (d: DismissedDebtor) => "key" in d ? d.key : d.idNumber || d.name;
export const hasDebtorSnapshot = (d: DismissedDebtor): d is DebtorSnapshotEntry => !("snapshotMissing" in d);

export function partitionDebtors(snapshot: Record<string, DebtorSnapshotEntry>, dismissed: DismissedDebtors): DebtorLists {
  const all = Object.values(snapshot).sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0));
  const hidden = (d: DebtorSnapshotEntry) => Object.hasOwn(dismissed, debtorRowKey(d));
  const visible = all.filter((d) => !hidden(d));
  const history: HistoricalDismissedDebtor[] = Object.entries(dismissed)
    .filter(([key]) => !Object.hasOwn(snapshot, key))
    .map(([key, value]) => ({ key, name: value.name, idNumber: null, snapshotMissing: true }));
  return {
    terminalDebtors: visible.filter((d) => !d.settledAt),
    settledDebtors: visible.filter((d) => d.settledAt).sort((a, b) => (b.settledAt ?? "").localeCompare(a.settledAt ?? "")),
    dismissedDebtors: [...all.filter(hidden), ...history],
  };
}

/** Move only after persistence, removing stale object copies by their payer key. */
export function moveDebtor(lists: DebtorLists, debtor: DismissedDebtor, dismissed: boolean): DebtorLists {
  const key = debtorRowKey(debtor);
  const result: DebtorLists = {
    terminalDebtors: lists.terminalDebtors.filter((d) => debtorRowKey(d) !== key),
    settledDebtors: lists.settledDebtors.filter((d) => debtorRowKey(d) !== key),
    dismissedDebtors: lists.dismissedDebtors.filter((d) => debtorRowKey(d) !== key),
  };
  if (dismissed) result.dismissedDebtors.push(debtor);
  else if (hasDebtorSnapshot(debtor) && debtor.settledAt) result.settledDebtors.push(debtor);
  else if (hasDebtorSnapshot(debtor)) result.terminalDebtors.push(debtor);
  result.terminalDebtors.sort((a, b) => b.amount - a.amount);
  result.settledDebtors.sort((a, b) => (b.settledAt ?? "").localeCompare(a.settledAt ?? ""));
  return result;
}

/** Serializes each payer's actions and prevents an older refresh undoing a save. */
export function createDebtorMutationGuard(onPendingChange: (keys: string[]) => void = () => {}) {
  const pending = new Set<string>();
  let revision = 0;
  return {
    snapshot: () => revision,
    canCommit: (snapshot: number) => pending.size === 0 && snapshot === revision,
    async run(key: string, persist: () => Promise<void | boolean>, commit: () => void): Promise<boolean> {
      if (pending.has(key)) return false;
      pending.add(key);
      revision++;
      onPendingChange([...pending]);
      try {
        if (await persist() === false) return false;
        commit();
        return true;
      } finally {
        pending.delete(key);
        revision++;
        onPendingChange([...pending]);
      }
    },
  };
}
