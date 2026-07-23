import assert from "node:assert/strict";
import test from "node:test";

import {
  assertCommercialLeadReady,
  assertSellerOwnsLead,
  canSellerReadLead,
  sellerLeadScope,
} from "./authorization";

test("seller scope includes only owned or explicitly eligible canonical leads", () => {
  assert.deepEqual(sellerLeadScope("seller-1"), {
    OR: [{ ownerId: "seller-1" }, { ownerId: null, eligibleSellerId: "seller-1" }],
    migrationReviewRequired: false,
    intentLevel: { not: null },
    sourceKey: { not: null },
    stage: { not: null },
  });
});

test("seller can read an eligible unclaimed lead but not another owner's lead", () => {
  assert.equal(
    canSellerReadLead("seller-1", {
      ownerId: null,
      eligibleSellerId: "seller-1",
      migrationReviewRequired: false,
      intentLevel: "OUTBOUND",
      sourceKey: "google_maps",
      stage: "NEW",
    }),
    true,
  );
  assert.equal(
    canSellerReadLead("seller-2", {
      ownerId: "seller-1",
      eligibleSellerId: "seller-2",
      migrationReviewRequired: false,
      intentLevel: "OUTBOUND",
      sourceKey: "google_maps",
      stage: "CONTACTING",
    }),
    false,
  );
});

test("incomplete or review-required leads fail closed", () => {
  const unresolved = {
    ownerId: null,
    eligibleSellerId: "seller-1",
    migrationReviewRequired: false,
    intentLevel: null,
    sourceKey: null,
    stage: null,
  } as const;
  assert.equal(canSellerReadLead("seller-1", unresolved), false);
  assert.throws(() => assertCommercialLeadReady(unresolved), /admin review/i);
  assert.throws(
    () =>
      assertSellerOwnsLead("seller-1", {
        ...unresolved,
        ownerId: "seller-1",
      }),
    /admin review/i,
  );
});

test("ownership guard rejects an eligible seller who has not claimed the lead", () => {
  assert.throws(
    () =>
      assertSellerOwnsLead("seller-1", {
        ownerId: null,
        migrationReviewRequired: false,
        intentLevel: "INBOUND",
        sourceKey: "website",
        stage: "NEW",
      }),
    /not owned/i,
  );
});
