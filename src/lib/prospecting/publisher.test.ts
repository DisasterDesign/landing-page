import assert from "node:assert/strict";
import test from "node:test";

import {
  publishProspectAsLead,
  selectPublishableProspects,
} from "./publisher";

function prospect(
  id: string,
  overrides: Partial<Parameters<typeof selectPublishableProspects>[0][number]> = {},
) {
  return {
    id,
    status: "READY" as const,
    qualityScore: 2,
    auditConfidence: 0.8,
    commercialFit: 5,
    salesFitClassification: "INDEPENDENT_LIKELY" as const,
    salesFitConfidence: 0.9,
    ownerReachabilityScore: 80,
    auditedDomain: `${id}.example`,
    hasLivePhone: true,
    displayName: `עסק ${id}`,
    discoveredAt: new Date("2026-07-01T00:00:00Z"),
    ...overrides,
  };
}

test("publication excludes score five, suppressed and existing-client domains", () => {
  const selected = selectPublishableProspects(
    [
      prospect("good-target", { qualityScore: 4 }),
      prospect("too-good", { qualityScore: 5 }),
      prospect("suppressed", { status: "SUPPRESSED" }),
      prospect("existing", { auditedDomain: "client.example" }),
    ],
    { existingDomains: new Set(["client.example"]) },
  );

  assert.deepEqual(selected.map(({ id }) => id), ["good-target"]);
});

test("missing phones are skipped and later candidates backfill the batch", () => {
  const candidates = [
    prospect("no-phone", { qualityScore: 0, hasLivePhone: false }),
    ...Array.from({ length: 55 }, (_, index) => prospect(`lead-${index}`)),
  ];
  const selected = selectPublishableProspects(candidates);

  assert.equal(selected.length, 50);
  assert.equal(selected.some(({ id }) => id === "no-phone"), false);
  assert.equal(candidates.length, 56);
  assert.equal(candidates.filter(({ id }) => !selected.some((item) => item.id === id)).length, 6);
});

test("publication order is bad score first, then confidence, commercial fit and age", () => {
  const selected = selectPublishableProspects([
    prospect("new", { qualityScore: 2, auditConfidence: 0.9, discoveredAt: new Date("2026-07-02") }),
    prospect("commercial", { qualityScore: 2, auditConfidence: 0.9, commercialFit: 9 }),
    prospect("confident", { qualityScore: 2, auditConfidence: 0.95 }),
    prospect("worst", { qualityScore: 0 }),
  ]);

  assert.deepEqual(selected.map(({ id }) => id), ["worst", "confident", "commercial", "new"]);
});

test("publication requires sales fit and orders by website then owner reachability", () => {
  const selected = selectPublishableProspects([
    prospect("chain", {
      salesFitClassification: "CHAIN_OR_FRANCHISE",
      salesFitConfidence: 1,
      ownerReachabilityScore: 0,
    }),
    prospect("uncertain", {
      salesFitClassification: "UNCERTAIN",
      salesFitConfidence: 0.95,
      ownerReachabilityScore: 95,
    }),
    prospect("reachable", { ownerReachabilityScore: 90 }),
    prospect("less-reachable", { ownerReachabilityScore: 75 }),
  ]);

  assert.deepEqual(selected.map(({ id }) => id), ["reachable", "less-reachable"]);
});

test("publication excludes missing names and existing canonical Place IDs", () => {
  const selected = selectPublishableProspects(
    [
      prospect("missing-name", { displayName: " " }),
      prospect("duplicate", { placeId: "place-duplicate" }),
      prospect("new", { placeId: "place-new" }),
    ],
    {
      existingExternalLeadIds: new Set(["gplaces:place-duplicate"]),
    },
  );
  assert.deepEqual(selected.map(({ id }) => id), ["new"]);
});

function fakePublicationTransaction(
  seed: Array<Record<string, unknown> & { id: string }> = [],
) {
  const leads = [...seed];
  const events: Array<Record<string, unknown> & { id: string }> = [];
  const prospect = { id: "prospect-1", promotedLeadId: null as string | null };
  return {
    leads,
    events,
    prospect,
    transaction: {
      contactSubmission: {
        async findUnique({ where }: { where: Record<string, unknown> }) {
          const pair = where.sourceKey_externalLeadId as
            | { sourceKey: string; externalLeadId: string }
            | undefined;
          return pair
            ? leads.find(
                (lead) =>
                  lead.sourceKey === pair.sourceKey &&
                  lead.externalLeadId === pair.externalLeadId,
              ) ?? null
            : null;
        },
        async findFirst({
          where,
        }: {
          where: { externalLeadId: string; sourceKey?: string | null };
        }) {
          return (
            leads.find(
              (lead) =>
                lead.externalLeadId === where.externalLeadId &&
                (!Object.prototype.hasOwnProperty.call(where, "sourceKey") ||
                  lead.sourceKey === where.sourceKey),
            ) ?? null
          );
        },
        async createMany({ data }: { data: Record<string, unknown> }) {
          if (
            leads.some(
              (lead) =>
                lead.sourceKey === data.sourceKey &&
                lead.externalLeadId === data.externalLeadId,
            )
          ) {
            return { count: 0 };
          }
          leads.push({ id: `lead-${leads.length + 1}`, ...data });
          return { count: 1 };
        },
        async update({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }) {
          const lead = leads.find((candidate) => candidate.id === where.id);
          if (!lead) throw new Error("missing lead");
          Object.assign(lead, data);
          return lead;
        },
      },
      prospect: {
        async findUnique() {
          return prospect;
        },
        async update({ data }: { data: Record<string, unknown> }) {
          Object.assign(prospect, data);
          return prospect;
        },
      },
      leadEvent: {
        async create({ data }: { data: Record<string, unknown> }) {
          const event = { id: `event-${events.length + 1}`, ...data };
          events.push(event);
          return event;
        },
        async createMany({ data }: { data: Record<string, unknown> }) {
          if (
            data.dedupeKey &&
            events.some((event) => event.dedupeKey === data.dedupeKey)
          ) {
            return { count: 0 };
          }
          events.push({ id: `event-${events.length + 1}`, ...data });
          return { count: 1 };
        },
        async findUnique({ where }: { where: { dedupeKey: string } }) {
          return (
            events.find((event) => event.dedupeKey === where.dedupeKey) ?? null
          );
        },
      },
    },
  };
}

