import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { LeadTimelineItem } from "@/lib/leads/projection";

import LeadActivityTimeline from "./LeadActivityTimeline";

function render(items: LeadTimelineItem[]): string {
  return renderToStaticMarkup(createElement(LeadActivityTimeline, { items }));
}

test("lead events show safe stage and audited before/after context without raw metadata", () => {
  const markup = render([
    {
      id: "event-1",
      kind: "LEAD_EVENT",
      occurredAt: "2026-07-23T09:00:00.000Z",
      recordedAt: "2026-07-23T09:00:01.000Z",
      actor: { id: "admin-1", name: "מנהלת" },
      data: {
        type: "SOURCE_CORRECTED",
        fromStage: "PREPARING",
        toStage: "CONTACTING",
        metadata: {
          reason: "שיוך המקור תוקן לאחר בדיקת הקמפיין",
          before: {
            intentLevel: "OUTBOUND",
            sourceKey: "google_maps",
            ownerId: null,
            email: "private@example.com",
          },
          after: {
            intentLevel: "INBOUND",
            sourceKey: "website",
            ownerId: "seller-internal-42",
            phone: "050-1234567",
          },
          providerTransactionId: "provider-secret-123",
          rawPayload: { customer: "Private Customer" },
        },
      },
    },
  ]);

  assert.match(markup, /מהכנה לשיחה ליצירת קשר/);
  assert.match(markup, /שיוך המקור תוקן לאחר בדיקת הקמפיין/);
  assert.match(markup, /פנייה קרה/);
  assert.match(markup, /פנייה יזומה/);
  assert.match(markup, /Google Maps/);
  assert.match(markup, /אתר Fuzion/);
  assert.match(markup, /בעלות: לפני לא משויך · אחרי משויך/);
  assert.doesNotMatch(markup, /private@example\.com/);
  assert.doesNotMatch(markup, /050-1234567/);
  assert.doesNotMatch(markup, /seller-internal-42/);
  assert.doesNotMatch(markup, /provider-secret-123/);
  assert.doesNotMatch(markup, /Private Customer/);
  assert.doesNotMatch(markup, /rawPayload|providerTransactionId/);
});

test("an interaction remains meaningful without a free-text note", () => {
  const markup = render([
    {
      id: "interaction-1",
      kind: "INTERACTION",
      occurredAt: "2026-07-23T09:00:00.000Z",
      recordedAt: "2026-07-23T09:00:01.000Z",
      actor: { id: "seller-1", name: "מוכרת" },
      data: {
        channel: "PHONE",
        outcome: "NO_ANSWER",
        decisionMakerReached: false,
        note: null,
      },
    },
  ]);

  assert.match(markup, /ערוץ: טלפון/);
  assert.match(markup, /תוצאה: לא ענו/);
});
