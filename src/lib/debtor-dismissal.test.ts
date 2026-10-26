import assert from "node:assert/strict";
import test from "node:test";
import * as dismissal from "./debtor-dismissal";
import type { DebtorSnapshotEntry } from "./cardcom-debtors";

const open: DebtorSnapshotEntry = { name: "Test debtor", idNumber: "payer-1", amount: 120, attempts: 2, lastAttempt: "2026-10-25T10:00:00Z", responseCode: 4, reason: "Declined" };
const paid: DebtorSnapshotEntry = { ...open, settledAt: "2026-10-26T10:00:00Z", settledAmount: 120 };
const old = { name: "Historical hidden debtor", dismissedAt: "2025-01-01T00:00:00Z" };

test("dismissal requires an explicit boolean and a current snapshot key", () => {
  for (const body of [null, [], {}, { key: "payer-1" }, { key: "payer-1", dismissed: "true" }, { key: " ", dismissed: true }, { key: "unknown", dismissed: true }, { key: "toString", dismissed: true }]) {
    assert.throws(() => dismissal.validateDebtorDismissal(body, { "payer-1": open }, {}), /400|חובה|מפורש|נמצא/);
  }
  assert.deepEqual(dismissal.validateDebtorDismissal({ key: "payer-1", name: "Forged", dismissed: true }, { "payer-1": open }, {}), { key: "payer-1", dismissed: true, name: "Test debtor" });
});

test("restoration accepts a historical dismissed key after it leaves the snapshot", () => {
  assert.deepEqual(dismissal.validateDebtorDismissal({ key: "old", dismissed: false }, {}, { old }), { key: "old", dismissed: false, name: "Historical hidden debtor" });
  assert.throws(() => dismissal.validateDebtorDismissal({ key: "unknown", dismissed: false }, {}, { old }), /נמצא/);
});

test("hide and restore use payer keys rather than object identity and never duplicate rows", () => {
  const lists = { terminalDebtors: [{ ...open }], settledDebtors: [], dismissedDebtors: [] };
  const hidden = dismissal.moveDebtor(lists, open, true);
  assert.deepEqual(hidden.terminalDebtors, []);
  assert.deepEqual(hidden.dismissedDebtors, [open]);
  assert.deepEqual(dismissal.moveDebtor(hidden, { ...open }, true).dismissedDebtors, [open]);
  const restored = dismissal.moveDebtor(hidden, { ...open }, false);
  assert.deepEqual(restored.terminalDebtors, [open]);
  assert.deepEqual(restored.dismissedDebtors, []);
  assert.deepEqual(lists.terminalDebtors, [open]);
});

test("restoring a hidden paid debtor returns it to settled, never open debt", () => {
  const restored = dismissal.moveDebtor({ terminalDebtors: [], settledDebtors: [], dismissedDebtors: [paid] }, paid, false);
  assert.deepEqual(restored.terminalDebtors, []);
  assert.deepEqual(restored.settledDebtors, [paid]);
  assert.deepEqual(restored.dismissedDebtors, []);
});

test("a pending hide does not update state and duplicate key actions cannot race", async () => {
  let finish!: () => void;
  const saved = new Promise<void>((resolve) => { finish = resolve; });
  const guard = dismissal.createDebtorMutationGuard();
  let visible = true;
  const before = guard.snapshot();
  const hide = guard.run("payer-1", () => saved, () => { visible = false; });
  assert.equal(visible, true);
  assert.equal(guard.canCommit(guard.snapshot()), false);
  assert.equal(await guard.run("payer-1", async () => { throw new Error("duplicate request"); }, () => {}), false);
  finish();
  assert.equal(await hide, true);
  assert.equal(visible, false);
  assert.equal(guard.canCommit(before), false);
  assert.equal(guard.canCommit(guard.snapshot()), true);
});

test("a failed dismissal keeps the visible state and releases its lock for retry", async () => {
  const guard = dismissal.createDebtorMutationGuard();
  let commits = 0;
  await assert.rejects(guard.run("payer-1", async () => { throw new Error("offline"); }, () => { commits++; }), /offline/);
  assert.equal(commits, 0);
  assert.equal(await guard.run("payer-1", async () => {}, () => { commits++; }), true);
  assert.equal(commits, 1);
});

test("refreshes started during mutations cannot overwrite saved state even after completion", async () => {
  let finish!: () => void;
  const saved = new Promise<void>((resolve) => { finish = resolve; });
  const guard = dismissal.createDebtorMutationGuard();
  const hide = guard.run("payer-1", () => saved, () => {});
  const during = guard.snapshot();
  finish();
  await hide;
  assert.equal(guard.canCommit(during), false);
});

test("hidden history outside the scan remains discoverable without an invented amount or debt status", () => {
  const lists = dismissal.partitionDebtors({}, { old });
  assert.deepEqual(lists.dismissedDebtors, [{ key: "old", name: "Historical hidden debtor", idNumber: null, snapshotMissing: true }]);
  assert.deepEqual(lists.terminalDebtors, []);
  assert.deepEqual(lists.settledDebtors, []);
  const restored = dismissal.moveDebtor(lists, lists.dismissedDebtors[0], false);
  assert.deepEqual(restored, { terminalDebtors: [], settledDebtors: [], dismissedDebtors: [] });
});

test("current hidden rows keep their known settlement while expired rows expose only hide metadata", () => {
  const lists = dismissal.partitionDebtors({ "payer-1": paid }, { "payer-1": { name: "Test debtor", dismissedAt: "2026-01-01" }, old });
  assert.deepEqual(lists.dismissedDebtors, [paid, { key: "old", name: "Historical hidden debtor", idNumber: null, snapshotMissing: true }]);
  assert.deepEqual(lists.settledDebtors, []);
});

test("cancelling hide confirmation releases the key without persistence or a visible move", async () => {
  const guard = dismissal.createDebtorMutationGuard();
  let commits = 0;
  assert.equal(await guard.run("payer-1", async () => false, () => { commits++; }), false);
  assert.equal(commits, 0);
  assert.equal(guard.canCommit(guard.snapshot()), true);
});
