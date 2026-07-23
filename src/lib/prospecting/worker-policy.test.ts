import assert from "node:assert/strict";
import test from "node:test";

import { decideProspectSalesFit } from "./worker-policy";
import type { SalesFitAssessment } from "./types";

const independent: SalesFitAssessment = {
  classification: "INDEPENDENT_LIKELY",
  confidence: 0.9,
  ownerReachabilityScore: 85,
  reason: "עסק מקומי עצמאי עם דרך ישירה יחסית לבעלים",
  evidence: ["LOCAL_BRAND", "DIRECT_PUBLIC_PHONE"],
};

test("a deterministic chain exclusion becomes invalid without further auditing", () => {
  const hardExclusion: SalesFitAssessment = {
    classification: "CHAIN_OR_FRANCHISE",
    confidence: 1,
    ownerReachabilityScore: 0,
    reason: "העסק זוהה כרשת",
    evidence: ["MULTI_LOCATION"],
  };

  assert.deepEqual(decideProspectSalesFit({ hardExclusion }), {
    action: "REJECT",
    status: "INVALID",
    assessment: hardExclusion,
  });
});

test("uncertain AI evidence fails closed into review", () => {
  const assessment: SalesFitAssessment = {
    ...independent,
    classification: "UNCERTAIN",
    reason: "אין מספיק מידע ציבורי כדי לזהות עסק עצמאי",
    evidence: ["INSUFFICIENT_EVIDENCE"],
  };

  assert.deepEqual(decideProspectSalesFit({ hardExclusion: null, assessment }), {
    action: "REJECT",
    status: "FAILED_REVIEW",
    assessment,
  });
});

test("only a publishable independent assessment continues to website auditing", () => {
  assert.deepEqual(decideProspectSalesFit({ hardExclusion: null, assessment: independent }), {
    action: "CONTINUE",
    assessment: independent,
  });
});

test("missing or below-threshold assessment fails closed", () => {
  assert.equal(
    decideProspectSalesFit({ hardExclusion: null }).status,
    "FAILED_REVIEW",
  );
  assert.equal(
    decideProspectSalesFit({
      hardExclusion: null,
      assessment: { ...independent, ownerReachabilityScore: 69 },
    }).status,
    "FAILED_REVIEW",
  );
});
