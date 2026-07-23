import assert from "node:assert/strict";
import test from "node:test";

import { serializeSellerProspect } from "./seller-view";
import type { LivePlaceDetails } from "./types";

function prospect(overrides: Record<string, unknown> = {}) {
  return {
    id: "prospect-1",
    placeId: "place-1",
    status: "PUBLISHED",
    websiteStatus: "ACTIVE",
    auditedDomain: "local-business.co.il",
    qualityScore: 2,
    rawQualityScore: 46,
    auditConfidence: 0.9,
    opportunitySummary: "אתר איטי עם הזדמנות SEO",
    callAngles: ["מהירות", "SEO", "תחזוקה"],
    nextFollowUpAt: null,
    lastContactedAt: null,
    salesFitClassification: "INDEPENDENT_LIKELY",
    salesFitConfidence: 0.91,
    ownerReachabilityScore: 86,
    salesFitReason: "עסק מקומי עם טלפון ציבורי ישיר",
    salesFitEvidence: ["LOCAL_BRAND", "DIRECT_PUBLIC_PHONE"],
    audits: [
      {
        availabilityScore: 12,
        performanceScore: 8,
        seoScore: 9,
        maintenanceScore: 10,
        visualScore: 7,
        commercialScore: 5,
      },
    ],
    interactions: [],
    ...overrides,
  };
}

function live(overrides: Partial<LivePlaceDetails> = {}): LivePlaceDetails {
  return {
    placeId: "place-1",
    displayName: "סטודיו נועה",
    nationalPhoneNumber: "03-1234567",
    formattedAddress: "רוטשילד 12, ראשון לציון",
    websiteUri: "https://noa.example",
    businessStatus: "OPERATIONAL",
    category: "סטודיו לקרמיקה",
    rating: 4.8,
    reviewCount: 84,
    weekdayDescriptions: ["יום חמישי: 09:00–18:00"],
    ...overrides,
  };
}

test("seller view exposes complete live public business details", () => {
  const result = serializeSellerProspect(prospect(), live());

  assert.equal(result.liveStatus, "READY");
  assert.deepEqual(result.business, {
    displayName: "סטודיו נועה",
    phone: "03-1234567",
    address: "רוטשילד 12, ראשון לציון",
    website: "https://noa.example",
    websiteSource: "GOOGLE",
    mapUrl:
      "https://www.google.com/maps/search/?api=1&query=%D7%A1%D7%98%D7%95%D7%93%D7%99%D7%95%20%D7%A0%D7%95%D7%A2%D7%94&query_place_id=place-1",
    category: "סטודיו לקרמיקה",
    rating: 4.8,
    reviewCount: 84,
    weekdayDescriptions: ["יום חמישי: 09:00–18:00"],
    businessStatus: "OPERATIONAL",
  });
  assert.equal(result.salesFit.ownerReachabilityScore, 86);
});

test("unavailable live data preserves audited website analysis and exposes retry state", () => {
  const result = serializeSellerProspect(prospect(), undefined);

  assert.equal(result.liveStatus, "UNAVAILABLE");
  assert.equal(result.business.displayName, "local-business.co.il");
  assert.equal(result.business.phone, null);
  assert.equal(result.business.website, "https://local-business.co.il/");
  assert.equal(result.business.websiteSource, "AUDITED_DOMAIN");
  assert.match(result.business.mapUrl, /query_place_id=place-1/);
  assert.equal(result.opportunitySummary, "אתר איטי עם הזדמנות SEO");
});

test("a successful Place response without phone is distinct from provider failure", () => {
  const result = serializeSellerProspect(prospect(), live({ nationalPhoneNumber: null }));
  assert.equal(result.liveStatus, "NO_PHONE");
  assert.equal(result.business.phone, null);
});

test("unsafe audited-domain fallback and no-site prospects never create website links", () => {
  const unsafe = serializeSellerProspect(
    prospect({ auditedDomain: "example.com/path?redirect=evil.example" }),
    undefined,
  );
  assert.equal(unsafe.business.website, null);

  const noSite = serializeSellerProspect(
    prospect({ websiteStatus: "NO_WEBSITE", auditedDomain: "unexpected.example" }),
    undefined,
  );
  assert.equal(noSite.business.website, null);
  assert.equal(noSite.business.websiteSource, "NONE");
});
