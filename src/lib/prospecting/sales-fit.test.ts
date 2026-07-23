import assert from "node:assert/strict";
import test from "node:test";

import { isPublishableSalesFit } from "./sales-fit";

test("sales fit passes only high-confidence likely-independent businesses", () => {
  assert.equal(
    isPublishableSalesFit({
      classification: "INDEPENDENT_LIKELY",
      confidence: 0.8,
      ownerReachabilityScore: 70,
      reason: "עסק מקומי עצמאי",
      evidence: ["LOCAL_BRAND"],
    }),
    true,
  );
  assert.equal(
    isPublishableSalesFit({
      classification: "UNCERTAIN",
      confidence: 0.99,
      ownerReachabilityScore: 95,
      reason: "אין מספיק מידע",
      evidence: [],
    }),
    false,
  );
});

test("sales fit thresholds fail closed below either minimum", () => {
  const base = {
    classification: "INDEPENDENT_LIKELY" as const,
    confidence: 0.8,
    ownerReachabilityScore: 70,
    reason: "עסק מקומי עצמאי",
    evidence: ["LOCAL_BRAND"] as const,
  };

  assert.equal(isPublishableSalesFit({ ...base, confidence: 0.799 }), false);
  assert.equal(isPublishableSalesFit({ ...base, ownerReachabilityScore: 69 }), false);
});
