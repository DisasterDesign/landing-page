import assert from "node:assert/strict";
import test from "node:test";
import { sweepTerminalFailures, type DebtorSnapshotEntry, type TerminalDebtorSweepDependencies } from "./cardcom-debtors";
import type { FailedTransaction } from "./cardcom";

const now = new Date("2026-10-26T12:00:00Z");
const failed: FailedTransaction = { TranzactionId: 1, Amount: 120, CreateDate: "2026-10-25T10:00:00Z", CardOwnerName: "Test payer", CardOwnerIdentityNumber: "payer-1", ResponseCode: 4, Description: "Declined", DealType: "Debit" };
const previous: DebtorSnapshotEntry = { name: "Test payer", idNumber: "payer-1", amount: 100, attempts: 1, lastAttempt: "2026-10-24T10:00:00Z", responseCode: 4, reason: "Declined" };

function environment(input: { failures?: FailedTransaction[]; successes?: FailedTransaction[]; previous?: Record<string, DebtorSnapshotEntry>; dismissed?: Record<string, { name: string; dismissedAt: string }> } = {}) {
  const ownerAlerts: Array<{ title: string; url?: string }> = [];
  let saved: Record<string, DebtorSnapshotEntry> | undefined;
  const dependencies: TerminalDebtorSweepDependencies = {
    listFailedTransactions: async () => input.failures ?? [failed],
    listSuccessfulTransactions: async () => input.successes ?? [],
    loadSnapshot: async () => input.previous ?? {},
    loadDismissed: async () => input.dismissed ?? {},
    saveSnapshot: async (snapshot) => { saved = snapshot; },
    notifyOwner: async (alert) => { ownerAlerts.push(alert); },
  };
  return { dependencies, ownerAlerts, saved: () => saved };
}

test("manual quiet sweep updates the debt snapshot without any alert", async () => {
  const env = environment();
  const summary = { debtors: 0, newDebtorAlerts: 0, settled: 0 };
  const snapshot = await sweepTerminalFailures(now, summary, { notify: false }, env.dependencies);
  assert.equal(snapshot["payer-1"].amount, 120);
  assert.equal(env.saved()?.["payer-1"].amount, 120);
  assert.deepEqual(summary, { debtors: 1, newDebtorAlerts: 0, settled: 0 });
  assert.deepEqual(env.ownerAlerts, []);
});

test("scheduled sweeps default to owner-only alerts for new and grown debt", async () => {
  const snapshots: Record<string, DebtorSnapshotEntry>[] = [{}, { "payer-1": previous }];
  for (const before of snapshots) {
    const env = environment({ previous: before });
    const summary = { debtors: 0, newDebtorAlerts: 0 };
    await sweepTerminalFailures(now, summary, undefined, env.dependencies);
    assert.equal(summary.newDebtorAlerts, 1);
    assert.equal(env.ownerAlerts.length, 1);
    assert.equal(env.ownerAlerts[0].url, "/admin/finance/debtors");
  }
});

test("scheduled retries and existing hidden debtors stay silent without changing dismissals", async () => {
  const hidden = { "payer-1": { name: "Test payer", dismissedAt: "2026-01-01T00:00:00Z" }, old: { name: "Historical", dismissedAt: "2025-01-01T00:00:00Z" } };
  const env = environment({ dismissed: hidden });
  const summary = { debtors: 0, newDebtorAlerts: 0 };
  await sweepTerminalFailures(now, summary, undefined, env.dependencies);
  assert.deepEqual(env.ownerAlerts, []);
  assert.deepEqual(Object.keys(hidden), ["payer-1", "old"]);
  const unchanged = environment({ previous: { "payer-1": { ...previous, amount: 120 } } });
  await sweepTerminalFailures(now, { debtors: 0, newDebtorAlerts: 0 }, undefined, unchanged.dependencies);
  assert.deepEqual(unchanged.ownerAlerts, []);
});

test("settlement still requires a debit after the latest failure; refunds cannot close debt", async () => {
  for (const payment of [
    { ...failed, TranzactionId: 2, CreateDate: "2026-10-26T10:00:00Z", ResponseCode: 0 },
    { ...failed, TranzactionId: 2, CreateDate: "2026-10-24T10:00:00Z", ResponseCode: 0 },
    { ...failed, TranzactionId: 2, CreateDate: "2026-10-26T10:00:00Z", ResponseCode: 0, DealType: "Credit" },
  ]) {
    const env = environment({ successes: [payment] });
    const summary = { debtors: 0, newDebtorAlerts: 0, settled: 0 };
    const snapshot = await sweepTerminalFailures(now, summary, { notify: false }, env.dependencies);
    const paid = payment.CreateDate === "2026-10-26T10:00:00Z" && payment.DealType === "Debit";
    assert.equal(snapshot["payer-1"].settledAt, paid ? "2026-10-26T10:00:00Z" : undefined);
    assert.equal(summary.debtors, paid ? 0 : 1);
  }
});
