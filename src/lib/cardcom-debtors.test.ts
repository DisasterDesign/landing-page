import assert from "node:assert/strict";
import test from "node:test";
import type { DebtorSnapshotEntry, TerminalDebtorSweepDependencies } from "./cardcom-debtors";
import * as debtorEvidence from "./cardcom-debtor-evidence";
import type { FailedTransaction } from "./cardcom";
import { loadRoute } from "./payments/route-harness";
import { partitionDebtors } from "./debtor-dismissal";

const { sweepTerminalFailures } = loadRoute<typeof import("./cardcom-debtors")>(new URL("./cardcom-debtors.ts", import.meta.url), {
  "@/lib/prisma": { prisma: {} }, "@/lib/cardcom": {}, "@/lib/notifications": {},
  "@/lib/debtor-dismissal": { partitionDebtors }, "./cardcom-debtor-evidence": debtorEvidence,
});

const now = new Date("2026-10-26T12:00:00Z");
const failed: FailedTransaction = { TranzactionId: 1, Amount: 120, CreateDate: "2026-10-25T10:00:00Z", CardOwnerName: "Test payer", CardOwnerIdentityNumber: "payer-1", ResponseCode: 4, Description: "Declined", DealType: "Debit" };
const previous: DebtorSnapshotEntry = { name: "Test payer", idNumber: "payer-1", amount: 100, attempts: 1, lastAttempt: "2026-10-24T10:00:00Z", responseCode: 4, reason: "Declined" };

function environment(input: { failures?: FailedTransaction[]; successes?: FailedTransaction[]; previous?: Record<string, DebtorSnapshotEntry>; alertBaseline?: Record<string, DebtorSnapshotEntry>; dismissed?: Record<string, { name: string; dismissedAt: string }> } = {}) {
  const ownerAlerts: Array<{ title: string; url?: string }> = [];
  let saved: Record<string, DebtorSnapshotEntry> | undefined;
  let reportSnapshot = input.previous ?? {};
  let alertBaseline = input.alertBaseline;
  const dependencies: TerminalDebtorSweepDependencies = {
    listFailedTransactions: async () => input.failures ?? [failed],
    listSuccessfulTransactions: async () => input.successes ?? [],
    loadSnapshot: async () => reportSnapshot,
    ensureAlertBaseline: async (initial) => { alertBaseline ??= initial; return alertBaseline; },
    saveAlertBaseline: async (snapshot) => { alertBaseline = snapshot; },
    loadDismissed: async () => input.dismissed ?? {},
    saveSnapshot: async (snapshot) => { saved = snapshot; reportSnapshot = snapshot; },
    notifyOwner: async (alert) => { ownerAlerts.push(alert); },
  };
  return { dependencies, ownerAlerts, saved: () => saved, baseline: () => alertBaseline };
}

test("manual quiet sweep updates the debt snapshot without any alert", async () => {
  const env = environment();
  const summary = { debtors: 0, newDebtorAlerts: 0, settled: 0 };
  const snapshot = await sweepTerminalFailures(now, summary, { notify: false }, env.dependencies);
  assert.equal(snapshot["payer-1"].amount, 120);
  assert.equal(env.saved()?.["payer-1"].amount, 120);
  assert.deepEqual(summary, { debtors: 1, newDebtorAlerts: 0, settled: 0 });
  assert.equal(env.ownerAlerts.length, 0);
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
  assert.equal(env.ownerAlerts.length, 0);
  assert.deepEqual(Object.keys(hidden), ["payer-1", "old"]);
  const unchanged = environment({ previous: { "payer-1": { ...previous, amount: 120 } } });
  await sweepTerminalFailures(now, { debtors: 0, newDebtorAlerts: 0 }, undefined, unchanged.dependencies);
  assert.deepEqual(unchanged.ownerAlerts, []);
});

