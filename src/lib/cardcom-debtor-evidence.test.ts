import assert from "node:assert/strict";
import test from "node:test";
import type { FailedTransaction } from "./cardcom";
import type { DebtorSnapshotEntry, TerminalDebtorSweepDependencies } from "./cardcom-debtors";
import { loadRoute } from "./payments/route-harness";
import { partitionDebtors } from "./debtor-dismissal";
import * as debtorEvidence from "./cardcom-debtor-evidence";

const now = new Date("2026-10-26T12:00:00Z");
const failure: FailedTransaction = { TranzactionId: 1001, AccountId: 701, RecurringId: 801, CoinId: 1, Amount: 120, CreateDate: "2026-10-25T10:00:00Z", CardOwnerName: "Synthetic payer", CardOwnerIdentityNumber: "synthetic-1", ResponseCode: 4, DealType: "Debit" };
const payment: FailedTransaction = { ...failure, TranzactionId: 1002, CreateDate: "2026-10-26T10:00:00Z", ResponseCode: 0 };

async function scan(failures: FailedTransaction[], successes: FailedTransaction[] = [], previous: Record<string, DebtorSnapshotEntry> = {}) {
  const actual = loadRoute<typeof import("./cardcom-debtors")>(new URL("./cardcom-debtors.ts", import.meta.url), {
    "@/lib/prisma": { prisma: {} }, "@/lib/cardcom": {}, "@/lib/notifications": {},
    "@/lib/debtor-dismissal": { partitionDebtors },
    "./cardcom-debtor-evidence": debtorEvidence,
  });
  const dependencies: TerminalDebtorSweepDependencies = {
    listFailedTransactions: async () => failures, listSuccessfulTransactions: async () => successes,
    loadSnapshot: async () => previous, ensureAlertBaseline: async (initial) => initial,
    loadDismissed: async () => ({}), saveSnapshot: async () => {}, saveAlertBaseline: async () => {}, notifyOwner: async () => {},
  };
  return actual.sweepTerminalFailures(now, { debtors: 0, newDebtorAlerts: 0 }, { notify: false }, dependencies);
}

test("partial, mismatched and payer-only later payments cannot close an obligation", async () => {
  for (const candidate of [
    { ...payment, Amount: 30 }, { ...payment, Amount: 121 },
    { ...payment, AccountId: 702 }, { ...payment, RecurringId: 802 },
    { ...payment, CoinId: 2 }, { ...payment, CoinId: undefined },
    { ...payment, AccountId: undefined, RecurringId: undefined },
  ]) {
    const row = (await scan([failure], [candidate]))["synthetic-1"];
    assert.equal(row.settledAt, undefined, JSON.stringify(candidate));
    assert.equal(row.laterPayment?.at, payment.CreateDate);
  }
  const payerOnly = { ...failure, AccountId: undefined, RecurringId: undefined };
  assert.equal((await scan([payerOnly], [payment]))["synthetic-1"].settledAt, undefined);
});

test("matched later evidence is retained separately and never proves billing-obligation settlement", async () => {
  const row = (await scan([failure], [payment, { ...payment, TranzactionId: 1003, Amount: 10, CreateDate: "2026-10-26T11:00:00Z" }]))["synthetic-1"];
  assert.equal(row.settledAt, undefined);
  assert.equal(row.settlementEvidence, "unverified");
  assert.equal(row.matchedLaterPayment?.at, payment.CreateDate);
  assert.equal(row.currency, "ILS");
  assert.equal(row.amountILS, 120);
});

test("a following monthly installment on the same order cannot prove the prior obligation paid", async () => {
  const row = (await scan([failure], [{ ...payment, CreateDate: "2026-11-25T10:00:00Z" }]))["synthetic-1"];
  assert.equal(row.settledAt, undefined);
  assert.equal(row.settlementEvidence, "unverified");
});

test("source-local provider timestamps retain chronological ordering without guessing a timezone", async () => {
  const older = { ...failure, CreateDate: "2026-10-24T21:00:52", Amount: 80 };
  const latest = { ...failure, CreateDate: "2026-10-25T21:00:52" };
  const row = (await scan([older, latest], [{ ...payment, CreateDate: "2026-10-26T21:00:52" }]))["synthetic-1"];
  assert.equal(row.lastAttempt, latest.CreateDate);
  assert.equal(row.chronologyStatus, "valid");
  assert.equal(row.matchedLaterPayment?.at, "2026-10-26T21:00:52");
  assert.equal(row.settledAt, undefined);
});

