import assert from "node:assert/strict";
import test from "node:test";

import {
  correctLeadSource,
  resolveLeadMigrationReview,
  updateLeadContactDetails,
} from "./corrections";
import type { LeadLifecycleStore } from "./lifecycle";

type FakeLead = Record<string, unknown> & {
  id: string;
  ownerId: string | null;
  eligibleSellerId: string | null;
  migrationReviewRequired: boolean;
  intentLevel: "OUTBOUND" | "AD_RESPONSE" | "INBOUND" | null;
  sourceKey: string | null;
  sourceSnapshot: Record<string, unknown> | null;
  stage:
    | "NEW"
    | "PREPARING"
    | "CONTACTING"
    | "QUALIFIED"
    | "AGREEMENT_DRAFT"
    | "AGREEMENT_SENT"
    | "AGREEMENT_SIGNED"
    | "WON"
    | "LOST"
    | "SPAM"
    | null;
  assignees: Array<{ id: string; role?: "ADMIN" | "SELLER" | "MEMBER" }>;
};

function canonicalLead(overrides: Partial<FakeLead> = {}): FakeLead {
  return {
    id: "lead-1",
    name: "נועה",
    email: null,
    phone: null,
    company: "סטודיו נועה",
    message: null,
    ownerId: "seller-1",
    eligibleSellerId: "seller-1",
    migrationReviewRequired: false,
    migrationReviewReason: null,
    intentLevel: "AD_RESPONSE",
    sourceKey: "meta_lead_ads",
    sourceSnapshot: {
      externalLeadId: "meta-1",
      nonContactAnswers: [],
      receivedAt: "2026-07-23T07:00:00.000Z",
    },
    externalLeadId: "meta-1",
    phoneProvenance: null,
    stage: "CONTACTING",
    status: "IN_PROGRESS",
    source: "FACEBOOK",
    acquisitionChannel: "META",
    externalFormId: null,
    externalFormName: null,
    externalCampaignId: null,
    externalAdId: null,
    nextFollowUpAt: null,
    lastContactedAt: null,
    closedAt: null,
    wonAt: null,
    lostAt: null,
    lossReason: null,
    lossReasonDetails: null,
    legacyStateHash: null,
    assignees: [{ id: "seller-1", role: "SELLER" }],
    ...overrides,
  };
}

