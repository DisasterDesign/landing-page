import assert from "node:assert/strict";
import test from "node:test";
import * as persistence from "./debtor-dismissal-store";
import type { DebtorDismissalStore } from "./debtor-dismissal-store";

const snapshot = { "payer-1": { name: "Current payer", idNumber: "payer-1", amount: 120, attempts: 1, lastAttempt: "2026-10-25", responseCode: 4, reason: "Declined" } };
const historical = { name: "Historical payer", dismissedAt: "2025-01-01" };
function store(fail = false) {
  const data: Record<string, unknown> = { cardcom_debtors_snapshot: snapshot, cardcom_debtors_dismissed: { old: historical } };
  let writes = 0;
  const db: DebtorDismissalStore = {
    async findUnique({ where }) { return data[where.key] ? { value: data[where.key] } : null; },
    async upsert({ where, update }) {
      writes++;
      if (fail) throw new Error("database unavailable");
      data[where.key] = update.value;
    },
  };
  return { db, data, writes: () => writes };
}

test("hide saves only visibility metadata and preserves every historical dismissal", async () => {
  const env = store();
  assert.equal((await persistence.persistDebtorDismissal({ key: "payer-1", dismissed: true }, env.db, new Date("2026-10-26T00:00:00Z"))).dismissedCount, 2);
  assert.deepEqual(env.data.cardcom_debtors_dismissed, { old: historical, "payer-1": { name: "Current payer", dismissedAt: "2026-10-26T00:00:00.000Z" } });
  assert.deepEqual(env.data.cardcom_debtors_snapshot, snapshot);
});

test("invalid bodies and unknown hide keys never write visibility metadata", async () => {
  const env = store();
  for (const body of [{ key: "payer-1" }, { key: "unknown", dismissed: true }, { key: "old", dismissed: true }]) {
    await assert.rejects(persistence.persistDebtorDismissal(body, env.db));
  }
  assert.equal(env.writes(), 0);
  assert.deepEqual(env.data.cardcom_debtors_dismissed, { old: historical });
});

test("an explicit historical restore deletes only that key, even after the snapshot expires", async () => {
  const env = store();
  await persistence.persistDebtorDismissal({ key: "payer-1", dismissed: true }, env.db);
  assert.equal((await persistence.persistDebtorDismissal({ key: "old", dismissed: false }, env.db)).dismissedCount, 1);
  assert.deepEqual(Object.keys(env.data.cardcom_debtors_dismissed as object), ["payer-1"]);
});

test("a failed metadata write rejects without claiming or mutating saved state", async () => {
  const env = store(true);
  await assert.rejects(persistence.persistDebtorDismissal({ key: "payer-1", dismissed: true }, env.db), /database unavailable/);
  assert.deepEqual(env.data.cardcom_debtors_dismissed, { old: historical });
});

test("restoration returns the latest settled snapshot even if the page holds an older open row", async () => {
  const env = store();
  env.data.cardcom_debtors_snapshot = { "payer-1": { ...snapshot["payer-1"], settledAt: "2026-10-26T09:00:00Z", settledAmount: 120 } };
  const result = await persistence.persistDebtorDismissal({ key: "payer-1", dismissed: false }, env.db);
  assert.deepEqual(result.debtor, { ...snapshot["payer-1"], settledAt: "2026-10-26T09:00:00Z", settledAmount: 120 });
});
