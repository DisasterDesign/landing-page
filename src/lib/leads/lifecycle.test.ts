import assert from "node:assert/strict";
import test from "node:test";

import {
  claimLead,
  qualifyLeadFromLegacyClosed,
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
    actorRoles?: Record<string, "ADMIN" | "SELLER" | "MEMBER">;
    scheduledFollowUps?: Array<{
      id: string;
      ownerId: string;
      reminderSentAt: Date | null;
    }>;
  } = {},
): LeadLifecycleStore & {
  events: Array<Record<string, unknown>>;
  notifications: Array<Record<string, unknown>>;
  calls: string[];
  lead: FakeLead;
} {
  const events: Array<Record<string, unknown>> = [];
  const notifications: Array<Record<string, unknown>> = [];
  const calls: string[] = [];
  const followUps = options.scheduledFollowUps ?? [];

  const transaction = {
    contactSubmission: {
      async findUnique() {
        calls.push("contactSubmission.findUnique");
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
      async findUnique({
        where,
        select,
      }: {
        where: { id: string };
        select: { role: true };
      }) {
        calls.push("user.findUnique");
        assert.deepEqual(select, { role: true });
        const defaultRoles = {
          "seller-1": "SELLER",
          "seller-2": "SELLER",
        } as const;
        const role = options.actorRoles?.[where.id] ?? defaultRoles[
          where.id as keyof typeof defaultRoles
        ];
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
      async findFirst() {
        return followUps[0] ?? null;
      },
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
    calls,
    async transaction(callback) {
      calls.push("transaction");
      return callback(transaction as never);
    },
    async findLead() {
      return lead as never;
    },
  };
}

test("claim fails closed when the persisted seller role was revoked", async () => {
  const store = fakeLifecycleStore(makeLead(), {
    actorRoles: { "seller-1": "MEMBER" },
  });

  await assert.rejects(
    claimLead({ leadId: "lead-1", sellerId: "seller-1" }, { store }),
    /seller|role|authorized|forbidden/i,
  );

  assert.deepEqual(store.calls, ["transaction", "user.findUnique"]);
  assert.equal(store.lead.ownerId, null);
  assert.equal(store.events.length, 0);
});

test("claim never converts exhausted serialization retries into unauthorised success", async () => {
  const owned = makeLead({
    ownerId: "seller-1",
    assignees: [{ id: "seller-1" }],
  });
  let transactionCalls = 0;
  let unguardedReads = 0;
  const store: LeadLifecycleStore = {
    async transaction() {
      transactionCalls += 1;
      throw new Error("serialization write conflict");
    },
    async findLead() {
      unguardedReads += 1;
      return owned as never;
    },
  };

  await assert.rejects(
    claimLead({ leadId: "lead-1", sellerId: "seller-1" }, { store }),
    /serialization|write conflict/i,
  );

  assert.equal(transactionCalls, 3);
  assert.equal(unguardedReads, 0);
});

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

test("terminal transitions cancel the active follow-up in the same transaction", async () => {
  const store = fakeLifecycleStore(
    makeLead({
      ownerId: "seller-1",
      stage: "CONTACTING",
      status: "IN_PROGRESS",
      nextFollowUpAt: new Date(Date.now() + 60_000),
      assignees: [{ id: "seller-1" }],
    }),
    {
      scheduledFollowUps: [
        { id: "follow-up-1", ownerId: "seller-1", reminderSentAt: null },
      ],
    },
  );

  await transitionLeadStage(
    {
      leadId: "lead-1",
      toStage: "LOST",
      lossReason: "NO_BUDGET",
      actor: { userId: "admin-1", role: "ADMIN" },
    },
    { store },
  );

  assert.equal(store.lead.nextFollowUpAt, null);
  assert.equal(store.events.at(-1)?.type, "LOST");
  assert.deepEqual(store.events.at(-1)?.metadata, {
    lossReason: "NO_BUDGET",
    cancelledFollowUpId: "follow-up-1",
  });
});

test("legacy CLOSED qualifies only the authenticated current owner", async () => {
  const store = fakeLifecycleStore(
    makeLead({
      ownerId: "seller-1",
      stage: "CONTACTING",
      status: "IN_PROGRESS",
      assignees: [{ id: "seller-1" }],
    }),
    { actorRoles: { "seller-1": "SELLER" } },
  );

  await qualifyLeadFromLegacyClosed(
    {
      leadId: "lead-1",
      actor: { userId: "seller-1", role: "SELLER" },
    },
    { store },
  );

  assert.equal(store.lead.stage, "QUALIFIED");
  assert.equal(store.lead.status, "IN_PROGRESS");
  assert.deepEqual(store.events.at(-1)?.metadata, {
    legacyRequestedClosed: true,
  });
});

test("admin can take ownership: NEW lead advances like a claim and keeps its eligible seller", async () => {
  const store = fakeLifecycleStore(
    makeLead({
      stage: "NEW",
      eligibleSellerId: "seller-1",
      intentLevel: "AD_RESPONSE",
      sourceKey: "meta_lead_ads",
    }),
    { actorRoles: { "admin-1": "ADMIN" } },
  );
  await releaseOrReassignLead(
    {
      action: "REASSIGN",
      leadId: "lead-1",
      sellerId: "admin-1",
      reason: "אני לוקח את הליד",
      actor: { userId: "admin-1", role: "ADMIN" },
    },
    { store },
  );
  assert.equal(store.lead.ownerId, "admin-1");
  // The seller queue fallback survives: eligibleSellerId is NOT overwritten
  // by an admin owner, so a later release returns the lead to the seller.
  assert.equal(store.lead.eligibleSellerId, "seller-1");
  // Taking a NEW warm lead advances the stage exactly like a seller claim.
  assert.equal(store.lead.stage, "CONTACTING");
  assert.equal(store.lead.firstClaimedAt instanceof Date, true);
  assert.equal(
    store.events.some((event) => event.type === "CLAIMED"),
    true,
  );
});

test("reassigning to a MEMBER is rejected", async () => {
  const store = fakeLifecycleStore(
    makeLead({ stage: "NEW" }),
    { actorRoles: { "admin-1": "ADMIN", "member-1": "MEMBER" } },
  );
  await assert.rejects(
    releaseOrReassignLead(
      {
        action: "REASSIGN",
        leadId: "lead-1",
        sellerId: "member-1",
        reason: "שיוך שגוי",
        actor: { userId: "admin-1", role: "ADMIN" },
      },
      { store },
    ),
    /invalid/i,
  );
});
