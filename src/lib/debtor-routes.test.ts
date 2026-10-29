import assert from "node:assert/strict";
import test from "node:test";
import { loadRoute } from "./payments/route-harness";
import * as dismissal from "./debtor-dismissal";
import * as persistence from "./debtor-dismissal-store";

const current = { name: "Synthetic debtor", idNumber: "payer", amount: 100, attempts: 1, lastAttempt: "2026-10-25", responseCode: 4, reason: "Declined" };
const snapshot = { payer: current };
const history = { old: { name: "Historical synthetic", dismissedAt: "2025-01-01" } };
const authError = new Error("owner required");
const auth = (owner: boolean) => ({
  requireOwner: async () => { if (!owner) throw authError; },
  viewerErrorResponse: (error: unknown) => error === authError ? Response.json({ error: "Forbidden" }, { status: 403 }) : null,
});

function dismissRoute(input: { owner?: boolean; conflicts?: number } = {}) {
  let attempts = 0;
  let reads = 0;
  let writes = 0;
  const data: Record<string, unknown> = { cardcom_debtors_snapshot: snapshot, cardcom_debtors_dismissed: history };
  const route = loadRoute<{ POST(request: Request): Promise<Response> }>(new URL("../app/api/finance/debtors/dismiss/route.ts", import.meta.url), {
    "next/server": { NextResponse: Response },
    "@/lib/auth/viewer": auth(input.owner ?? true),
    "@/lib/debtor-dismissal": dismissal,
    "@/lib/debtor-dismissal-store": persistence,
    "@/lib/prisma": { prisma: { async $transaction(callback: (tx: unknown) => Promise<unknown>, options: { isolationLevel: string }) {
      attempts++;
      assert.equal(options.isolationLevel, "Serializable");
      if (attempts <= (input.conflicts ?? 0)) throw Object.assign(new Error("serialization conflict"), { code: "P2034" });
      return callback({ keyValue: {
        async findUnique({ where }: { where: { key: string } }) { reads++; return { value: data[where.key] }; },
        async upsert({ where, update }: { where: { key: string }; update: { value: unknown } }) { writes++; data[where.key] = update.value; },
      } });
    } } },
  });
  return { route, data, attempts: () => attempts, reads: () => reads, writes: () => writes };
}
const request = (body: unknown) => new Request("https://example.test/api/finance/debtors/dismiss", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

test("dismiss endpoint denies non-owners before any snapshot read or write", async () => {
  const env = dismissRoute({ owner: false });
  const response = await env.route.POST(request({ key: "payer", dismissed: true }));
  assert.equal(response.status, 403);
  assert.equal(env.attempts(), 0);
  assert.equal(env.reads(), 0);
  assert.equal(env.writes(), 0);
});

test("dismiss endpoint requires an explicit boolean/current hide key, rejects malformed JSON, and saves nothing", async () => {
  const env = dismissRoute();
  for (const body of [{ key: "payer" }, { key: "payer", dismissed: "true" }, { key: "missing", dismissed: true }, null]) {
    assert.equal((await env.route.POST(request(body))).status, 400);
  }
  const malformed = new Request("https://example.test", { method: "POST", body: "{" });
  assert.equal((await env.route.POST(malformed)).status, 400);
  assert.equal(env.writes(), 0);
});

test("dismiss endpoint retries serialization conflicts without losing historical hides", async () => {
  const env = dismissRoute({ conflicts: 1 });
  const response = await env.route.POST(request({ key: "payer", dismissed: true }));
  assert.equal(response.status, 200);
  assert.equal(env.attempts(), 2);
  assert.equal(env.writes(), 1);
  assert.deepEqual(Object.keys(env.data.cardcom_debtors_dismissed as object), ["old", "payer"]);
  assert.deepEqual(env.data.cardcom_debtors_snapshot, snapshot);
});

test("dismiss endpoint can restore an expired hidden key and preserves all other metadata", async () => {
  const env = dismissRoute();
  await env.route.POST(request({ key: "payer", dismissed: true }));
  assert.equal((await env.route.POST(request({ key: "old", dismissed: false }))).status, 200);
  assert.deepEqual(Object.keys(env.data.cardcom_debtors_dismissed as object), ["payer"]);
});

for (const owner of [false, true]) {
  test(`manual refresh ${owner ? "updates quietly for the owner" : "denies non-owners before provider I/O"}`, async () => {
    let scans = 0;
    const route = loadRoute<{ POST(): Promise<Response> }>(new URL("../app/api/finance/debtors/refresh/route.ts", import.meta.url), {
      "next/server": { NextResponse: Response },
      "@/lib/auth/viewer": auth(owner),
      "@/lib/cardcom-debtors": {
        async sweepTerminalFailures(_now: Date, summary: { debtors: number }, options: { notify?: boolean }) {
          scans++;
          assert.deepEqual(options, { notify: false });
          summary.debtors = 1;
          return snapshot;
        },
        async bucketDebtors(value: typeof snapshot) {
          assert.deepEqual(value, snapshot);
          return { terminalDebtors: [current], settledDebtors: [], dismissedDebtors: [] };
        },
      },
    });
    const response = await route.POST();
    assert.equal(response.status, owner ? 200 : 403);
    assert.equal(scans, owner ? 1 : 0);
    if (owner) assert.equal((await response.json()).terminalDebtors[0].amount, 100);
  });
}
