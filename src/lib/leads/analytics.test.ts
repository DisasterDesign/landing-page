import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateLeadMetrics,
  type LeadAnalyticsRow,
} from "./analytics";

const createdAt = new Date("2026-07-01T09:00:00.000Z");
const cohort = {
  from: new Date("2026-07-01T00:00:00.000Z"),
  to: new Date("2026-07-31T23:59:59.999Z"),
};

function row(index: number): LeadAnalyticsRow {
  return {
    id: `lead-${index}`,
    createdAt,
    intentLevel: index < 2 ? "INBOUND" : index < 4 ? "AD_RESPONSE" : "OUTBOUND",
    sourceKey: index < 6 ? "google_maps" : "website",
    lossReason: index === 8 ? "NO_BUDGET" : null,
    sourceSnapshot: {
      territory: "רחוב הרצל, יבנה",
      internalBusinessCategory: "SERVICE",
      qualityScore: 3,
      callAngles: [{ id: "speed-v1", text: "מהירות", version: 1 }],
    },
    prospect: {
      qualityScore: 3,
      cycle: { territory: "רחוב הרצל, יבנה" },
    },
    events: [],
    interactions: [],
    agreements: [],
  };
}

function event(
  type: LeadAnalyticsRow["events"][number]["type"],
  minutes: number,
  actorUserId = "seller-1",
) {
  return {
    type,
    occurredAt: new Date(createdAt.getTime() + minutes * 60_000),
    actorUserId,
  };
}

test("calculates the lead-created cohort funnel, timing, SLA, loss and cold breakdowns", () => {
  const rows = Array.from({ length: 10 }, (_, index) => row(index));

  for (const lead of rows.slice(0, 8)) lead.events.push(event("CLAIMED", 4));
  for (const lead of rows.slice(0, 7)) lead.events.push(event("CONTACT_ATTEMPTED", 10));
  for (const lead of rows.slice(0, 5)) lead.events.push(event("DECISION_MAKER_REACHED", 12));
  for (const lead of rows.slice(0, 4)) lead.events.push(event("QUALIFIED", 15));
  for (const lead of rows.slice(0, 3)) lead.events.push(event("AGREEMENT_CREATED", 20));
  for (const lead of rows.slice(0, 3)) lead.events.push(event("AGREEMENT_SENT", 25));
  for (const lead of rows.slice(0, 2)) lead.events.push(event("AGREEMENT_SIGNED", 30));

  rows[0]!.agreements.push({
    id: "agreement-1",
    status: "SIGNED",
    createdAt: new Date(createdAt.getTime() + 20 * 60_000),
    signedAt: new Date(createdAt.getTime() + 30 * 60_000),
    paidAt: new Date(createdAt.getTime() + 40 * 60_000),
    paidAmount: 599,
    monthlyPrice: 599,
    creditedSellerId: "seller-1",
  });
  rows[0]!.agreements.push({
    id: "agreement-later",
    status: "SIGNED",
    createdAt: new Date(createdAt.getTime() + 50 * 60_000),
    signedAt: new Date(createdAt.getTime() + 60 * 60_000),
    paidAt: new Date(createdAt.getTime() + 70 * 60_000),
    paidAmount: 1_299,
    monthlyPrice: 1_299,
    creditedSellerId: "seller-2",
  });
  rows[4]!.interactions.push({
    occurredAt: new Date(createdAt.getTime() + 10 * 60_000),
    authorId: "seller-1",
    usedCallAngleIds: ["speed-v1"],
  });

  const metrics = calculateLeadMetrics(rows, cohort, {
    slaMinutes: { INBOUND: 5, AD_RESPONSE: 15 },
  });

  assert.equal(metrics.created, 10);
  assert.equal(metrics.claimed, 8);
  assert.equal(metrics.contacted, 7);
  assert.equal(metrics.decisionMakerReached, 5);
  assert.equal(metrics.qualified, 4);
  assert.equal(metrics.agreementCreated, 3);
  assert.equal(metrics.agreementSent, 3);
  assert.equal(metrics.agreementSigned, 2);
  assert.equal(metrics.paid, 1);
  assert.equal(metrics.revenue, 599);
  assert.equal(metrics.averageDealSize, 599);
  assert.equal(metrics.timeToClaimMedianMinutes, 4);
  assert.equal(metrics.timeToContactMedianMinutes, 10);
  assert.equal(metrics.sla.INBOUND.eligible, 2);
  assert.equal(metrics.sla.INBOUND.within, 2);
  assert.equal(metrics.sla.AD_RESPONSE.eligible, 2);
  assert.equal(metrics.sla.AD_RESPONSE.within, 2);
  assert.equal(metrics.lossReasons.NO_BUDGET, 1);
  assert.equal(metrics.coldBreakdown.territory["רחוב הרצל, יבנה"], 6);
  assert.equal(metrics.coldBreakdown.businessCategory.SERVICE, 6);
  assert.equal(metrics.coldBreakdown.score["3"], 6);
  assert.equal(metrics.coldBreakdown.callAngleId["speed-v1"], 1);
});

test("keeps conversions after the date range in the created-lead cohort and excludes outbound from SLA", () => {
  const inRange = row(0);
  inRange.events.push(event("CLAIMED", 2));
  const outbound = row(5);
  outbound.events.push(event("CLAIMED", 1));
  const unclaimedInbound = row(1);
  const outside = row(9);
  outside.createdAt = new Date("2026-08-01T09:00:00.000Z");
  outside.events.push(event("CLAIMED", 1));

  const metrics = calculateLeadMetrics([inRange, outbound, unclaimedInbound, outside], cohort, {
    slaMinutes: { INBOUND: 5, AD_RESPONSE: 15 },
  });

  assert.equal(metrics.created, 3);
  assert.equal(metrics.claimed, 2);
  assert.equal(metrics.sla.INBOUND.eligible, 2);
  assert.equal(metrics.sla.INBOUND.within, 1);
  assert.equal("OUTBOUND" in metrics.sla, false);
});
