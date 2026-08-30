import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { recurringChargeNeedsAttention } from "./recurring-notifications";

/**
 * A monthly charge that simply worked is not news.
 *
 * With ~22 recurring clients, announcing every successful charge produced
 * dozens of pushes and emails a month, all of them "everything is fine".
 * Real signal — a failed charge, a charge we could not reconcile, a standing
 * order Cardcom switched off — was buried in it. Money received is visible in
 * /admin/finance whenever the owner wants it; only exceptions interrupt.
 */

test("a successful charge is silent", () => {
  assert.equal(
    recurringChargeNeedsAttention({ success: true, reviewRequired: false }),
    false,
  );
});

test("a failed charge always interrupts — that is money not collected", () => {
  assert.equal(
    recurringChargeNeedsAttention({ success: false, reviewRequired: false }),
    true,
  );
});

test("a charge needing revenue review interrupts even when it succeeded", () => {
  // The charge landed, but we could not prove the revenue was not already
  // booked — double-counting income is worse than a redundant ping.
  assert.equal(
    recurringChargeNeedsAttention({ success: true, reviewRequired: true }),
    true,
  );
  assert.equal(
    recurringChargeNeedsAttention({ success: false, reviewRequired: true }),
    true,
  );
});

test("GUARD: no code path announces a successful recurring charge", () => {
  // Three routes used to do this independently. If any of them grows the
  // habit back, this fails rather than quietly filling the owner's phone.
  const ROUTES = [
    "src/app/api/payments/recurring-webhook/route.ts",
    "src/app/api/payments/webhook/route.ts",
    "src/app/api/cron/cardcom-reconcile/route.ts",
  ];
  for (const rel of ROUTES) {
    const src = readFileSync(join(process.cwd(), rel), "utf8");
    assert.equal(
      /חיוב חודשי התקבל|חיוב חודשי התגלה/.test(src),
      false,
      `${rel} still announces a successful recurring charge`,
    );
    assert.equal(
      /sendPaymentReceivedEmail\([^)]*isRecurring:\s*true/.test(src.replace(/\n/g, " ")),
      false,
      `${rel} still emails admins on a successful recurring charge`,
    );
  }
});
