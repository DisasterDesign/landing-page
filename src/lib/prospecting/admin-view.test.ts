import assert from "node:assert/strict";
import test from "node:test";

import { serializeAdminProspect } from "./admin-view";
import type { LivePlaceDetails } from "./types";

function prospect(overrides: Record<string, unknown> = {}) {
  return {
    id: "prospect-1",
    placeId: "place-1",
    status: "PUBLISHED",
    websiteStatus: "ACTIVE",
    auditedDomain: "old-site.co.il",
    promotedLeadId: "lead-1",
    ...overrides,
  };
}

function live(overrides: Partial<LivePlaceDetails> = {}): LivePlaceDetails {
  return {
    placeId: "place-1",
    displayName: "סטודיו נועה",
    nationalPhoneNumber: "03-1234567",
    formattedAddress: "רוטשילד 12, ראשון לציון",
    websiteUri: "https://current-site.example",
    businessStatus: "OPERATIONAL",
    category: "סטודיו לקרמיקה",
    rating: 4.8,
    reviewCount: 84,
    weekdayDescriptions: [],
    ...overrides,
  };
}

test("admin projection keeps audited evidence separate from live public details", () => {
  const result = serializeAdminProspect(prospect(), live());

  assert.equal(result.liveStatus, "READY");
  assert.deepEqual(result.business, {
    displayName: "סטודיו נועה",
    phone: "03-1234567",
    address: "רוטשילד 12, ראשון לציון",
    auditedWebsite: "https://old-site.co.il/",
    liveWebsite: "https://current-site.example",
    mapUrl:
      "https://www.google.com/maps/search/?api=1&query=%D7%A1%D7%98%D7%95%D7%93%D7%99%D7%95%20%D7%A0%D7%95%D7%A2%D7%94&query_place_id=place-1",
  });
  assert.equal(result.promotedLeadId, "lead-1");
});

test("provider outage is unavailable, never no-phone, and preserves audited website", () => {
  const result = serializeAdminProspect(prospect(), undefined);

  assert.equal(result.liveStatus, "UNAVAILABLE");
  assert.equal(result.business.phone, null);
  assert.equal(result.business.auditedWebsite, "https://old-site.co.il/");
  assert.equal(result.business.liveWebsite, null);
  assert.match(result.business.mapUrl, /query_place_id=place-1/);
});

test("successful live lookup without a public phone is explicitly no-phone", () => {
  const result = serializeAdminProspect(
    prospect(),
    live({ nationalPhoneNumber: null }),
  );

  assert.equal(result.liveStatus, "NO_PHONE");
  assert.equal(result.business.phone, null);
});

test("unsafe or irrelevant website values are not made clickable", () => {
  const result = serializeAdminProspect(
    prospect({
      auditedDomain: "old-site.co.il/path?redirect=evil.example",
      websiteStatus: "NO_WEBSITE",
    }),
    live({ websiteUri: "javascript:alert(1)" }),
  );

  assert.equal(result.business.auditedWebsite, null);
  assert.equal(result.business.liveWebsite, null);
});
