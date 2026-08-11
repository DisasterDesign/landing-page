import assert from "node:assert/strict";
import test from "node:test";

import { PERSONAL_BOOK, bookOf, isPersonal, splitByBook } from "./books";

const fuzion = { partner: "fuzion" };
const personal = { partner: PERSONAL_BOOK };

test("the book is read from Client.partner, never from ownership", () => {
  assert.equal(bookOf(fuzion), "fuzion");
  assert.equal(bookOf(personal), "personal");
  // Ownership is a separate axis. Elad may own a Fuzion client (a house deal),
  // and that must not reclassify it as personal income.
  assert.equal(bookOf({ partner: "fuzion" }), "fuzion");
});

test("anything unrecognised counts as Fuzion, never as personal", () => {
  // Fails safe: an unknown label must not quietly remove revenue from the
  // partnership books.
  assert.equal(bookOf({ partner: "" }), "fuzion");
  assert.equal(bookOf({ partner: null }), "fuzion");
  assert.equal(bookOf({ partner: "legacy" }), "fuzion");
  assert.equal(isPersonal({ partner: null }), false);
});

test("totals are split per book and also combined", () => {
  const rows = [
    { partner: "fuzion", amount: 1000, profit: 800, partnerShare: 400 },
    { partner: "fuzion", amount: 500, profit: 400, partnerShare: 200 },
    { partner: PERSONAL_BOOK, amount: 300, profit: 240, partnerShare: 0 },
  ];
  const s = splitByBook(rows);

  assert.equal(s.fuzion.count, 2);
  assert.equal(s.fuzion.amount, 1500);
  assert.equal(s.fuzion.partnerShare, 600);

  assert.equal(s.personal.count, 1);
  assert.equal(s.personal.amount, 300);

  assert.equal(s.combined.count, 3);
  assert.equal(s.combined.amount, 1800);
  assert.equal(s.combined.profit, 1440);
});

test("GUARD: the personal book never contributes to the partner share", () => {
  // If this ever fails, Roy is being paid 50% of Elad's private retainers.
  const rows = [
    { partner: PERSONAL_BOOK, amount: 300, profit: 240, partnerShare: 120 },
    { partner: PERSONAL_BOOK, amount: 100, profit: 80, partnerShare: 40 },
  ];
  const s = splitByBook(rows);
  assert.equal(s.personal.partnerShare, 0);
  assert.equal(s.combined.partnerShare, 0);
});

test("an empty ledger produces zeroes, not NaN", () => {
  const s = splitByBook([]);
  assert.equal(s.combined.count, 0);
  assert.equal(s.combined.amount, 0);
  assert.equal(s.fuzion.partnerShare, 0);
});
