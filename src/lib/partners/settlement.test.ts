import assert from "node:assert/strict";
import test from "node:test";

import { computeSettlement, monthlyIlsOf } from "./settlement";

/**
 * The 12.8.2026 partnership model: Fuzion profit = net revenue (after VAT +
 * Cardcom) minus SHARED expenses, split 50/50 between Elad and Roy. Elad's
 * personal book — revenue AND its expenses — stays entirely out.
 *
 * All revenue lands in Elad's account (Cardcom terminal), so the monthly
 * transfer to Roy is his half of the profit PLUS whatever shared expenses he
 * paid out of his own pocket.
 */

const revenue = {
  fuzionNetRevenue: 4000, // after VAT + Cardcom fee, from the existing report
};

test("the transfer is half the profit plus what Roy already paid", () => {
  const s = computeSettlement({
    ...revenue,
    expenses: [
      { amountIls: 600, paidBy: "owner", shared: true },
      { amountIls: 400, paidBy: "partner", shared: true },
    ],
  });
  // profit = 4000 - 1000 = 3000; Roy's half = 1500; he already spent 400.
  assert.equal(s.sharedExpenses, 1000);
  assert.equal(s.profit, 3000);
  assert.equal(s.royEntitlement, 1500);
  assert.equal(s.transferToRoy, 1900);
});

test("the arithmetic leaves both partners with exactly half the profit", () => {
  const s = computeSettlement({
    fuzionNetRevenue: 5000,
    expenses: [
      { amountIls: 1200, paidBy: "owner", shared: true },
      { amountIls: 800, paidBy: "partner", shared: true },
    ],
  });
  // Elad holds 5000, paid 1200, transfers s.transferToRoy.
  const eladEndsWith = 5000 - 1200 - s.transferToRoy;
  const royEndsWith = s.transferToRoy - 800;
  assert.equal(eladEndsWith, s.profit / 2);
  assert.equal(royEndsWith, s.profit / 2);
});

test("GUARD: a personal-book expense never enters the shared pool", () => {
  // A Hetzner server that runs a personal client's site is Elad's own cost.
  // If it leaked into the pool, Roy would be funding Elad's private book.
  const s = computeSettlement({
    ...revenue,
    expenses: [
      { amountIls: 500, paidBy: "owner", shared: false },
      { amountIls: 300, paidBy: "owner", shared: true },
    ],
  });
  assert.equal(s.sharedExpenses, 300);
  assert.equal(s.personalExpenses, 500);
  assert.equal(s.profit, 3700);
});

test("GUARD: Roy paying a non-shared expense is not reimbursed through the split", () => {
  // Should not happen in practice, but if a personal expense is marked as
  // paid by the partner, the transfer must not quietly refund it.
  const s = computeSettlement({
    ...revenue,
    expenses: [{ amountIls: 200, paidBy: "partner", shared: false }],
  });
  assert.equal(s.transferToRoy, revenue.fuzionNetRevenue / 2);
});

test("a loss month produces a negative transfer — Roy owes his half", () => {
  const s = computeSettlement({
    fuzionNetRevenue: 1000,
    expenses: [{ amountIls: 3000, paidBy: "owner", shared: true }],
  });
  assert.equal(s.profit, -2000);
  assert.equal(s.transferToRoy, -1000);
});

test("an empty month is all zeroes, not NaN", () => {
  const s = computeSettlement({ fuzionNetRevenue: 0, expenses: [] });
  assert.equal(s.profit, 0);
  assert.equal(s.transferToRoy, 0);
});

// ---- monthlyIlsOf: normalising an Expense row to monthly shekels ----

test("monthly ILS rows pass through unchanged", () => {
  assert.equal(
    monthlyIlsOf({ amount: 132, currency: "ILS", frequency: "MONTHLY" }),
    132,
  );
});

test("USD converts at the shared project rate", () => {
  // USD_TO_ILS is 3.1 in finance.ts; keep one source of truth.
  assert.equal(
    monthlyIlsOf({ amount: 200, currency: "USD", frequency: "MONTHLY" }),
    620,
  );
});

test("a yearly expense is spread across twelve months", () => {
  assert.equal(
    monthlyIlsOf({ amount: 1200, currency: "ILS", frequency: "YEARLY" }),
    100,
  );
});

test("a one-time expense contributes nothing to the monthly settlement", () => {
  // One-times are settled the month they happen, by hand — pushing them into
  // every month's transfer would double-count them forever.
  assert.equal(
    monthlyIlsOf({ amount: 5000, currency: "ILS", frequency: "ONE_TIME" }),
    0,
  );
});