test("later debits remain payment evidence and refunds cannot become settlement evidence", async () => {
  for (const payment of [
    { ...failed, TranzactionId: 2, CreateDate: "2026-10-26T10:00:00Z", ResponseCode: 0 },
    { ...failed, TranzactionId: 2, CreateDate: "2026-10-24T10:00:00Z", ResponseCode: 0 },
    { ...failed, TranzactionId: 2, CreateDate: "2026-10-26T10:00:00Z", ResponseCode: 0, DealType: "Credit" },
  ]) {
    const env = environment({ successes: [payment] });
    const summary = { debtors: 0, newDebtorAlerts: 0, settled: 0 };
    const snapshot = await sweepTerminalFailures(now, summary, { notify: false }, env.dependencies);
    const laterDebit = payment.CreateDate === "2026-10-26T10:00:00Z" && payment.DealType === "Debit";
    assert.equal(snapshot["payer-1"].settledAt, undefined);
    assert.equal(snapshot["payer-1"].laterPayment?.at, laterDebit ? payment.CreateDate : undefined);
    assert.equal(summary.debtors, 1);
  }
});


test("quiet refresh preserves a new debtor for the next scheduled owner alert, exactly once", async () => {
  const env = environment();
  await sweepTerminalFailures(now, { debtors: 0, newDebtorAlerts: 0 }, { notify: false }, env.dependencies);
  assert.equal(env.saved()?.["payer-1"].amount, 120);
  assert.equal(env.ownerAlerts.length, 0);
  const scheduled = { debtors: 0, newDebtorAlerts: 0 };
  await sweepTerminalFailures(now, scheduled, undefined, env.dependencies);
  assert.equal(scheduled.newDebtorAlerts, 1);
  const repeated = { debtors: 0, newDebtorAlerts: 0 };
  await sweepTerminalFailures(now, repeated, undefined, env.dependencies);
  assert.equal(repeated.newDebtorAlerts, 0);
  assert.equal(env.ownerAlerts.length, 1);
});

test("quiet refresh preserves grown debt for the next scheduled owner alert, exactly once", async () => {
  const env = environment({ previous: { "payer-1": previous } });
  for (let refresh = 0; refresh < 2; refresh++) {
    await sweepTerminalFailures(now, { debtors: 0, newDebtorAlerts: 0 }, { notify: false }, env.dependencies);
  }
  assert.equal(env.ownerAlerts.length, 0);
  const scheduled = { debtors: 0, newDebtorAlerts: 0 };
  await sweepTerminalFailures(now, scheduled, undefined, env.dependencies);
  assert.equal(scheduled.newDebtorAlerts, 1);
  const repeated = { debtors: 0, newDebtorAlerts: 0 };
  await sweepTerminalFailures(now, repeated, undefined, env.dependencies);
  assert.equal(repeated.newDebtorAlerts, 0);
  assert.equal(env.ownerAlerts.length, 1);
  assert.match(env.ownerAlerts[0].title, /חוב גדל/);
});

test("first quiet refresh seeds alert history from the pre-refresh report and never advances it", async () => {
  const env = environment({ previous: { "payer-1": previous } });
  await sweepTerminalFailures(now, { debtors: 0, newDebtorAlerts: 0 }, { notify: false }, env.dependencies);
  assert.equal(env.baseline()?.["payer-1"].amount, 100);
  assert.equal(env.saved()?.["payer-1"].amount, 120);
  await sweepTerminalFailures(now, { debtors: 0, newDebtorAlerts: 0 }, { notify: false }, env.dependencies);
  assert.equal(env.baseline()?.["payer-1"].amount, 100);
  assert.equal(env.ownerAlerts.length, 0);
});