function fakeCorrectionStore(
  lead: FakeLead,
  options: {
    roles?: Record<string, "ADMIN" | "SELLER">;
    collision?: boolean;
    paidAt?: Date | null;
    verifiedPayment?: boolean;
  } = {},
): LeadLifecycleStore & { lead: FakeLead; events: Array<Record<string, unknown>> } {
  const events: Array<Record<string, unknown>> = [];
  const transaction = {
    user: {
      async findUnique({ where }: { where: { id: string } }) {
        const role = options.roles?.[where.id];
        return role ? { id: where.id, role } : null;
      },
    },
    contactSubmission: {
      async findUnique() {
        return lead;
      },
      async findFirst() {
        return options.collision ? { id: "lead-2" } : null;
      },
      async update({ data }: { data: Record<string, unknown> }) {
        const assignees = data.assignees as
          | { set?: Array<{ id: string }> }
          | undefined;
        if (assignees?.set) lead.assignees = assignees.set;
        const scalar = { ...data };
        delete scalar.assignees;
        Object.assign(lead, scalar);
        return lead;
      },
    },
    agreement: {
      async findMany() {
        if (!options.paidAt) return [];
        return [
          {
            id: "agreement-1",
            paymentId: options.verifiedPayment ? "low-profile-1" : null,
            paidAt: options.paidAt,
            paidAmount: 599,
            paymentStatus: "COMPLETED",
            cardcomDealId: "deal-1",
            cardcomVerifiedLowProfileId: options.verifiedPayment
              ? "low-profile-1"
              : null,
            cardcomVerifiedReturnValue: options.verifiedPayment
              ? "agreement-1"
              : null,
            cardcomVerifiedTransactionId: options.verifiedPayment
              ? "deal-1"
              : null,
            cardcomVerifiedAmount: options.verifiedPayment ? 599 : null,
            cardcomPaymentVerifiedAt: options.verifiedPayment
              ? new Date("2026-07-21T10:00:05.000Z")
              : null,
          },
        ];
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
    lead,
    events,
    async transaction(callback) {
      return callback(transaction as never);
    },
    async findLead() {
      return lead as never;
    },
  };
}

const correctedWebsiteSnapshot = {
  landingPage: "/contact",
  receivedAt: "2026-07-23T07:15:00.000Z",
};

test("only an admin may correct immutable source attribution", async () => {
  const sellerStore = fakeCorrectionStore(canonicalLead(), {
    roles: { "seller-1": "SELLER" },
  });
  await assert.rejects(
    correctLeadSource(
      {
        leadId: "lead-1",
        intentLevel: "INBOUND",
        sourceKey: "website",
        sourceSnapshot: correctedWebsiteSnapshot,
        reason: "Meta webhook mapped the wrong form",
        actor: { userId: "seller-1", role: "SELLER" },
      },
      { store: sellerStore },
    ),
    /admin/i,
  );

  const adminStore = fakeCorrectionStore(canonicalLead(), {
    roles: { "admin-1": "ADMIN" },
  });
  await correctLeadSource(
    {
      leadId: "lead-1",
      intentLevel: "INBOUND",
      sourceKey: "website",
      sourceSnapshot: correctedWebsiteSnapshot,
      reason: "Meta webhook mapped the wrong form",
      actor: { userId: "admin-1", role: "ADMIN" },
    },
    { store: adminStore },
  );
  assert.equal(adminStore.events.at(-1)?.type, "SOURCE_CORRECTED");
  assert.deepEqual(adminStore.events.at(-1)?.metadata, {
    reason: "Meta webhook mapped the wrong form",
    before: { intentLevel: "AD_RESPONSE", sourceKey: "meta_lead_ads" },
    after: { intentLevel: "INBOUND", sourceKey: "website" },
  });
});

test("source correction advances outbound preparation but never regresses later stages", async () => {
  const preparing = fakeCorrectionStore(
    canonicalLead({
      intentLevel: "OUTBOUND",
      sourceKey: "google_maps",
      stage: "PREPARING",
    }),
    { roles: { "admin-1": "ADMIN" } },
  );
  await correctLeadSource(
    {
      leadId: "lead-1",
      intentLevel: "INBOUND",
      sourceKey: "website",
      sourceSnapshot: correctedWebsiteSnapshot,
      reason: "Actually received through the contact form",
      actor: { userId: "admin-1", role: "ADMIN" },
    },
    { store: preparing },
  );
  assert.equal(preparing.lead.stage, "CONTACTING");

  const qualified = fakeCorrectionStore(canonicalLead({ stage: "QUALIFIED" }), {
    roles: { "admin-1": "ADMIN" },
  });
  await correctLeadSource(
    {
      leadId: "lead-1",
      intentLevel: "INBOUND",
      sourceKey: "website",
      sourceSnapshot: correctedWebsiteSnapshot,
      reason: "Correcting only the source",
      actor: { userId: "admin-1", role: "ADMIN" },
    },
    { store: qualified },
  );
  assert.equal(qualified.lead.stage, "QUALIFIED");
});

test("source correction preserves the external source identity contract", async () => {
  const metaStore = fakeCorrectionStore(canonicalLead(), {
    roles: { "admin-1": "ADMIN" },
  });
  await assert.rejects(
    correctLeadSource(
      {
        leadId: "lead-1",
        intentLevel: "AD_RESPONSE",
        sourceKey: "meta_lead_ads",
        externalLeadId: "meta-top-level",
        sourceSnapshot: {
          externalLeadId: "meta-different",
          nonContactAnswers: [],
          receivedAt: "2026-07-23T07:00:00.000Z",
        },
        reason: "Trying to repair attribution",
        actor: { userId: "admin-1", role: "ADMIN" },
      },
      { store: metaStore },
    ),
    /external ID does not match/i,
  );

  const googleStore = fakeCorrectionStore(canonicalLead(), {
    roles: { "admin-1": "ADMIN" },
  });
  await assert.rejects(
    correctLeadSource(
      {
        leadId: "lead-1",
        intentLevel: "OUTBOUND",
        sourceKey: "google_maps",
        externalLeadId: "gplaces:place-other",
        sourceSnapshot: {
          territory: "רחוב הרצל, יבנה",
          cycleId: "cycle-1",
          batchId: "batch-1",
          weekStart: "2026-07-20T00:00:00.000Z",
          placeId: "place-1",
          websiteStatus: "NO_WEBSITE",
          auditedDomain: null,
          internalBusinessCategory: "RETAIL",
          internalBusinessCategoryVersion: 1,
          qualityScore: 0,
          scoringVersion: 3,
          opportunitySummary: "לא נמצא אתר פעיל",
          callAngles: [],
        },
        reason: "Trying to repair attribution",
        actor: { userId: "admin-1", role: "ADMIN" },
      },
      { store: googleStore },
    ),
    /Place ID/i,
  );
});

test("seller-confirmed contact data receives provenance without leaking values to events", async () => {
  const store = fakeCorrectionStore(canonicalLead(), {
    roles: { "seller-1": "SELLER" },
  });
  await updateLeadContactDetails(
    {
      leadId: "lead-1",
      details: { phone: "0501234567" },
      confirmation: "SELLER_CONFIRMED",
      actor: { userId: "seller-1", role: "SELLER" },
    },
    { store },
  );
  assert.equal(store.lead.phoneProvenance, "SELLER_CONFIRMED");
  assert.deepEqual(store.events.at(-1)?.metadata, {
    changedFields: ["phone"],
    confirmation: "SELLER_CONFIRMED",
  });

  await assert.rejects(
    updateLeadContactDetails(
      {
        leadId: "lead-1",
        details: { phone: "0509999999" },
        confirmation: "GOOGLE" as never,
        actor: { userId: "seller-1", role: "SELLER" },
      },
      { store },
    ),
    /confirmation|provenance/i,
  );
});

test("admin contact correction requires and audits a reason", async () => {
  const store = fakeCorrectionStore(canonicalLead(), {
    roles: { "admin-1": "ADMIN" },
  });
  await assert.rejects(
    updateLeadContactDetails(
      {
        leadId: "lead-1",
        details: { email: "new@example.com" },
        confirmation: "ADMIN_CONFIRMED",
        actor: { userId: "admin-1", role: "ADMIN" },
      },
      { store },
    ),
    /reason/i,
  );
  await updateLeadContactDetails(
    {
      leadId: "lead-1",
      details: { email: "new@example.com" },
      confirmation: "ADMIN_CONFIRMED",
      reason: "Verified with the customer",
      actor: { userId: "admin-1", role: "ADMIN" },
    },
    { store },
  );
  assert.deepEqual(store.events.at(-1)?.metadata, {
    changedFields: ["email"],
    confirmation: "ADMIN_CONFIRMED",
    reason: "Verified with the customer",
  });
});

test("do-not-contact blocks seller and admin contact updates", async () => {
  for (const actor of [
    { userId: "seller-1", role: "SELLER" as const },
    { userId: "admin-1", role: "ADMIN" as const },
  ]) {
    const store = fakeCorrectionStore(
      canonicalLead({ doNotContactAt: new Date() }),
      { roles: { "seller-1": "SELLER", "admin-1": "ADMIN" } },
    );
    await assert.rejects(
      updateLeadContactDetails(
        {
          leadId: "lead-1",
          details: { phone: "0501234567" },
          confirmation:
            actor.role === "SELLER"
              ? "SELLER_CONFIRMED"
              : "ADMIN_CONFIRMED",
          actor,
        },
        { store },
      ),
      /contact/i,
    );
  }
});

test("migration resolution is admin-only, complete, collision-safe and payment-aware", async () => {
  const unresolved = canonicalLead({
    ownerId: null,
    eligibleSellerId: null,
    migrationReviewRequired: true,
    migrationReviewReason: "SOURCE_OR_OWNERSHIP_REVIEW",
    intentLevel: null,
    sourceKey: null,
    sourceSnapshot: null,
    stage: null,
    status: "NEW",
    assignees: [],
  });
  const sellerStore = fakeCorrectionStore({ ...unresolved, assignees: [] }, {
    roles: { "seller-1": "SELLER" },
  });
  await assert.rejects(
    resolveLeadMigrationReview(
      {
        leadId: "lead-1",
        intentLevel: "INBOUND",
        sourceKey: "website",
        sourceSnapshot: correctedWebsiteSnapshot,
        stage: "NEW",
        ownerId: null,
        eligibleSellerId: "seller-1",
        reason: "Verified original contact form",
        version: 1,
        actor: { userId: "seller-1", role: "SELLER" },
      },
      { store: sellerStore },
    ),
    /admin/i,
  );
  assert.equal(sellerStore.lead.migrationReviewRequired, true);

  const adminStore = fakeCorrectionStore({ ...unresolved, assignees: [] }, {
    roles: { "admin-1": "ADMIN", "seller-1": "SELLER" },
  });
  await resolveLeadMigrationReview(
    {
      leadId: "lead-1",
      intentLevel: "INBOUND",
      sourceKey: "website",
      sourceSnapshot: correctedWebsiteSnapshot,
      stage: "NEW",
      ownerId: null,
      eligibleSellerId: "seller-1",
      reason: "Verified original contact form",
      version: 1,
      actor: { userId: "admin-1", role: "ADMIN" },
    },
    { store: adminStore },
  );
  assert.equal(adminStore.lead.migrationReviewRequired, false);
  assert.equal(adminStore.events.at(-1)?.type, "MIGRATED");

  const paidAt = new Date("2026-07-21T10:00:00.000Z");
  const paidStore = fakeCorrectionStore({ ...unresolved, assignees: [] }, {
    roles: { "admin-1": "ADMIN", "seller-1": "SELLER" },
    paidAt,
    verifiedPayment: true,
  });
  await resolveLeadMigrationReview(
    {
      leadId: "lead-1",
      intentLevel: "INBOUND",
      sourceKey: "website",
      sourceSnapshot: correctedWebsiteSnapshot,
      ownerId: null,
      eligibleSellerId: "seller-1",
      reason: "Payment and source evidence verified",
      version: 1,
      actor: { userId: "admin-1", role: "ADMIN" },
    },
    { store: paidStore },
  );
  assert.equal(paidStore.lead.stage, "WON");
  assert.equal(paidStore.lead.wonAt, paidAt);
});

test("migration resolution cannot clear an unverified historical payment", async () => {
  const paidAt = new Date("2026-07-21T10:00:00.000Z");
  const unresolved = canonicalLead({
    ownerId: null,
    migrationReviewRequired: true,
    intentLevel: null,
    sourceKey: null,
    stage: null,
    assignees: [],
  });
  const unverifiedStore = fakeCorrectionStore(unresolved, {
    roles: { "admin-1": "ADMIN", "seller-1": "SELLER" },
    paidAt,
  });

  await assert.rejects(
    resolveLeadMigrationReview(
      {
        leadId: "lead-1",
        intentLevel: "INBOUND",
        sourceKey: "website",
        sourceSnapshot: correctedWebsiteSnapshot,
        stage: "NEW",
        ownerId: null,
        eligibleSellerId: "seller-1",
        reason: "Local paid flag is not provider proof",
        version: 1,
        actor: { userId: "admin-1", role: "ADMIN" },
      },
      { store: unverifiedStore },
    ),
    /unverified|payment/i,
  );
  assert.equal(unverifiedStore.lead.migrationReviewRequired, true);
});

test("migration resolution may clear legacy admin-only assignments without manufacturing a seller owner", async () => {
  const unresolved = canonicalLead({
    ownerId: null,
    eligibleSellerId: null,
    migrationReviewRequired: true,
    migrationReviewReason: "LEGACY_OWNER_NOT_SELLER",
    assignees: [{ id: "legacy-admin", role: "ADMIN" }],
  });
  const store = fakeCorrectionStore(unresolved, {
    roles: {
      "actor-admin": "ADMIN",
      "legacy-admin": "ADMIN",
      "seller-1": "SELLER",
    },
  });

  await resolveLeadMigrationReview(
    {
      leadId: "lead-1",
      intentLevel: "AD_RESPONSE",
      sourceKey: "meta_lead_ads",
      externalLeadId: "meta-1",
      sourceSnapshot: {
        externalLeadId: "meta-1",
        nonContactAnswers: [],
        receivedAt: "2026-07-23T07:00:00.000Z",
      },
      stage: "LOST",
      ownerId: null,
      eligibleSellerId: "seller-1",
      reason:
        "Legacy assignment belongs only to an admin and is not seller ownership evidence",
      version: 1,
      actor: { userId: "actor-admin", role: "ADMIN" },
    },
    { store },
  );

  assert.equal(store.lead.ownerId, null);
  assert.equal(store.lead.eligibleSellerId, "seller-1");
  assert.deepEqual(store.lead.assignees, []);
  assert.equal(store.lead.migrationReviewRequired, false);
  assert.deepEqual(
    (store.events.at(-1)?.metadata as Record<string, unknown>)?.removedLegacyAssigneeIds,
    ["legacy-admin"],
  );
});

test("migration resolution may not erase legacy seller ownership evidence", async () => {
  const unresolved = canonicalLead({
    ownerId: null,
    migrationReviewRequired: true,
    migrationReviewReason: "LEGACY_MULTI_ASSIGNEE",
    assignees: [{ id: "seller-1", role: "SELLER" }],
  });
  const store = fakeCorrectionStore(unresolved, {
    roles: { "actor-admin": "ADMIN", "seller-1": "SELLER" },
  });

  await assert.rejects(
    resolveLeadMigrationReview(
      {
        leadId: "lead-1",
        intentLevel: "AD_RESPONSE",
        sourceKey: "meta_lead_ads",
        externalLeadId: "meta-1",
        sourceSnapshot: {
          externalLeadId: "meta-1",
          nonContactAnswers: [],
          receivedAt: "2026-07-23T07:00:00.000Z",
        },
        stage: "LOST",
        ownerId: null,
        eligibleSellerId: "seller-1",
        reason: "Trying to erase seller evidence",
        version: 1,
        actor: { userId: "actor-admin", role: "ADMIN" },
      },
      { store },
    ),
    /legacy admin assignment|ownership evidence/i,
  );
  assert.equal(store.lead.migrationReviewRequired, true);
  assert.deepEqual(store.lead.assignees, [
    { id: "seller-1", role: "SELLER" },
  ]);
});

test("migration resolution may not erase a non-admin legacy assignment", async () => {
  const unresolved = canonicalLead({
    ownerId: null,
    migrationReviewRequired: true,
    migrationReviewReason: "LEGACY_MULTI_ASSIGNEE",
    assignees: [{ id: "member-1", role: "MEMBER" }],
  });
  const store = fakeCorrectionStore(unresolved, {
    roles: {
      "actor-admin": "ADMIN",
      "seller-1": "SELLER",
    },
  });

  await assert.rejects(
    resolveLeadMigrationReview(
      {
        leadId: "lead-1",
        intentLevel: "AD_RESPONSE",
        sourceKey: "meta_lead_ads",
        externalLeadId: "meta-1",
        sourceSnapshot: {
          externalLeadId: "meta-1",
          nonContactAnswers: [],
          receivedAt: "2026-07-23T07:00:00.000Z",
        },
        stage: "LOST",
        ownerId: null,
        eligibleSellerId: "seller-1",
        reason: "Trying to erase a non-admin assignment",
        version: 1,
        actor: { userId: "actor-admin", role: "ADMIN" },
      },
      { store },
    ),
    /only legacy admin|non-admin/i,
  );
  assert.equal(store.lead.migrationReviewRequired, true);
  assert.deepEqual(store.lead.assignees, [
    { id: "member-1", role: "MEMBER" },
  ]);
});

test("migration resolution keeps the evidenced seller and removes only legacy admin assignments", async () => {
  const unresolved = canonicalLead({
    ownerId: null,
    eligibleSellerId: null,
    migrationReviewRequired: true,
    migrationReviewReason: "LEGACY_MULTI_ASSIGNEE",
    assignees: [
      { id: "legacy-admin", role: "ADMIN" },
      { id: "seller-1", role: "SELLER" },
    ],
  });
  const store = fakeCorrectionStore(unresolved, {
    roles: {
      "actor-admin": "ADMIN",
      "legacy-admin": "ADMIN",
      "seller-1": "SELLER",
    },
  });

  await resolveLeadMigrationReview(
    {
      leadId: "lead-1",
      intentLevel: "AD_RESPONSE",
      sourceKey: "meta_lead_ads",
      externalLeadId: "meta-1",
      sourceSnapshot: {
        externalLeadId: "meta-1",
        nonContactAnswers: [],
        receivedAt: "2026-07-23T07:00:00.000Z",
      },
      stage: "LOST",
      ownerId: "seller-1",
      eligibleSellerId: "seller-1",
      reason: "The seller assignment is supported by the legacy relation",
      version: 1,
      actor: { userId: "actor-admin", role: "ADMIN" },
    },
    { store },
  );

  assert.equal(store.lead.ownerId, "seller-1");
  assert.deepEqual(store.lead.assignees, [{ id: "seller-1" }]);
  const metadata = store.events.at(-1)?.metadata as
    | Record<string, unknown>
    | undefined;
  assert.deepEqual(metadata?.removedLegacyAssigneeIds, ["legacy-admin"]);
  assert.deepEqual(metadata?.before, {
    intentLevel: "AD_RESPONSE",
    sourceKey: "meta_lead_ads",
    stage: "CONTACTING",
    ownerId: null,
    eligibleSellerId: null,
    migrationReviewReason: "LEGACY_MULTI_ASSIGNEE",
    legacyAssignees: [
      { userId: "legacy-admin", role: "ADMIN" },
      { userId: "seller-1", role: "SELLER" },
    ],
  });
  assert.deepEqual(metadata?.after, {
    intentLevel: "AD_RESPONSE",
    sourceKey: "meta_lead_ads",
    stage: "LOST",
    ownerId: "seller-1",
    eligibleSellerId: "seller-1",
    assigneeIds: ["seller-1"],
  });
});

test("migration resolution rejects source collisions and manufactured won stages", async () => {
  const unresolved = canonicalLead({
    ownerId: null,
    migrationReviewRequired: true,
    intentLevel: null,
    sourceKey: null,
    stage: null,
    assignees: [],
  });
  const collision = fakeCorrectionStore(unresolved, {
    roles: { "admin-1": "ADMIN", "seller-1": "SELLER" },
    collision: true,
  });
  await assert.rejects(
    resolveLeadMigrationReview(
      {
        leadId: "lead-1",
        intentLevel: "AD_RESPONSE",
        sourceKey: "meta_lead_ads",
        externalLeadId: "meta-duplicate",
        sourceSnapshot: {
          externalLeadId: "meta-duplicate",
          nonContactAnswers: [],
          receivedAt: "2026-07-23T07:00:00.000Z",
        },
        stage: "NEW",
        ownerId: null,
        eligibleSellerId: "seller-1",
        reason: "Verified Meta record",
        version: 1,
        actor: { userId: "admin-1", role: "ADMIN" },
      },
      { store: collision },
    ),
    /duplicate|collision|source/i,
  );

  const manufacturedWon = fakeCorrectionStore(
    { ...unresolved, assignees: [] },
    { roles: { "admin-1": "ADMIN", "seller-1": "SELLER" } },
  );
  await assert.rejects(
    resolveLeadMigrationReview(
      {
        leadId: "lead-1",
        intentLevel: "INBOUND",
        sourceKey: "website",
        sourceSnapshot: correctedWebsiteSnapshot,
        stage: "WON" as never,
        ownerId: null,
        eligibleSellerId: "seller-1",
        reason: "Trying to force a won state",
        version: 1,
        actor: { userId: "admin-1", role: "ADMIN" },
      },
      { store: manufacturedWon },
    ),
    /payment|won/i,
  );
});
