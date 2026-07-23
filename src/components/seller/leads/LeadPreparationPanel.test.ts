import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { LeadDetail } from "@/lib/leads/projection";

import LeadPreparationPanel from "./LeadPreparationPanel";

function lead(
  overrides: Partial<LeadDetail> = {},
): LeadDetail {
  return {
    address: null,
    category: null,
    mapUrl: null,
    website: null,
    sourceSnapshot: null,
    preparation: null,
    ...overrides,
  } as LeadDetail;
}

test("shows Meta form answers even when the lead has no website preparation", () => {
  const markup = renderToStaticMarkup(
    createElement(LeadPreparationPanel, {
      lead: lead({
        sourceSnapshot: {
          nonContactAnswers: [
            { name: "איזה אתר נדרש?", values: ["חנות אונליין"] },
            { name: "תקציב", values: ["5,000–10,000 ₪"] },
          ],
        },
      }),
    }),
  );

  assert.match(markup, /תשובות מטופס הליד/);
  assert.match(markup, /איזה אתר נדרש\?/);
  assert.match(markup, /חנות אונליין/);
  assert.match(markup, /תקציב/);
});

test("shows bounded leaf evidence from nested audit objects and arrays", () => {
  const structuredDataTypes = Array.from(
    { length: 12 },
    (_, index) => `Schema-${index + 1}`,
  );
  const markup = renderToStaticMarkup(
    createElement(LeadPreparationPanel, {
      lead: lead({
        preparation: {
          prospectId: "prospect-1",
          placeId: "place-1",
          batchId: "batch-1",
          websiteStatus: "ACTIVE",
          auditedDomain: "example.com",
          internalBusinessCategory: "SERVICE",
          qualityScore: 2,
          rawQualityScore: 42,
          auditConfidence: 0.9,
          opportunitySummary: "הזדמנות",
          callAngles: [],
          scoreBreakdown: null,
          technicalEvidence: {
            technical: {
              hasTitle: false,
              structuredDataTypes,
            },
            commerce: {
              businessShape: "SERVICE",
            },
            pageSpeed: {
              seoAudits: {
                documentTitle: false,
              },
            },
          },
          visualEvidence: {
            findings: [
              {
                code: "CTA",
                severity: "high",
                evidence: "כפתור הפעולה אינו בולט",
              },
            ],
          },
          salesFit: {
            classification: "INDEPENDENT_LIKELY",
            confidence: 0.9,
            ownerReachabilityScore: 80,
            reason: "עסק מקומי",
            evidence: [],
          },
          liveStatus: "UNAVAILABLE",
          rating: null,
          reviewCount: null,
          weekdayDescriptions: [],
          businessStatus: null,
        },
      }),
    }),
  );

  assert.match(markup, /Schema-1/);
  assert.doesNotMatch(markup, /Schema-12/);
  assert.match(markup, /SERVICE/);
  assert.match(markup, /documentTitle/);
  assert.match(markup, /כפתור הפעולה אינו בולט/);
});

test("does not describe an inconclusive audit status as no website", () => {
  const markup = renderToStaticMarkup(
    createElement(LeadPreparationPanel, {
      lead: lead({
        preparation: {
          prospectId: "prospect-1",
          placeId: "place-1",
          batchId: "batch-1",
          websiteStatus: "BLOCKED",
          auditedDomain: null,
          internalBusinessCategory: "SERVICE",
          qualityScore: null,
          rawQualityScore: null,
          auditConfidence: null,
          opportunitySummary: null,
          callAngles: [],
          scoreBreakdown: null,
          technicalEvidence: null,
          visualEvidence: null,
          salesFit: {
            classification: null,
            confidence: null,
            ownerReachabilityScore: null,
            reason: null,
            evidence: [],
          },
          liveStatus: "UNAVAILABLE",
          rating: null,
          reviewCount: null,
          weekdayDescriptions: [],
          businessStatus: null,
        },
      }),
    }),
  );

  assert.match(markup, /האתר חסם את הבדיקה/);
  assert.match(markup, /כתובת האתר שנבדקה אינה זמינה/);
  assert.doesNotMatch(markup, />אין אתר</);
});

test("shows a safe live website when no audited domain is available", () => {
  const markup = renderToStaticMarkup(
    createElement(LeadPreparationPanel, {
      lead: lead({
        website: "https://live.example/store",
        preparation: {
          prospectId: "prospect-1",
          placeId: "place-1",
          batchId: "batch-1",
          websiteStatus: "UNKNOWN",
          auditedDomain: null,
          internalBusinessCategory: "RETAIL",
          qualityScore: null,
          rawQualityScore: null,
          auditConfidence: null,
          opportunitySummary: null,
          callAngles: [],
          scoreBreakdown: null,
          technicalEvidence: null,
          visualEvidence: null,
          salesFit: {
            classification: null,
            confidence: null,
            ownerReachabilityScore: null,
            reason: null,
            evidence: [],
          },
          liveStatus: "READY",
          rating: null,
          reviewCount: null,
          weekdayDescriptions: [],
          businessStatus: "OPERATIONAL",
        },
      }),
    }),
  );

  assert.match(markup, /href="https:\/\/live\.example\/store"/);
  assert.match(markup, />https:\/\/live\.example\/store</);
});