test("quiet then scheduled scans keep dismissed debt silent but unmatched payment never hides an alert", async () => {
  const hidden = { "payer-1": { name: "Test payer", dismissedAt: "2026-01-01" }, old: { name: "Historical", dismissedAt: "2025-01-01" } };
  const hiddenEnv = environment({ dismissed: hidden });
  const settledEnv = environment({ successes: [{ ...failed, TranzactionId: 2, CreateDate: "2026-10-26T10:00:00Z", ResponseCode: 0 }] });
  for (const env of [hiddenEnv, settledEnv]) {
    await sweepTerminalFailures(now, { debtors: 0, newDebtorAlerts: 0 }, { notify: false }, env.dependencies);
    const scheduled = { debtors: 0, newDebtorAlerts: 0 };
    await sweepTerminalFailures(now, scheduled, undefined, env.dependencies);
    assert.equal(scheduled.newDebtorAlerts, env === hiddenEnv ? 0 : 1);
    assert.equal(env.ownerAlerts.length, env === hiddenEnv ? 0 : 1);
    assert.equal(env.baseline()?.["payer-1"].amount, 120);
  }
  assert.deepEqual(hidden, { "payer-1": { name: "Test payer", dismissedAt: "2026-01-01" }, old: { name: "Historical", dismissedAt: "2025-01-01" } });
});


test("a late quiet initialization cannot replace the baseline acknowledged by an overlapping scheduled scan", async () => {
  const reportKey = "cardcom_debtors_snapshot";
  const baselineKey = "cardcom_debtors_alert_baseline";
  const dismissed = { old: { name: "Historical", dismissedAt: "2025-01-01" } };
  const rows = new Map<string, unknown>([[reportKey, { "payer-1": previous }], ["cardcom_debtors_dismissed", dismissed]]);
  const ownerAlerts: unknown[] = [];
  const writtenKeys: string[] = [];
  let holdFirstInitialization = true;
  let enterInitialization!: () => void;
  const entered = new Promise<void>((resolve) => { enterInitialization = resolve; });
  let resumeInitialization!: () => void;
  const resume = new Promise<void>((resolve) => { resumeInitialization = resolve; });
  const actual = loadRoute<Pick<typeof import("./cardcom-debtors"), "sweepTerminalFailures">>(new URL("./cardcom-debtors.ts", import.meta.url), {
    "@/lib/cardcom": { listFailedTransactions: async () => [failed], listSuccessfulTransactions: async () => [] },
    "@/lib/notifications": { notifyOwner: async (alert: unknown) => { ownerAlerts.push(alert); } },
    "@/lib/debtor-dismissal": { partitionDebtors },
    "./cardcom-debtor-evidence": debtorEvidence,
    "@/lib/prisma": { prisma: { keyValue: {
      async findUnique({ where }: { where: { key: string } }) {
        return rows.has(where.key) ? { value: structuredClone(rows.get(where.key)) } : null;
      },
      async upsert({ where, create, update }: { where: { key: string }; create: { value: unknown }; update: { value?: unknown } }) {
        if (where.key === baselineKey && holdFirstInitialization) {
          holdFirstInitialization = false;
          enterInitialization();
          await resume;
        }
        writtenKeys.push(where.key);
        if (!rows.has(where.key)) rows.set(where.key, structuredClone(create.value));
        else if (Object.hasOwn(update, "value")) rows.set(where.key, structuredClone(update.value));
        return { value: structuredClone(rows.get(where.key)) };
      },
    } } },
  });
  // Quiet already read the old report, but its atomic create-only baseline
  // initialization reaches the store after the scheduled scan has finished.
  const quiet = actual.sweepTerminalFailures(now, { debtors: 0, newDebtorAlerts: 0 }, { notify: false });
  await entered;
  const scheduled = { debtors: 0, newDebtorAlerts: 0 };
  await actual.sweepTerminalFailures(now, scheduled);
  assert.equal(scheduled.newDebtorAlerts, 1);
  resumeInitialization();
  await quiet;
  assert.equal((rows.get(baselineKey) as Record<string, DebtorSnapshotEntry>)["payer-1"].amount, 120);
  const repeated = { debtors: 0, newDebtorAlerts: 0 };
  await actual.sweepTerminalFailures(now, repeated);
  assert.equal(repeated.newDebtorAlerts, 0);
  assert.equal(ownerAlerts.length, 1);
  assert.equal(writtenKeys.includes("cardcom_debtors_dismissed"), false);
  assert.deepEqual(rows.get("cardcom_debtors_dismissed"), dismissed);
});
