import assert from "node:assert/strict";
import test from "node:test";

import { signedAgreementView } from "./signed-view";

/**
 * A signed agreement whose first payment has not completed must offer the
 * customer a way back to the payment page. On 7.10.2026 a customer signed,
 * opened Cardcom, did not complete (Cardcom 5119 "pending or not completed"),
 * and the signed page then showed only "signed + PDF" — no way to pay.
 */

test("signed but unpaid subscription → resume payment", () => {
  for (const paymentStatus of ["PENDING", "SENT", "FAILED"]) {
    assert.equal(signedAgreementView({ status: "SIGNED", paymentStatus, monthlyPrice: 100, oneTimeFee: null }), "resume-payment", paymentStatus);
  }
});

test("signed and paid → paid", () => {
  assert.equal(signedAgreementView({ status: "SIGNED", paymentStatus: "COMPLETED", monthlyPrice: 100, oneTimeFee: null }), "paid");
});

test("signed one-off quote with a fee is also resumable", () => {
  assert.equal(signedAgreementView({ status: "SIGNED", paymentStatus: "PENDING", monthlyPrice: 0, oneTimeFee: 2000 }), "resume-payment");
});

test("signed with nothing to charge → nothing to pay (no dead button)", () => {
  assert.equal(signedAgreementView({ status: "SIGNED", paymentStatus: "PENDING", monthlyPrice: 0, oneTimeFee: null }), "nothing-to-pay");
  assert.equal(signedAgreementView({ status: "SIGNED", paymentStatus: "PENDING", monthlyPrice: 0, oneTimeFee: 0 }), "nothing-to-pay");
});

test("only SIGNED agreements get a signed view", () => {
  for (const status of ["DRAFT", "SENT", "CANCELLED"]) {
    assert.equal(signedAgreementView({ status, paymentStatus: "PENDING", monthlyPrice: 100, oneTimeFee: null }), null, status);
  }
});
