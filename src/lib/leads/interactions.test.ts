import assert from "node:assert/strict";
import test from "node:test";

import {
  planInteraction,
  recordInteraction,
  recordLegacyColdInteraction,
  type InteractionStore,
} from "./interactions";
import {
  hashSuppressionValue,
  normalizeDomain,
  normalizePhone,
} from "../prospecting/suppression";

const baseInput = {
  leadId: "lead-1",
  actor: { userId: "seller-1", role: "SELLER" as const },
  channel: "PHONE" as const,
  decisionMakerReached: false,
  usedCallAngleIds: [] as string[],
};

test("structured outcome matrix preserves or advances the canonical stage", () => {
  const cases = [
    { outcome: "NO_ANSWER", from: "CONTACTING", to: "CONTACTING" },
    { outcome: "CALLBACK", from: "QUALIFIED", to: "QUALIFIED" },
    {
      outcome: "NON_DECISION_MAKER",
      from: "AGREEMENT_SENT",
      to: "AGREEMENT_SENT",
    },
    { outcome: "INTERESTED", from: "CONTACTING", to: "QUALIFIED" },
    {
      outcome: "NOT_INTERESTED",
      from: "CONTACTING",
      to: "LOST",
      loss: "NO_INTEREST",
    },
    {
      outcome: "WRONG_NUMBER",
      from: "CONTACTING",
      to: "LOST",
      loss: "BAD_CONTACT",
    },
    {
      outcome: "DO_NOT_CALL",
      from: "CONTACTING",
      to: "LOST",
      loss: "DO_NOT_CONTACT",
    },
  ] as const;

  for (const item of cases) {
    const plan = planInteraction(item.from, {
      ...baseInput,
      outcome: item.outcome,
      decisionMakerReached:
        item.outcome === "INTERESTED" || item.outcome === "NOT_INTERESTED",
      followUpAction:
        item.outcome === "NO_ANSWER" ||
        item.outcome === "CALLBACK" ||
        item.outcome === "NON_DECISION_MAKER"
          ? "SCHEDULE"
          : undefined,
      followUpAt:
        item.outcome === "NO_ANSWER" ||
        item.outcome === "CALLBACK" ||
        item.outcome === "NON_DECISION_MAKER"
          ? new Date(Date.now() + 60_000)
          : undefined,
      lossReason:
        "loss" in item
          ? item.loss
          : undefined,
    });
    assert.equal(plan.toStage, item.to);
    if ("loss" in item) assert.equal(plan.lossReason, item.loss);
  }
});

test("first recorded contact exits PREPARING before applying the outcome", () => {
  assert.equal(
    planInteraction("PREPARING", {
      ...baseInput,
      outcome: "NO_ANSWER",
      followUpAction: "SCHEDULE",
      followUpAt: new Date(Date.now() + 60_000),
    }).toStage,
    "CONTACTING",
  );
  assert.equal(
    planInteraction("PREPARING", {
      ...baseInput,
      outcome: "INTERESTED",
      decisionMakerReached: true,
    }).toStage,
    "QUALIFIED",
  );
});

test("outcome rules never invent a follow-up and enforce decision-maker truth", () => {
  assert.throws(
    () =>
      planInteraction("CONTACTING", {
        ...baseInput,
        outcome: "NO_ANSWER",
      }),
    /next action|follow-up/i,
  );
  assert.throws(
    () =>
      planInteraction("CONTACTING", {
        ...baseInput,
        outcome: "CALLBACK",
        followUpAction: "SCHEDULE",
      }),
    /future|follow-up/i,
  );
  assert.throws(
    () =>
      planInteraction("CONTACTING", {
        ...baseInput,
        outcome: "INTERESTED",
        decisionMakerReached: false,
      }),
    /decision maker/i,
  );
  assert.throws(
    () =>
      planInteraction("CONTACTING", {
        ...baseInput,
        outcome: "NOT_INTERESTED",
        decisionMakerReached: true,
        followUpAction: "SCHEDULE",
        followUpAt: new Date(Date.now() + 60_000),
        lossReason: "NO_INTEREST",
      }),
    /follow-up|schedule/i,
  );
});

