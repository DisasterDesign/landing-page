import assert from "node:assert/strict";
import test from "node:test";

import {
  createLeadFromSource,
  type LeadCreationStore,
  type LeadPostCommitEffect,
} from "./lifecycle";
import { resolveMetaLeadCaptureTiming } from "./meta-ingestion";

type StoredLead = Record<string, unknown> & {
  id: string;
  sourceKey: string | null;
  externalLeadId: string | null;
  intentLevel: string | null;
  sourceSnapshot: Record<string, unknown> | null;
  migrationReviewRequired: boolean;
  migrationReviewReason: string | null;
  phoneProvenance: string | null;
  createdAt: Date;
  name: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
};

function fakeIngestionStore(options: {
  admins?: string[];
  suppressed?: boolean;
} = {}): LeadCreationStore & {
  leads: StoredLead[];
  events: Array<Record<string, unknown>>;
  notifications: LeadPostCommitEffect[];
  createdCount: number;
} {
  const leads: StoredLead[] = [];
  const events: Array<Record<string, unknown>> = [];
  const notifications: LeadPostCommitEffect[] = [];
  let createdCount = 0;

  const transaction = {
    contactSubmission: {
      async findUnique({ where }: { where: Record<string, unknown> }) {
        if (typeof where.id === "string") {
          return leads.find((lead) => lead.id === where.id) ?? null;
        }
        const pair = where.sourceKey_externalLeadId as
          | { sourceKey: string; externalLeadId: string }
          | undefined;
        if (pair) {
          return (
            leads.find(
              (lead) =>
                lead.sourceKey === pair.sourceKey &&
                lead.externalLeadId === pair.externalLeadId,
            ) ?? null
          );
        }
        return null;
      },
      async createMany({ data }: { data: Record<string, unknown> }) {
        const exists = leads.some(
          (lead) =>
            lead.externalLeadId === data.externalLeadId &&
            lead.sourceKey === data.sourceKey,
        );
        if (exists) return { count: 0 };
        createdCount += 1;
        leads.push({
          ...(data as StoredLead),
          id: `lead-${leads.length + 1}`,
        });
        return { count: 1 };
      },
      async create({ data }: { data: Record<string, unknown> }) {
        createdCount += 1;
        const lead = {
          ...(data as StoredLead),
          id: `lead-${leads.length + 1}`,
        };
        leads.push(lead);
        return lead;
      },
      async update({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) {
        const lead = leads.find((candidate) => candidate.id === where.id);
        if (!lead) throw new Error("missing fake lead");
        Object.assign(lead, data);
        return lead;
      },
    },
    prospectSuppression: {
      async findFirst() {
        return options.suppressed ? { id: "suppression-1" } : null;
      },
    },
    user: {
      async findMany() {
        return (options.admins ?? ["admin-1"]).map((id) => ({ id }));
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
  };

  return {
    suppressionHashSecret: "test-suppression-secret",
    get createdCount() {
      return createdCount;
    },
    leads,
    events,
    notifications,
    async transaction(callback) {
      return callback(transaction as never);
    },
    async findLead(leadId) {
      return (leads.find((lead) => lead.id === leadId) ?? null) as never;
    },
    async runEffect(effect) {
      notifications.push(effect);
    },
  };
}

const websiteInput = {
  intentLevel: "INBOUND" as const,
  sourceKey: "website",
  sourceSnapshot: {
    landingPage: "/contact",
    service: "בניית אתר",
    receivedAt: "2026-07-23T07:00:00.000Z",
  },
  eligibleSellerId: "seller-1",
  name: "נועה",
  company: "סטודיו נועה",
  email: "noa@example.com",
  phone: "0501234567",
  message: "אשמח לשמוע פרטים",
};

const metaInput = {
  intentLevel: "AD_RESPONSE" as const,
  sourceKey: "meta_lead_ads",
  externalLeadId: "meta-1",
  sourceSnapshot: {
    campaignId: "campaign-1",
    formId: "form-1",
    externalLeadId: "meta-1",
    nonContactAnswers: [{ name: "service", values: ["online store"] }],
    receivedAt: "2026-07-22T08:30:00.000Z",
  },
  occurredAt: new Date("2026-07-22T08:30:00.000Z"),
  eligibleSellerId: "seller-1",
  name: "יובל",
  email: "yuval@example.com",
  phone: "0521234567",
  message: "חנות אונליין",
};

test("website capture creates a canonical inbound lead without contact data in its snapshot", async () => {
  const store = fakeIngestionStore();
  const website = await createLeadFromSource(websiteInput, { store });
  assert.equal(website.intentLevel, "INBOUND");
  assert.equal(website.sourceKey, "website");
  assert.equal(website.migrationReviewRequired, false);
  assert.equal(website.phoneProvenance, "FIRST_PARTY_FORM");
  assert.equal("phone" in (website.sourceSnapshot as object), false);
  assert.equal("email" in (website.sourceSnapshot as object), false);
  assert.equal(store.notifications[0]?.input.recipientId, "seller-1");
});

test("Meta retries are idempotent and immutable attribution conflicts fail closed", async () => {
  const store = fakeIngestionStore();
  const first = await createLeadFromSource(metaInput, { store });
  const retry = await createLeadFromSource(metaInput, { store });
  assert.equal(first.id, retry.id);
  assert.equal(store.createdCount, 1);
  assert.equal(store.notifications.length, 1);
  assert.equal(store.notifications[0]?.input.recipientId, "seller-1");

  await assert.rejects(
    createLeadFromSource(
      { ...metaInput, intentLevel: "INBOUND" as never },
      { store },
    ),
    /intent|immutable|source/i,
  );
});

test("source occurrence time is distinct from ingestion recording time", async () => {
  const store = fakeIngestionStore();
  const lead = await createLeadFromSource(metaInput, { store });
  assert.equal(lead.createdAt.toISOString(), "2026-07-22T08:30:00.000Z");
  const event = store.events.find((candidate) => candidate.type === "CREATED");
  assert.equal(
    (event?.occurredAt as Date).toISOString(),
    "2026-07-22T08:30:00.000Z",
  );
});

test("historical sync creates no seller notification or stale SLA", async () => {
  const store = fakeIngestionStore();
  const lead = await createLeadFromSource(
    { ...metaInput, captureMode: "HISTORICAL_SYNC" },
    { store },
  );
  assert.equal(store.notifications.length, 0);
  assert.ok(lead.slaAlertedAt instanceof Date);
  assert.ok(lead.slaEscalatedAt instanceof Date);
});

test("retry fills only missing contact fields and preserves immutable source evidence", async () => {
  const store = fakeIngestionStore();
  const first = await createLeadFromSource(
    {
      ...metaInput,
      name: undefined,
      email: undefined,
      phone: undefined,
      message: undefined,
    },
    { store },
  );
  const originalSnapshot = structuredClone(first.sourceSnapshot);
  await createLeadFromSource(
    {
      ...metaInput,
      name: "יובל",
      email: "yuval@example.com",
      phone: "0521234567",
      message: "חנות אונליין",
      sourceSnapshot: {
        ...metaInput.sourceSnapshot,
        campaignId: "must-not-overwrite",
      },
    },
    { store },
  );
  assert.equal(store.leads[0].name, "יובל");
  assert.equal(store.leads[0].phone, "0521234567");
  assert.deepEqual(store.leads[0].sourceSnapshot, originalSnapshot);
  assert.deepEqual(
    store.events.find(
      (event) => event.type === "CONTACT_DETAILS_UPDATED",
    )?.metadata,
    { changedFields: ["name", "email", "phone", "message"] },
  );

  await createLeadFromSource(
    { ...metaInput, name: "אסור להחליף", phone: "0500000000" },
    { store },
  );
  assert.equal(store.leads[0].name, "יובל");
  assert.equal(store.leads[0].phone, "0521234567");
});

test("forced review and permanent suppression notify admins instead of sellers", async () => {
  const invalidTimeStore = fakeIngestionStore({ admins: ["admin-1"] });
  const invalid = await createLeadFromSource(
    {
      ...metaInput,
      captureMode: "HISTORICAL_SYNC",
      forcedReviewReason: "META_SOURCE_TIME_INVALID",
    },
    { store: invalidTimeStore },
  );
  assert.equal(invalid.migrationReviewRequired, true);
  assert.equal(invalid.migrationReviewReason, "META_SOURCE_TIME_INVALID");
  assert.deepEqual(
    invalidTimeStore.notifications.map((effect) => effect.input.recipientId),
    ["admin-1"],
  );

  const suppressionStore = fakeIngestionStore({ suppressed: true, admins: ["admin-2"] });
  const suppressed = await createLeadFromSource(metaInput, {
    store: suppressionStore,
  });
  assert.ok(suppressed.doNotContactAt instanceof Date);
  assert.equal(suppressed.migrationReviewRequired, true);
  assert.deepEqual(
    suppressionStore.notifications.map((effect) => effect.input.recipientId),
    ["admin-2"],
  );
});

test("the same raw external ID creates distinct leads for distinct sources after hardening", async () => {
  const store = fakeIngestionStore();
  const meta = await createLeadFromSource(metaInput, { store });
  const googleSearch = await createLeadFromSource(
    {
      intentLevel: "INBOUND",
      sourceKey: "google_search_ads",
      externalLeadId: "meta-1",
      sourceSnapshot: {
        campaignId: "google-campaign-1",
        landingPage: "/contact",
        receivedAt: "2026-07-23T08:00:00.000Z",
      },
      eligibleSellerId: "seller-1",
      name: "יובל",
      email: "yuval@example.com",
      phone: "0521234567",
    },
    { store },
  );

  assert.notEqual(meta.id, googleSearch.id);
  assert.equal(store.createdCount, 2);
  assert.deepEqual(
    store.leads.map(({ sourceKey, externalLeadId }) => ({
      sourceKey,
      externalLeadId,
    })),
    [
      { sourceKey: "meta_lead_ads", externalLeadId: "meta-1" },
      { sourceKey: "google_search_ads", externalLeadId: "meta-1" },
    ],
  );

  const retry = await createLeadFromSource(
    {
      intentLevel: "INBOUND",
      sourceKey: "google_search_ads",
      externalLeadId: "meta-1",
      sourceSnapshot: {
        campaignId: "google-campaign-1",
        landingPage: "/contact",
        receivedAt: "2026-07-23T08:00:00.000Z",
      },
      eligibleSellerId: "seller-1",
      name: "יובל",
    },
    { store },
  );
  assert.equal(retry.id, googleSearch.id);
  assert.equal(store.createdCount, 2);
});

test("Meta timing policy distinguishes live, historical and invalid source time", () => {
  const now = new Date("2026-07-23T10:00:00.000Z");
  assert.deepEqual(
    resolveMetaLeadCaptureTiming(
      "2026-07-23T09:45:00.000Z",
      "CRON_SYNC",
      now,
    ),
    {
      occurredAt: new Date("2026-07-23T09:45:00.000Z"),
      captureMode: "LIVE",
    },
  );
  assert.equal(
    resolveMetaLeadCaptureTiming(
      "2026-07-22T09:45:00.000Z",
      "CRON_SYNC",
      now,
    ).captureMode,
    "HISTORICAL_SYNC",
  );
  assert.equal(
    resolveMetaLeadCaptureTiming(
      "2026-07-23T09:45:00.000Z",
      "MANUAL_SYNC",
      now,
    ).captureMode,
    "HISTORICAL_SYNC",
  );
  assert.deepEqual(
    resolveMetaLeadCaptureTiming("invalid", "WEBHOOK", now),
    {
      occurredAt: now,
      captureMode: "HISTORICAL_SYNC",
      forcedReviewReason: "META_SOURCE_TIME_INVALID",
    },
  );
});