test("publishing the same prospect twice creates and links one canonical outbound lead", async () => {
  const fake = fakePublicationTransaction();
  const input = {
    prospect: {
      id: "prospect-1",
      placeId: "place-1",
      promotedLeadId: null,
      websiteStatus: "ACTIVE" as const,
      auditedDomain: "old.example",
      businessShape: "SERVICE",
      businessShapeVersion: 1,
      qualityScore: 2,
      scoringVersion: 3,
      opportunitySummary: "אתר איטי עם SEO חלש",
      callAngles: ["מהירות", "SEO"],
    },
    displayName: "סטודיו נועה",
    territory: "רחוב הרצל, יבנה",
    cycleId: "cycle-1",
    batchId: "batch-1",
    weekStart: new Date("2026-07-20T00:00:00.000Z"),
    sellerId: "seller-1",
    publishedAt: new Date("2026-07-23T08:00:00.000Z"),
  };

  const first = await publishProspectAsLead(
    fake.transaction as never,
    input,
  );
  const second = await publishProspectAsLead(
    fake.transaction as never,
    input,
  );
  assert.equal(first.leadId, second.leadId);
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(fake.leads.length, 1);
  assert.equal(fake.prospect.promotedLeadId, fake.leads[0].id);
  assert.equal(fake.leads[0].intentLevel, "OUTBOUND");
  assert.equal(fake.leads[0].sourceKey, "google_maps");
  assert.equal(fake.leads[0].company, "סטודיו נועה");
  assert.equal(fake.leads[0].name, null);
  assert.equal(fake.leads[0].phone, null);
  assert.equal(
    fake.events.filter((event) => event.type === "PUBLISHED").length,
    1,
  );
});

test("publication reports a new Google Maps lead when another source uses the same raw external ID", async () => {
  const fake = fakePublicationTransaction([
    {
      id: "other-source-lead",
      sourceKey: "manual_outbound",
      externalLeadId: "gplaces:place-1",
    },
  ]);

  const published = await publishProspectAsLead(fake.transaction as never, {
    prospect: {
      id: "prospect-1",
      placeId: "place-1",
      promotedLeadId: null,
      websiteStatus: "ACTIVE",
      auditedDomain: "old.example",
      businessShape: "SERVICE",
      businessShapeVersion: 1,
      qualityScore: 2,
      scoringVersion: 3,
      opportunitySummary: "אתר איטי עם SEO חלש",
      callAngles: ["מהירות", "SEO"],
    },
    displayName: "סטודיו נועה",
    territory: "רחוב הרצל, יבנה",
    cycleId: "cycle-1",
    batchId: "batch-1",
    weekStart: new Date("2026-07-20T00:00:00.000Z"),
    sellerId: "seller-1",
    publishedAt: new Date("2026-07-23T08:00:00.000Z"),
  });

  assert.equal(published.created, true);
  assert.equal(fake.leads.length, 2);
  assert.equal(fake.leads[1]?.sourceKey, "google_maps");
  assert.equal(fake.leads[1]?.externalLeadId, "gplaces:place-1");
});

test("no-site legacy business classification publishes with safe versioned fallback", async () => {
  const fake = fakePublicationTransaction();
  await publishProspectAsLead(fake.transaction as never, {
    prospect: {
      id: "prospect-1",
      placeId: "place-1",
      promotedLeadId: null,
      websiteStatus: "NO_WEBSITE",
      auditedDomain: null,
      businessShape: null,
      businessShapeVersion: null,
      qualityScore: 0,
      scoringVersion: null,
      opportunitySummary: null,
      callAngles: [],
    },
    displayName: "המספרה של דנה",
    territory: "המרכז המסחרי, יבנה",
    cycleId: "cycle-1",
    batchId: "batch-1",
    weekStart: new Date("2026-07-20T00:00:00.000Z"),
    sellerId: "seller-1",
    publishedAt: new Date("2026-07-23T08:00:00.000Z"),
  });
  assert.deepEqual(fake.leads[0].sourceSnapshot, {
    territory: "המרכז המסחרי, יבנה",
    cycleId: "cycle-1",
    batchId: "batch-1",
    weekStart: "2026-07-20T00:00:00.000Z",
    placeId: "place-1",
    websiteStatus: "NO_WEBSITE",
    auditedDomain: null,
    internalBusinessCategory: "UNKNOWN",
    internalBusinessCategoryVersion: 1,
    qualityScore: 0,
    scoringVersion: 1,
    opportunitySummary: "אין לעסק אתר שמיש כיום",
    callAngles: [],
  });
});