function fakeInteractionStore(options: {
  ownerId?: string | null;
  actorRole?: "ADMIN" | "SELLER";
  review?: boolean;
  doNotContactAt?: Date | null;
  stage?: "NEW" | "PREPARING" | "CONTACTING";
  prospectLeadId?: string | null;
  suppressions?: Array<Record<string, unknown>>;
} = {}): InteractionStore & {
  interactions: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
  lead: Record<string, unknown>;
  suppressions: Array<Record<string, unknown>>;
} {
  const interactions: Array<Record<string, unknown>> = [];
  const events: Array<Record<string, unknown>> = [];
  const followUps: Array<Record<string, unknown>> = [];
  const suppressions = options.suppressions ?? [];
  const lead: Record<string, unknown> = {
    id: "lead-1",
    ownerId: options.ownerId === undefined ? "seller-1" : options.ownerId,
    eligibleSellerId: "seller-1",
    migrationReviewRequired: options.review ?? false,
    doNotContactAt: options.doNotContactAt ?? null,
    intentLevel: "OUTBOUND",
    sourceKey: "google_maps",
    sourceSnapshot: {
      callAngles: [{ id: "1:1", text: "SEO", version: 1 }],
    },
    stage: options.stage ?? "CONTACTING",
    status: options.stage === "NEW" ? "NEW" : "IN_PROGRESS",
    firstContactedAt: null,
    lastContactedAt: null,
    decisionMakerReachedAt: null,
    qualifiedAt: null,
    lostAt: null,
    lossReason: null,
    lossReasonDetails: null,
    nextFollowUpAt: null,
    source: "GOOGLE_PROSPECTING",
    acquisitionChannel: "GOOGLE_PROSPECTING",
    externalLeadId: "gplaces:place-1",
    externalFormId: null,
    externalFormName: null,
    externalCampaignId: null,
    externalAdId: null,
    closedAt: null,
    assignees: [{ id: "seller-1" }],
    prospect: {
      id: "prospect-1",
      placeId: "place-1",
      auditedDomain: "https://example.com",
    },
  };
  const transaction = {
    user: {
      async findUnique() {
        return { role: options.actorRole ?? "SELLER" };
      },
    },
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
    leadInteraction: {
      async create({ data }: { data: Record<string, unknown> }) {
        const interaction = {
          id: `interaction-${interactions.length + 1}`,
          ...data,
        };
        interactions.push(interaction);
        return interaction;
      },
    },
    leadFollowUp: {
      async findFirst() {
        return followUps.find((item) => item.status === "SCHEDULED") ?? null;
      },
      async create({ data }: { data: Record<string, unknown> }) {
        const followUp = { id: "follow-up-1", status: "SCHEDULED", ...data };
        followUps.push(followUp);
        return followUp;
      },
      async updateMany({ data }: { data: Record<string, unknown> }) {
        for (const followUp of followUps) Object.assign(followUp, data);
        return { count: followUps.length };
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
    notification: {
      async updateMany() {
        return { count: 0 };
      },
    },
    prospect: {
      async findUnique() {
        return options.prospectLeadId === undefined
          ? null
          : { promotedLeadId: options.prospectLeadId };
      },
    },
    prospectSuppression: {
      async findFirst({ where }: { where: { OR: Array<Record<string, unknown>> } }) {
        return (
          suppressions.find((suppression) =>
            where.OR.some((filter) =>
              Object.entries(filter).every(
                ([key, value]) => suppression[key] === value,
              ),
            ),
          ) ?? null
        );
      },
      async findMany({ where }: { where: { OR: Array<Record<string, unknown>> } }) {
        return suppressions.filter((suppression) =>
          where.OR.some((filter) =>
            Object.entries(filter).every(
              ([key, value]) => suppression[key] === value,
            ),
          ),
        );
      },
      async create({ data }: { data: Record<string, unknown> }) {
        const suppression = {
          id: `suppression-${suppressions.length + 1}`,
          placeId: null,
          phoneHash: null,
          domainHash: null,
          ...data,
        };
        suppressions.push(suppression);
        return suppression;
      },
      async update({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) {
        const suppression = suppressions.find((item) => item.id === where.id);
        if (!suppression) throw new Error("suppression not found");
        Object.assign(suppression, data);
        return suppression;
      },
    },
  };
  return {
    interactions,
    events,
    lead,
    suppressions,
    async transaction(callback) {
      return callback(transaction as never);
    },
  };
}

test("interaction authorship comes only from the authenticated actor", async () => {
  const seller = fakeInteractionStore();
  const spoofedInput = {
    ...baseInput,
    outcome: "INTERESTED" as const,
    decisionMakerReached: true,
    usedCallAngleIds: ["1:1"],
    authorId: "spoof",
  };
  await recordInteraction(
    spoofedInput,
    { store: seller },
  );
  assert.equal(seller.interactions[0].authorId, "seller-1");
  assert.equal(seller.lead.stage, "QUALIFIED");
  assert.ok(seller.lead.decisionMakerReachedAt instanceof Date);

  const admin = fakeInteractionStore({ actorRole: "ADMIN", ownerId: "seller-1" });
  await recordInteraction(
    {
      ...baseInput,
      actor: { userId: "admin-1", role: "ADMIN" },
      outcome: "NO_ANSWER",
      followUpAction: "END_AS_LOST",
      lossReason: "BAD_TIMING",
    },
    { store: admin },
  );
  assert.equal(admin.interactions[0].authorId, "admin-1");
});

test("non-owner, review-required and do-not-contact leads reject interactions", async () => {
  for (const store of [
    fakeInteractionStore({ ownerId: "seller-2" }),
    fakeInteractionStore({ review: true }),
    fakeInteractionStore({ doNotContactAt: new Date() }),
  ]) {
    await assert.rejects(
      recordInteraction(
        {
          ...baseInput,
          outcome: "NO_ANSWER",
          followUpAction: "END_AS_LOST",
          lossReason: "BAD_TIMING",
        },
        { store },
      ),
      /owned|review|contact/i,
    );
    assert.equal(store.interactions.length, 0);
  }
});

test("legacy cold interaction auto-claims the canonical lead and never writes legacy interactions", async () => {
  const store = fakeInteractionStore({
    ownerId: null,
    stage: "NEW",
    prospectLeadId: "lead-1",
  });

  await recordLegacyColdInteraction(
    {
      prospectId: "prospect-1",
      actor: { userId: "seller-1", role: "SELLER" },
      interaction: {
        channel: "PHONE",
        outcome: "INTERESTED",
        decisionMakerReached: true,
        usedCallAngleIds: ["1:1"],
      },
    },
    { store },
  );

  assert.equal(store.lead.ownerId, "seller-1");
  assert.equal(store.interactions.length, 1);
  assert.equal(
    store.events.filter((event) => event.type === "CLAIMED").length,
    1,
  );
  assert.equal(store.lead.stage, "QUALIFIED");
});

test("do-not-call enriches an existing phone suppression with permanent place and domain keys", async () => {
  const secret = "suppression-secret";
  const phone = "050-123-4567";
  const phoneHash = hashSuppressionValue(normalizePhone(phone), secret);
  const store = fakeInteractionStore({
    suppressions: [
      {
        id: "suppression-existing",
        placeId: null,
        phoneHash,
        domainHash: null,
        reason: "WRONG_NUMBER",
      },
    ],
  });

  await recordInteraction(
    {
      ...baseInput,
      outcome: "DO_NOT_CALL",
      note: "ביקש שלא ניצור קשר",
    },
    { store, livePhone: phone, hashSecret: secret },
  );

  assert.equal(store.suppressions.length, 1);
  assert.equal(store.suppressions[0]?.placeId, "place-1");
  assert.equal(store.suppressions[0]?.phoneHash, phoneHash);
  assert.equal(
    store.suppressions[0]?.domainHash,
    hashSuppressionValue(normalizeDomain("https://example.com"), secret),
  );
});
