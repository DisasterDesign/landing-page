import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { verifyRecurringWebhookSecret } from "./cardcom-webhook-auth";

test("recurring callbacks fail closed when the shared secret is missing or wrong", () => {
  assert.deepEqual(
    verifyRecurringWebhookSecret({
      expectedSecret: undefined,
      receivedSecret: "attacker-controlled",
    }),
    { ok: false, status: 503, reason: "secret-not-configured" },
  );
  assert.deepEqual(
    verifyRecurringWebhookSecret({
      expectedSecret: "configured-secret",
      receivedSecret: "wrong-secret",
    }),
    { ok: false, status: 403, reason: "secret-mismatch" },
  );
  assert.deepEqual(
    verifyRecurringWebhookSecret({
      expectedSecret: "configured-secret",
      receivedSecret: "configured-secret",
    }),
    { ok: true },
  );
});

test("both Cardcom recurring entry points enforce the shared-secret guard", () => {
  const primaryRoute = readFileSync(
    new URL("../app/api/payments/webhook/route.ts", import.meta.url),
    "utf8",
  );
  const recurringRoute = readFileSync(
    new URL("../app/api/payments/recurring-webhook/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(primaryRoute, /verifyRecurringWebhookSecret/);
  assert.match(recurringRoute, /verifyRecurringWebhookSecret/);
  assert.doesNotMatch(
    recurringRoute,
    /SECRET not set[^]*accepting unsigned payload/,
  );
});

test("a recurring success requires a stable provider deal id and a serialized write", () => {
  const primaryRoute = readFileSync(
    new URL("../app/api/payments/webhook/route.ts", import.meta.url),
    "utf8",
  );
  const recurringRoute = readFileSync(
    new URL("../app/api/payments/recurring-webhook/route.ts", import.meta.url),
    "utf8",
  );
  const writer = readFileSync(
    new URL("./cardcom-recurring-charge.ts", import.meta.url),
    "utf8",
  );

  const primaryRecurringHandler = primaryRoute.slice(
    primaryRoute.indexOf("async function handleRecurringCharge"),
  );
  assert.match(primaryRecurringHandler, /if \(!dealId\)[^]*return/);
  assert.match(primaryRecurringHandler, /recordVerifiedRecurringCharge/);
  assert.doesNotMatch(primaryRecurringHandler, /agreementCharge\.create/);
  assert.doesNotMatch(primaryRecurringHandler, /amount:\s*\{\s*increment:/);

  assert.match(recurringRoute, /if \(!dealId\)[^]*return/);
  assert.match(recurringRoute, /recordVerifiedRecurringCharge/);
  assert.doesNotMatch(recurringRoute, /agreementCharge\.create/);
  assert.doesNotMatch(recurringRoute, /amount:\s*\{\s*increment:/);
  assert.match(writer, /providerChargeKey/);
  assert.match(writer, /revenueAppliedAt/);
  assert.match(writer, /TransactionIsolationLevel\.Serializable/);
});

test("authenticated reconciliation uses the same charge and revenue writer", () => {
  const reconcileRoute = readFileSync(
    new URL("../app/api/cron/cardcom-reconcile/route.ts", import.meta.url),
    "utf8",
  );

  assert.match(reconcileRoute, /recordVerifiedRecurringCharge/);
  assert.doesNotMatch(reconcileRoute, /agreementCharge\.create/);
  assert.doesNotMatch(reconcileRoute, /agreementCharge\.update/);
});
