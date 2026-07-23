import assert from "node:assert/strict";
import test from "node:test";

import {
  claimLead,
  releaseOrReassignLead,
  transitionLeadStage,
  type LeadLifecycleStore,
} from "./lifecycle";

interface FakeLead {
  id: string;
  ownerId: string | null;
  eligibleSellerId: string | null;
  migrationReviewRequired: boolean;
  doNotContactAt: Date | null;
  intentLevel: "OUTBOUND" | "AD_RESPONSE" | "INBOUND" | null;
  sourceKey: string | null;
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
  status: "NEW" | "IN_PROGRESS" | "CLOSED" | "LOST" | "SPAM";
  firstClaimedAt: Date | null;
  ownerAssignedAt: Date | null;
  source: string | null;
  acquisitionChannel:
    | "META"
    | "WEBSITE"
    | "GOOGLE_PROSPECTING"
    | "MANUAL"
    | "OTHER"
    | null;
  externalLeadId: string | null;
  externalFormId: string | null;
  externalFormName: string | null;
  externalCampaignId: string | null;
  externalAdId: string | null;
  nextFollowUpAt: Date | null;
  lastContactedAt: Date | null;
  closedAt: Date | null;
  lostAt: Date | null;
  wonAt: Date | null;
  qualifiedAt: Date | null;
  lossReason: string | null;
  lossReasonDetails: string | null;
  legacyStateHash: string | null;
  assignees: Array<{ id: string }>;
}

function makeLead(overrides: Partial<FakeLead> = {}): FakeLead {
  return {
    id: "lead-1",
    ownerId: null,
    eligibleSellerId: "seller-1",
    migrationReviewRequired: false,
    doNotContactAt: null,
    intentLevel: "OUTBOUND",
    sourceKey: "google_maps",
    stage: "NEW",
    status: "NEW",
    firstClaimedAt: null,
    ownerAssignedAt: null,
    source: "GOOGLE_PROSPECTING",
    acquisitionChannel: "GOOGLE_PROSPECTING",
    externalLeadId: "gplaces:place-1",
    externalFormId: null,
    externalFormName: null,
    externalCampaignId: null,
    externalAdId: null,
    nextFollowUpAt: null,
    lastContactedAt: null,
    closedAt: null,
    lostAt: null,
    wonAt: null,
    qualifiedAt: null,
    lossReason: null,
    lossReasonDetails: null,
    legacyStateHash: null,
    assignees: [],
    ...overrides,
  };
}

