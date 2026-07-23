import assert from "node:assert/strict";
import test from "node:test";

import { detectHardSalesFitExclusion, isPublishableSalesFit } from "./sales-fit";

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

function publicBusiness(overrides: {
  displayName?: string;
  category?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
} = {}) {
  return {
    displayName: overrides.displayName ?? "סטודיו נועה",
    category: overrides.category ?? "סטודיו לעיצוב",
    rating: overrides.rating ?? 4.9,
    reviewCount: overrides.reviewCount ?? 85,
  };
}

test("known chains and franchise brands are hard-excluded", () => {
  for (const displayName of [
    "ארומה אספרסו בר - יבנה",
    "סופר-פארם רוטשילד",
    "KSP ראשון לציון",
    "רמי לוי בשכונה",
  ]) {
    const result = detectHardSalesFitExclusion(publicBusiness({ displayName }));
    assert.equal(result?.classification, "CHAIN_OR_FRANCHISE");
    assert.equal(result?.confidence, 1);
  }
});

test("banks, institutions and industrial facilities are hard-excluded", () => {
  const candidates = [
    publicBusiness({ displayName: "בנק הפועלים", category: "בנק" }),
    publicBusiness({ displayName: "בית החולים העירוני", category: "בית חולים" }),
    publicBusiness({ displayName: "מרכז לוגיסטי דרום", category: "שירות לוגיסטי" }),
  ];

  for (const candidate of candidates) {
    const result = detectHardSalesFitExclusion(candidate);
    assert.ok(result);
    assert.notEqual(result.classification, "INDEPENDENT_LIKELY");
  }
});

test("rating and review volume alone never prove that a business is large", () => {
  assert.equal(
    detectHardSalesFitExclusion(
      publicBusiness({
        displayName: "סטודיו נועה לקרמיקה",
        category: "סטודיו לאמנות",
        rating: 5,
        reviewCount: 2_500,
      }),
    ),
    null,
  );
});
