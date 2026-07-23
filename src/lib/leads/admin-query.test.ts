import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAdminLeadWhere,
  parseAdminLeadFilters,
} from "./admin-query";

test("admin filter parser validates every supported dimension", () => {
  const filters = parseAdminLeadFilters(
    new URLSearchParams({
      intent: "OUTBOUND",
      source: "google_maps",
      owner: "seller-1",
      stage: "PREPARING",
      from: "2026-07-01T00:00:00.000Z",
      to: "2026-07-31T23:59:59.000Z",
      territory: "יבנה",
      minScore: "1",
      maxScore: "5",
      businessCategory: "SERVICE",
      dateField: "lastActivityAt",
      overdue: "true",
      reviewRequired: "false",
      search: "נועה",
      limit: "75",
    }),
  );

  assert.equal(filters.intent, "OUTBOUND");
  assert.equal(filters.source, "google_maps");
  assert.equal(filters.stage, "PREPARING");
  assert.equal(filters.dateField, "lastActivityAt");
  assert.equal(filters.overdue, true);
  assert.equal(filters.reviewRequired, false);
  assert.equal(filters.limit, 75);
  assert.equal(filters.maxScore, 5);
  assert.equal(filters.from?.toISOString(), "2026-07-01T00:00:00.000Z");
});

test("admin filter parser rejects malformed ranges, booleans and cursors", () => {
  assert.throws(
    () => parseAdminLeadFilters(new URLSearchParams({ minScore: "4", maxScore: "2" })),
    /filter/i,
  );
  assert.throws(
    () => parseAdminLeadFilters(new URLSearchParams({ overdue: "yes" })),
    /filter/i,
  );
  assert.throws(
    () => parseAdminLeadFilters(new URLSearchParams({ cursor: "not-a-cursor" })),
    /cursor|filter/i,
  );
});

test("admin where combines canonical, source, activity and overdue filters", () => {
  const now = new Date("2026-07-23T10:00:00.000Z");
  const where = buildAdminLeadWhere(
    {
      intent: "OUTBOUND",
      source: "google_maps",
      owner: "UNASSIGNED",
      stage: "NEW",
      from: new Date("2026-07-01T00:00:00.000Z"),
      to: new Date("2026-07-31T23:59:59.000Z"),
      territory: "יבנה",
      minScore: 1,
      maxScore: 4,
      businessCategory: "SERVICE",
      dateField: "lastActivityAt",
      overdue: true,
      reviewRequired: false,
      search: "נועה",
      limit: 50,
    },
    now,
  ) as Record<string, unknown>;

  assert.equal(where.intentLevel, "OUTBOUND");
  assert.equal(where.sourceKey, "google_maps");
  assert.equal(where.ownerId, null);
  assert.equal(where.stage, "NEW");
  assert.equal(where.migrationReviewRequired, false);
  assert.deepEqual(where.followUps, {
    some: { status: "SCHEDULED", dueAt: { lt: now } },
  });
  const and = where.AND as Array<Record<string, unknown>>;
  assert.ok(and.length >= 6);
  assert.ok(and.some((entry) => "OR" in entry));
  assert.ok(and.some((entry) => "events" in entry));
});

test("created-at range stays on the lead row and limit is capped", () => {
  const filters = parseAdminLeadFilters(
    new URLSearchParams({
      from: "2026-07-01T00:00:00.000Z",
      to: "2026-07-31T23:59:59.000Z",
      dateField: "createdAt",
      limit: "1000",
    }),
  );
  assert.equal(filters.limit, 100);
  const where = buildAdminLeadWhere(filters, new Date()) as {
    createdAt?: { gte?: Date; lte?: Date };
  };
  assert.equal(where.createdAt?.gte?.toISOString(), "2026-07-01T00:00:00.000Z");
  assert.equal(where.createdAt?.lte?.toISOString(), "2026-07-31T23:59:59.000Z");
});