function fakeLifecycleStore(
  lead: FakeLead,
  options: {
    actorRoles?: Record<string, "ADMIN" | "SELLER">;
    scheduledFollowUps?: Array<{
      id: string;
      ownerId: string;
      reminderSentAt: Date | null;
    }>;
  } = {},
): LeadLifecycleStore & {
  events: Array<Record<string, unknown>>;
  notifications: Array<Record<string, unknown>>;
  lead: FakeLead;
} {
  const events: Array<Record<string, unknown>> = [];
  const notifications: Array<Record<string, unknown>> = [];
  const followUps = options.scheduledFollowUps ?? [];

  const transaction = {
    contactSubmission: {
      async findUnique() {
        return lead;
      },
      async updateMany({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) {
        if (
          where.ownerId === null &&
          (lead.ownerId !== null ||
            lead.eligibleSellerId !== where.eligibleSellerId ||
            lead.stage !== where.stage)
        ) {
          return { count: 0 };
        }
        Object.assign(lead, data);
        return { count: 1 };
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
    user: {
      async findUnique({ where }: { where: { id: string } }) {
        const role = options.actorRoles?.[where.id];
        return role ? { id: where.id, role } : null;
      },
    },
    leadEvent: {
      async create({ data }: { data: Record<string, unknown> }) {
        const row = { id: `event-${events.length + 1}`, ...data };
        events.push(row);
        return row;
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
    leadFollowUp: {
      async findMany() {
        return followUps;
      },
      async updateMany({ data }: { data: Record<string, unknown> }) {
        for (const followUp of followUps) Object.assign(followUp, data);
        return { count: followUps.length };
      },
    },
    notification: {
      async updateMany({ data }: { data: Record<string, unknown> }) {
        notifications.push(data);
        return { count: 1 };
      },
    },
  };

  return {
    lead,
    events,
    notifications,
    async transaction(callback) {
      return callback(transaction as never);
    },
    async findLead() {
      return lead as never;
    },
  };
}

test("claim succeeds once and is idempotent for the same owner", async () => {
  const store = fakeLifecycleStore(makeLead());
  assert.equal(
    (await claimLead({ leadId: "lead-1", sellerId: "seller-1" }, { store }))
      .ownerId,
    "seller-1",
  );
  assert.equal(
    (await claimLead({ leadId: "lead-1", sellerId: "seller-1" }, { store }))
      .ownerId,
    "seller-1",
  );
  assert.equal(
    store.events.filter((event) => event.type === "CLAIMED").length,
    1,
  );
  assert.equal(
    store.events.filter((event) => event.type === "PREPARATION_STARTED").length,
    1,
  );
  assert.equal(store.lead.stage, "PREPARING");
});

test("ineligible or second seller loses the claim race", async () => {
  const store = fakeLifecycleStore(makeLead());
  await assert.rejects(
    claimLead({ leadId: "lead-1", sellerId: "seller-2" }, { store }),
    /not eligible|already claimed/i,
  );
});

test("review, suppression and terminal state block claim", async () => {
  for (const override of [
    { migrationReviewRequired: true },
    { doNotContactAt: new Date() },
    { stage: "WON" as const },
  ]) {
    const store = fakeLifecycleStore(makeLead(override));
    await assert.rejects(
      claimLead({ leadId: "lead-1", sellerId: "seller-1" }, { store }),
      /review|contact|terminal/i,
    );
  }
});

test("reclaiming a released qualified lead preserves its funnel stage", async () => {
  const store = fakeLifecycleStore(makeLead({ stage: "QUALIFIED", status: "IN_PROGRESS" }));
  await claimLead({ leadId: "lead-1", sellerId: "seller-1" }, { store });
  assert.equal(store.lead.stage, "QUALIFIED");
  assert.equal(
    store.events.filter((event) => event.type === "PREPARATION_STARTED").length,
    0,
  );
});

test("seller cannot release even a lead they own", async () => {
  const store = fakeLifecycleStore(
    makeLead({ ownerId: "seller-1", stage: "CONTACTING", assignees: [{ id: "seller-1" }] }),
    { actorRoles: { "seller-1": "SELLER" } },
  );
  await assert.rejects(
    releaseOrReassignLead(
      {
        action: "RELEASE",
        leadId: "lead-1",
        reason: "Seller requested release",
        actor: { userId: "seller-1", role: "SELLER" },
      },
      { store },
    ),
    /admin/i,
  );
});

test("release requires explicit cancellation when an active follow-up exists", async () => {
  const store = fakeLifecycleStore(
    makeLead({ ownerId: "seller-1", stage: "CONTACTING", assignees: [{ id: "seller-1" }] }),
    {
      actorRoles: { "admin-1": "ADMIN" },
      scheduledFollowUps: [
        { id: "follow-up-1", ownerId: "seller-1", reminderSentAt: null },
      ],
    },
  );
  await assert.rejects(
    releaseOrReassignLead(
      {
        action: "RELEASE",
        leadId: "lead-1",
        reason: "Capacity balancing",
        actor: { userId: "admin-1", role: "ADMIN" },
      },
      { store },
    ),
    /follow-up/i,
  );
});

test("admin stage transition records structured loss and never closes as won", async () => {
  const store = fakeLifecycleStore(
    makeLead({ ownerId: "seller-1", stage: "CONTACTING", status: "IN_PROGRESS" }),
  );
  await transitionLeadStage(
    {
      leadId: "lead-1",
      toStage: "LOST",
      lossReason: "NO_BUDGET",
      reason: "No budget this quarter",
      actor: { userId: "admin-1", role: "ADMIN" },
    },
    { store },
  );
  assert.equal(store.lead.stage, "LOST");
  assert.equal(store.lead.status, "LOST");
  assert.equal(store.lead.lossReason, "NO_BUDGET");
  assert.equal(store.events.at(-1)?.type, "LOST");
});