test("latest failure is chronological and independent of provider array order", async () => {
  const older = { ...failure, TranzactionId: 1000, Amount: 80, CreateDate: "2026-10-24T10:00:00Z" };
  for (const rows of [[older, failure], [failure, older]]) {
    const row = (await scan(rows))["synthetic-1"];
    assert.equal(row.amount, 120);
    assert.equal(row.lastAttempt, failure.CreateDate);
    assert.equal(row.attempts, 2);
  }
});

test("equal or invalid timestamps cannot prove settlement and ties cannot pick an arbitrary amount", async () => {
  for (const badDate of [failure.CreateDate, "not-a-date", "2026-02-30T10:00:00Z"]) {
    const row = (await scan([failure], [{ ...payment, CreateDate: badDate }]))["synthetic-1"];
    assert.equal(row.settledAt, undefined);
  }
  for (const rows of [
    [failure, { ...failure, TranzactionId: 1004, Amount: 150 }],
    [{ ...failure, TranzactionId: 1004, Amount: 150 }, failure],
    [failure, { ...failure, TranzactionId: 1004, CreateDate: "not-a-date" }],
  ]) {
    const row = (await scan(rows, [payment]))["synthetic-1"];
    assert.equal(row.settledAt, undefined);
    assert.notEqual(row.chronologyStatus, "valid");
  }
});

test("foreign and unknown currencies retain original amounts without an invented ILS valuation", async () => {
  for (const [tx, currency, amountILS] of [
    [{ ...failure, CoinId: 2 }, "USD", null],
    [{ ...failure, CoinId: undefined }, "UNKNOWN", null],
    [{ ...failure, CoinId: 2, AmountILS: 450 }, "USD", 450],
  ] as const) {
    const row = (await scan([tx]))["synthetic-1"];
    assert.equal(row.amount, 120);
    assert.equal(row.currency, currency);
    assert.equal(row.amountILS, amountILS);
  }
});

test("a payer with several obligations cannot be closed by paying only the newest one", async () => {
  const other = { ...failure, TranzactionId: 1005, AccountId: 702, RecurringId: 802, Amount: 90, CreateDate: "2026-10-24T10:00:00Z" };
  const row = (await scan([failure, other], [payment]))["synthetic-1"];
  assert.equal(row.settledAt, undefined);
  assert.equal(row.obligations?.length, 2);
});

test("tied failures on different accounts retain their own currency and an ambiguous latest attempt", async () => {
  const other = { ...failure, TranzactionId: 1005, AccountId: 702, RecurringId: 802, CoinId: 2 };
  for (const rows of [[failure, other], [other, failure]]) {
    const row = (await scan(rows))["synthetic-1"];
    assert.equal(row.currency, "USD");
    assert.equal(row.accountId, 702);
    assert.equal(row.chronologyStatus, "ambiguous");
    assert.equal(debtorEvidence.debtorIlsAmount(row), null);
  }
});

test("same-name payers cannot create matched obligation evidence without an identity number", async () => {
  const row = (await scan([{ ...failure, CardOwnerIdentityNumber: undefined }], [{ ...payment, CardOwnerIdentityNumber: undefined }]))["Synthetic payer"];
  assert.equal(row.matchedLaterPayment, undefined);
  assert.equal(row.settledAt, undefined);
});

test("a source-local payment and absolute-time failure cannot be compared as a later payment", async () => {
  const row = (await scan([failure], [{ ...payment, CreateDate: "2026-10-26T10:00:00" }]))["synthetic-1"];
  assert.equal(row.laterPayment, undefined);
  assert.equal(row.matchedLaterPayment, undefined);
});

test("an expired failure remains an unknown historical row instead of disappearing as zero debt", async () => {
  const previous: DebtorSnapshotEntry = { name: "Synthetic historical payer", idNumber: "synthetic-1", amount: 120, attempts: 2, lastAttempt: "2026-01-01T10:00:00Z", responseCode: 4, reason: "Declined" };
  const row = (await scan([], [], { "synthetic-1": previous }))["synthetic-1"];
  assert.ok(row);
  assert.equal(row.amount, 120);
  assert.equal(row.currency, "UNKNOWN");
  assert.equal(row.amountILS, null);
  assert.equal(row.coverageStatus, "outside_window");
});

test("legacy settledAt is unverified evidence when partitioning or restoring a stored row", () => {
  const legacy = { name: "Synthetic legacy payer", idNumber: "synthetic-1", amount: 120, attempts: 1, lastAttempt: failure.CreateDate, responseCode: 4, reason: "Declined", settledAt: payment.CreateDate, settledAmount: 120 };
  const lists = partitionDebtors({ "synthetic-1": legacy }, {});
  assert.equal(lists.settledDebtors.length, 0);
  assert.equal(lists.terminalDebtors.length, 1);
});
