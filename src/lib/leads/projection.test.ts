import assert from "node:assert/strict";
import test from "node:test";

import {
  getSellerLeadDetail,
  projectLeadRecord,
  type LeadProjectionRecord,
} from "./projection";

const createdAt = new Date("2026-07-20T08:00:00.000Z");

function lead(
  overrides: Partial<LeadProjectionRecord> = {},
): LeadProjectionRecord {
  return {
    id: "lead-1",
    name: "נועה",
    company: "סטודיו נועה",
    email: "noa@example.com",
    phone: null,
    phoneProvenance: null,
    message: "אשמח לשמוע",
    service: "אתר",
    isRead: false,
    status: "NEW",
    source: "GOOGLE_MAPS",
    intentLevel: "OUTBOUND",
    sourceKey: "google_maps",
    sourceSnapshot: {
      territory: "הרצל, יבנה",
      cycleId: "cycle-1",
      batchId: "batch-1",
      weekStart: "2026-07-20T00:00:00.000Z",
      placeId: "place-1",
      websiteStatus: "ACTIVE",
      auditedDomain: "noa.co.il",
      internalBusinessCategory: "SERVICE",
      internalBusinessCategoryVersion: 1,
      qualityScore: 2,
      scoringVersion: 1,
      opportunitySummary: "אתר איטי ולא מתוחזק",
      callAngles: [
        { id: "1:1", text: "מהירות", version: 1 },
        { id: "1:2", text: "SEO", version: 1 },
      ],
    },
    stage: "NEW",
    ownerId: null,
    owner: null,
    eligibleSellerId: "seller-1",
    eligibleSeller: { id: "seller-1", name: "דגרון" },
    firstClaimedAt: null,
    firstContactedAt: null,
    decisionMakerReachedAt: null,
    qualifiedAt: null,
    wonAt: null,
    lostAt: null,
    lossReason: null,
    lossReasonDetails: null,
    doNotContactAt: null,
    migrationReviewRequired: false,
    migrationReviewReason: null,
    nextFollowUpAt: null,
    lastContactedAt: null,
    closedAt: null,
    createdAt,
    notes: [],
    events: [],
    interactions: [],
    followUps: [],
    agreements: [],
    prospect: {
      id: "prospect-1",
      placeId: "place-1",
      batchId: "batch-1",
      websiteStatus: "ACTIVE",
      auditedDomain: "noa.co.il",
      qualityScore: 2,
      rawQualityScore: 46,
      auditConfidence: 0.91,
      opportunitySummary: "אתר איטי ולא מתוחזק",
      callAngles: ["מהירות", "SEO"],
      salesFitClassification: "INDEPENDENT_LIKELY",
      salesFitConfidence: 0.93,
      ownerReachabilityScore: 88,
      salesFitReason: "עסק מקומי",
      salesFitEvidence: ["LOCAL_BRAND"],
      audits: [
        {
          id: "audit-1",
          availabilityScore: 10,
          performanceScore: 8,
          seoScore: 7,
          maintenanceScore: 6,
          visualScore: 5,
          commercialScore: 4,
          technicalEvidence: { title: "missing" },
          visualEvidence: null,
          auditedAt: createdAt,
        },
      ],
    },
    ...overrides,
  };
}

test("seller projection exposes canonical source and overlays live Google details", () => {
  const result = projectLeadRecord(lead(), {
    audience: "SELLER",
    viewerId: "seller-1",
    now: new Date("2026-07-23T10:00:00.000Z"),
    live: {
      placeId: "place-1",
      displayName: "סטודיו נועה",
      nationalPhoneNumber: "08-1234567",
      formattedAddress: "הרצל 12, יבנה",
      websiteUri: "https://new.noa.co.il",
      businessStatus: "OPERATIONAL",
      category: "סטודיו לקרמיקה",
      rating: 4.8,
      reviewCount: 84,
      weekdayDescriptions: ["יום ה׳ 09:00–18:00"],
    },
  });

  assert.equal(result.intentLevel, "OUTBOUND");
  assert.equal(result.sourceKey, "google_maps");
  assert.equal(result.sourceLabel, "פנייה קרה");
  assert.equal(result.stage, "NEW");
  assert.equal(result.phone, "08-1234567");
  assert.equal(result.phoneSource, "GOOGLE");
  assert.equal(result.website, "https://new.noa.co.il");
  assert.equal(result.address, "הרצל 12, יבנה");
  assert.equal(result.category, "סטודיו לקרמיקה");
  assert.match(result.mapUrl ?? "", /query_place_id=place-1/);
  assert.equal(result.capabilities.canClaim, true);
  assert.equal(result.capabilities.canPrepare, false);
  assert.equal(result.capabilities.canContact, false);
});

