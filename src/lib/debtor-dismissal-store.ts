import type { DebtorSnapshotEntry } from "./cardcom-debtors";
import { validateDebtorDismissal, type DismissedDebtor, type DismissedDebtors } from "./debtor-dismissal";

const SNAPSHOT_KEY = "cardcom_debtors_snapshot";
const DISMISSED_KEY = "cardcom_debtors_dismissed";

export interface DebtorDismissalStore {
  findUnique(input: { where: { key: string } }): Promise<{ value: unknown } | null>;
  upsert(input: {
    where: { key: string };
    create: { key: string; value: DismissedDebtors };
    update: { value: DismissedDebtors };
  }): Promise<unknown>;
}

/** Run inside a serializable transaction so parallel saves preserve other keys. */
export async function persistDebtorDismissal(body: unknown, store: DebtorDismissalStore, now = new Date()): Promise<{ dismissedCount: number; debtor: DismissedDebtor }> {
  const [snapshotRow, dismissedRow] = await Promise.all([
    store.findUnique({ where: { key: SNAPSHOT_KEY } }),
    store.findUnique({ where: { key: DISMISSED_KEY } }),
  ]);
  const snapshot = (snapshotRow?.value ?? {}) as Record<string, DebtorSnapshotEntry>;
  const dismissed = { ...((dismissedRow?.value ?? {}) as DismissedDebtors) };
  const action = validateDebtorDismissal(body, snapshot, dismissed);
  if (action.dismissed) {
    // Preserve the original hide time on duplicate retries.
    if (!Object.hasOwn(dismissed, action.key)) {
      Object.defineProperty(dismissed, action.key, {
        value: { name: action.name, dismissedAt: now.toISOString() },
        enumerable: true, configurable: true, writable: true,
      });
    }
  } else delete dismissed[action.key];
  await store.upsert({
    where: { key: DISMISSED_KEY },
    create: { key: DISMISSED_KEY, value: dismissed },
    update: { value: dismissed },
  });
  return {
    dismissedCount: Object.keys(dismissed).length,
    debtor: Object.hasOwn(snapshot, action.key)
      ? snapshot[action.key]
      : { key: action.key, name: action.name, idNumber: null, snapshotMissing: true },
  };
}
