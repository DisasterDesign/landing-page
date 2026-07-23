import assert from "node:assert/strict";
import test from "node:test";

import {
  intentForSource,
  validateSourceSnapshot,
  websiteAttributionFromReferrer,
} from "./source";

const googleSnapshot = {
  territory: "רחוב הרצל, יבנה",
  cycleId: "cycle-1",
  batchId: "batch-1",
  weekStart: "2026-07-20T00:00:00.000Z",
  placeId: "place-1",
  websiteStatus: "ACTIVE",
  auditedDomain: "example.co.il",
  internalBusinessCategory: "RETAIL",
  internalBusinessCategoryVersion: 1,
  qualityScore: 2,
  scoringVersion: 3,
  opportunitySummary: "אתר איטי וללא תשתית SEO",
  callAngles: [{ id: "speed", text: "האתר נטען לאט במובייל", version: 1 }],
};

test("known sources map to the three immutable intent levels", () => {
  assert.equal(intentForSource("google_maps"), "OUTBOUND");
  assert.equal(intentForSource("meta_lead_ads"), "AD_RESPONSE");
  assert.equal(intentForSource("website"), "INBOUND");
  assert.equal(intentForSource("google_search_ads"), "INBOUND");
  assert.equal(intentForSource("manual_outbound"), "OUTBOUND");
  assert.equal(intentForSource("direct_contact"), "INBOUND");
});

test("Google Maps snapshots contain only durable audited evidence", () => {
  assert.deepEqual(validateSourceSnapshot("google_maps", googleSnapshot), googleSnapshot);

  for (const forbidden of ["phone", "address", "category", "websiteUri", "rawPayload"]) {
    assert.throws(
      () =>
        validateSourceSnapshot("google_maps", {
          ...googleSnapshot,
          [forbidden]: "must-not-persist",
        }),
      /snapshot|unrecognized|invalid/i,
    );
  }
});

test("call angles are versioned objects and score five is not publishable", () => {
  assert.throws(
    () =>
      validateSourceSnapshot("google_maps", {
        ...googleSnapshot,
        callAngles: ["slow website"],
      }),
    /snapshot|invalid/i,
  );
  assert.throws(
    () => validateSourceSnapshot("google_maps", { ...googleSnapshot, qualityScore: 5 }),
    /snapshot|invalid/i,
  );
});

test("auditedDomain may be null only for an explicit no-site status", () => {
  assert.doesNotThrow(() =>
    validateSourceSnapshot("google_maps", {
      ...googleSnapshot,
      websiteStatus: "NO_WEBSITE",
      auditedDomain: null,
    }),
  );
  assert.throws(
    () => validateSourceSnapshot("google_maps", { ...googleSnapshot, auditedDomain: null }),
    /auditedDomain|snapshot|invalid/i,
  );
});

test("website attribution keeps only safe path and allow-listed UTM fields", () => {
  assert.deepEqual(
    websiteAttributionFromReferrer(
      "https://fuzionwebz.com/contact?utm_source=google&utm_medium=cpc&utm_campaign=july&utm_content=a&utm_term=site&phone=secret&gclid=drop",
    ),
    {
      landingPage: "/contact",
      referrer: "https://fuzionwebz.com/contact",
      utmSource: "google",
      utmMedium: "cpc",
      utmCampaign: "july",
      utmContent: "a",
      utmTerm: "site",
    },
  );
  assert.deepEqual(websiteAttributionFromReferrer("javascript:alert(1)"), {
    landingPage: "/contact",
  });
});

test("strict source registry rejects unknown source keys and extra fields", () => {
  assert.throws(() => validateSourceSnapshot("unknown", {}), /source/i);
  assert.throws(
    () =>
      validateSourceSnapshot("website", {
        landingPage: "/contact",
        receivedAt: "2026-07-23T07:00:00.000Z",
        contactAnswers: [{ email: "pii@example.com" }],
      }),
    /snapshot|unrecognized|invalid/i,
  );
});