test("Google outage preserves audited website and never invents live fields", () => {
  const result = projectLeadRecord(lead(), {
    audience: "SELLER",
    viewerId: "seller-1",
    now: new Date("2026-07-23T10:00:00.000Z"),
  });

  assert.equal(result.phone, null);
  assert.equal(result.website, "https://noa.co.il/");
  assert.equal(result.websiteSource, "AUDITED_DOMAIN");
  assert.equal(result.address, null);
  assert.equal(result.category, null);
  assert.equal(result.preparation?.liveStatus, "UNAVAILABLE");
});

test("do-not-contact and review rows fail closed while admin retains review facts", () => {
  const blocked = projectLeadRecord(
    lead({
      ownerId: "seller-1",
      owner: { id: "seller-1", name: "דגרון" },
      doNotContactAt: new Date("2026-07-22T10:00:00.000Z"),
    }),
    {
      audience: "SELLER",
      viewerId: "seller-1",
      now: new Date("2026-07-23T10:00:00.000Z"),
    },
  );
  assert.equal(blocked.capabilities.canContact, false);
  assert.equal(blocked.capabilities.canRecordInteraction, false);
  assert.equal(blocked.capabilities.canScheduleFollowUp, false);

  const review = projectLeadRecord(
    lead({
      intentLevel: null,
      sourceKey: null,
      stage: null,
      migrationReviewRequired: true,
      migrationReviewReason: "SOURCE_OR_OWNERSHIP_REVIEW",
    }),
    {
      audience: "ADMIN",
      viewerId: "admin-1",
      now: new Date("2026-07-23T10:00:00.000Z"),
    },
  );
  assert.equal(review.intentLevel, null);
  assert.equal(review.stage, null);
  assert.equal(review.migrationReviewRequired, true);
  assert.ok(Object.values(review.capabilities).every((value) => value === false));

  const missingCredit = projectLeadRecord(
    lead({
      agreements: [
        {
          id: "agreement-uncredited",
          status: "SIGNED",
          paymentStatus: "COMPLETED",
          customerName: "נועה",
          monthlyPrice: 599,
          creditedSellerId: null,
          createdAt,
          updatedAt: createdAt,
          signedAt: createdAt,
          paidAt: createdAt,
        },
      ],
    }),
    {
      audience: "ADMIN",
      viewerId: "admin-1",
      now: new Date("2026-07-23T10:00:00.000Z"),
    },
  );
  assert.equal(missingCredit.capabilities.canChangeCommissionCredit, true);
});

test("timeline and last activity use recorded truth and failed payment derives recovery", () => {
  const result = projectLeadRecord(
    lead({
      ownerId: "seller-1",
      owner: { id: "seller-1", name: "דגרון" },
      stage: "AGREEMENT_SIGNED",
      notes: [
        {
          id: "note-1",
          body: "דיברנו",
          createdAt: new Date("2026-07-21T10:00:00.000Z"),
          author: { id: "seller-1", name: "דגרון" },
        },
      ],
      events: [
        {
          id: "event-1",
          type: "PAYMENT_FAILED",
          actorType: "INTEGRATION",
          actorUserId: null,
          fromStage: "AGREEMENT_SIGNED",
          toStage: "AGREEMENT_SIGNED",
          metadata: { agreementId: "agreement-1" },
          occurredAt: new Date("2026-07-22T09:00:00.000Z"),
          recordedAt: new Date("2026-07-22T09:00:05.000Z"),
          actorUser: null,
        },
      ],
      agreements: [
        {
          id: "agreement-1",
          status: "SIGNED",
          paymentStatus: "FAILED",
          customerName: "נועה",
          monthlyPrice: 599,
          creditedSellerId: "seller-1",
          createdAt,
          updatedAt: new Date("2026-07-22T09:00:04.000Z"),
          signedAt: new Date("2026-07-21T12:00:00.000Z"),
          paidAt: null,
        },
      ],
    }),
    {
      audience: "SELLER",
      viewerId: "seller-1",
      now: new Date("2026-07-23T10:00:00.000Z"),
    },
  );

  assert.deepEqual(result.nextAction, {
    kind: "RECOVER_FIRST_PAYMENT",
    agreementId: "agreement-1",
  });
  assert.equal(result.lastActivityAt, "2026-07-22T09:00:05.000Z");
  assert.equal(result.timeline[0]?.kind, "LEAD_EVENT");
});

test("seller authorization is applied before live enrichment", async () => {
  let enriched = false;
  const db = {
    contactSubmission: {
      async findFirst() {
        return null;
      },
    },
  };
  await assert.rejects(
    getSellerLeadDetail(
      { id: "lead-private", sellerId: "seller-1" },
      {
        db: db as never,
        loadLiveDetails: async () => {
          enriched = true;
          return new Map();
        },
      },
    ),
    /not found/i,
  );
  assert.equal(enriched, false);
});
