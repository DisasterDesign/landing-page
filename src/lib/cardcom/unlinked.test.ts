import assert from "node:assert/strict";
import test from "node:test";

import { findUnlinkedOrders, summariseUnlinked } from "./unlinked";

const charges = [
  { accountId: 1036, payer: "yahalomi dekel", amount: 236, chargedAt: "2026-07-26" },
  { accountId: 1036, payer: "yahalomi dekel", amount: 236, chargedAt: "2026-06-26" },
  { accountId: 1021, payer: "ספיר אבוטבול", amount: 236, chargedAt: "2026-07-23" },
  { accountId: 1040, payer: "Barel Shai nechasim", amount: 118, chargedAt: "2026-07-16" },
  { accountId: 1008, payer: "Shir Kaplan", amount: 70, chargedAt: "2026-07-28" },
];

test("an order whose account is linked to a client is not reported", () => {
  const out = findUnlinkedOrders(charges, new Set([1008, 1021]));
  assert.deepEqual(
    out.map((o) => o.accountId),
    [1036, 1040],
  );
});

test("repeat charges collapse to one order carrying the latest amount", () => {
  const out = findUnlinkedOrders(
    [
      { accountId: 1036, payer: "x", amount: 200, chargedAt: "2026-06-26" },
      { accountId: 1036, payer: "x", amount: 236, chargedAt: "2026-07-26" },
    ],
    new Set(),
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].amount, 236);
  assert.equal(out[0].charges, 2);
  assert.equal(out[0].lastChargedAt, "2026-07-26");
});

test("charges with no account are ignored — they are one-offs, not standing orders", () => {
  // A quote or a manual charge has no recurring account behind it. Reporting
  // those would bury the real signal in noise every single day.
  //
  // Cardcom expresses "no account" as 0, not null — a manual charge came back
  // as AccountId 0 and was reported as an orphaned standing order on the first
  // dry run. Both spellings must be ignored.
  const out = findUnlinkedOrders(
    [
      { accountId: null, payer: "one-off", amount: 500, chargedAt: "2026-07-01" },
      { accountId: 0, payer: "manual charge", amount: 354, chargedAt: "2026-08-04" },
    ],
    new Set(),
  );
  assert.equal(out.length, 0);
});

test("the biggest unlinked order comes first — that is the one worth money", () => {
  const out = findUnlinkedOrders(charges, new Set());
  assert.deepEqual(
    out.map((o) => o.amount),
    [236, 236, 118, 70],
  );
});

test("nothing unlinked produces no alert", () => {
  const out = findUnlinkedOrders(charges, new Set([1036, 1021, 1040, 1008]));
  assert.equal(out.length, 0);
  assert.equal(summariseUnlinked(out), null);
});

test("the summary leads with the monthly total at stake", () => {
  const out = findUnlinkedOrders(charges, new Set([1008]));
  const s = summariseUnlinked(out);
  assert.ok(s);
  // 236 + 236 + 118
  assert.ok(s!.body.includes("590"));
  assert.ok(s!.body.includes("yahalomi dekel"));
  assert.equal(s!.title.includes("3"), true);
});

test("the summary names at most five orders, and says how many it left out", () => {
  const many = Array.from({ length: 8 }, (_, i) => ({
    accountId: 2000 + i,
    payer: `payer ${i}`,
    amount: 100 - i,
    chargedAt: "2026-07-01",
  }));
  const s = summariseUnlinked(findUnlinkedOrders(many, new Set()));
  assert.ok(s);
  assert.ok(s!.body.includes("payer 0"));
  assert.equal(s!.body.includes("payer 5"), false);
  assert.ok(s!.body.includes("ועוד 3"));
});
