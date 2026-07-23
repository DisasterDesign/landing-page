import assert from "node:assert/strict";
import test from "node:test";

import { verifiedFirstPaymentEvidence } from "./payment-verification";

const verifiedAgreement = {
  id: "agreement-1",
  paymentId: "lp-verified",
  paymentStatus: "COMPLETED",
  paidAt: new Date("2026-07-23T10:00:00.000Z"),
  paidAmount: 702,
  cardcomDealId: "deal-9911",
  cardcomVerifiedLowProfileId: "lp-verified",
  cardcomVerifiedReturnValue: "agreement-1",
  cardcomVerifiedTransactionId: "deal-9911",
  cardcomVerifiedAmount: 702,
  cardcomPaymentVerifiedAt: new Date("2026-07-23T10:00:01.000Z"),
};

test("first-payment evidence requires the complete provider-bound proof", () => {
  assert.deepEqual(verifiedFirstPaymentEvidence(verifiedAgreement), {
    paidAt: verifiedAgreement.paidAt,
    paidAmount: 702,
    lowProfileId: "lp-verified",
    providerTransactionId: "deal-9911",
    verifiedAt: verifiedAgreement.cardcomPaymentVerifiedAt,
  });

  for (const field of [
    "paidAt",
    "paidAmount",
    "cardcomDealId",
    "cardcomVerifiedLowProfileId",
    "cardcomVerifiedReturnValue",
    "cardcomVerifiedTransactionId",
    "cardcomVerifiedAmount",
    "cardcomPaymentVerifiedAt",
  ] as const) {
    assert.equal(
      verifiedFirstPaymentEvidence({ ...verifiedAgreement, [field]: null }),
      null,
      field,
    );
  }
});

test("local COMPLETED state and mismatched provider proof are never verified", () => {
  assert.equal(
    verifiedFirstPaymentEvidence({
      ...verifiedAgreement,
      cardcomPaymentVerifiedAt: null,
    }),
    null,
  );
  assert.equal(
    verifiedFirstPaymentEvidence({
      ...verifiedAgreement,
      paymentId: "lp-other",
    }),
    null,
  );
  assert.equal(
    verifiedFirstPaymentEvidence({
      ...verifiedAgreement,
      cardcomVerifiedReturnValue: "agreement-other",
    }),
    null,
  );
  assert.equal(
    verifiedFirstPaymentEvidence({
      ...verifiedAgreement,
      cardcomVerifiedTransactionId: "deal-other",
    }),
    null,
  );
  assert.equal(
    verifiedFirstPaymentEvidence({
      ...verifiedAgreement,
      cardcomVerifiedAmount: 1,
    }),
    null,
  );
});
