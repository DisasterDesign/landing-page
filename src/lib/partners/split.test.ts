import assert from "node:assert/strict";
import test from "node:test";

import { splitRuleFor, ROY_SHARE_PCT } from "./split";

/**
 * One function answers "how much of this client's net revenue is Roy's?"
 * It is the mechanism a future agent reads instead of reverse-engineering
 * two routes. It must never guess: where the two live calculations disagree,
 * it says so instead of picking one.
 */

const roy = { id: "u-roy", isOwner: false, revenueSharePct: 50 };
const elad = { id: "u-elad", isOwner: true, revenueSharePct: null };
const seller = { id: "u-seller", isOwner: false, revenueSharePct: null };

test("Roy's share is 50% and comes from one constant", () => {
  assert.equal(ROY_SHARE_PCT, 50);
});

test("a personal-book client is 100% Elad, whoever owns the row", () => {
  for (const owner of [roy, elad, seller, null]) {
    const r = splitRuleFor({ partner: "personal", owner });
    assert.equal(r.book, "personal");
    assert.equal(r.royPct, 0);
    assert.equal(r.status, "settled");
  }
});

test("a fuzion-book client owned by Roy splits 50/50 — both calculations agree", () => {
  const r = splitRuleFor({ partner: "fuzion", owner: roy });
  assert.equal(r.book, "fuzion");
  assert.equal(r.royPct, 50);
  assert.equal(r.status, "settled");
});

test("a fuzion-book client NOT owned by Roy is flagged, not guessed", () => {
  // The settlement (src/lib/partners/settlement.ts) pools every fuzion-book
  // client and halves it, so these contribute 50% to Roy there. The per-row
  // share (ownerId → revenueSharePct) says 0. Until Elad rules, the only
  // honest answer is "ambiguous" with both readings attached.
  for (const owner of [elad, seller, null]) {
    const r = splitRuleFor({ partner: "fuzion", owner });
    assert.equal(r.book, "fuzion");
    assert.equal(r.status, "ambiguous");
    assert.equal(r.royPct, null);
    assert.equal(r.readings.settlement, 50);
    assert.equal(r.readings.perRow, 0);
  }
});

test("an unknown book label fails safe into the fuzion book (never silently private)", () => {
  // Mirrors bookOf() in src/lib/clients/books.ts.
  const r = splitRuleFor({ partner: "legacy-whatever", owner: roy });
  assert.equal(r.book, "fuzion");
  assert.equal(r.royPct, 50);
});
