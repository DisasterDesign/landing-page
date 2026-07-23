import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAgreementEvent,
  applyPaymentFailure,
  applyPaymentSuccess,
  changeAgreementCredit,
  createAgreementForLead,
  type AgreementLifecycleStore,
} from "./agreement-lifecycle";

const seller1 = { userId: "seller-1", role: "SELLER" as const };
const seller2 = { userId: "seller-2", role: "SELLER" as const };
const admin = { userId: "admin-1", role: "ADMIN" as const };
const integration = { type: "INTEGRATION" as const };

const draft = {
  tier: "ADVANCED" as const,
  additionalServices: ["SEO"],
  monthlyPrice: 599,
  oneTimeFee: null,
  customerName: "נועה",
  businessName: "סטודיו נועה",
  idNumber: null,
  phone: "0501234567",
  email: "noa@example.com",
  content: "<p>agreement</p>",
  locale: "he" as const,
  vatExempt: false,
  documentVersion: 1,
};

function fakeAgreementStore(options: {
  ownerId?: string | null;
  stage?: string | null;
  review?: boolean;
  activeAgreement?: boolean;
} = {}): AgreementLifecycleStore & {
  lead: Record<string, unknown>;
  agreements: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
  commissions: Array<Record<string, unknown>>;
} {
  const lead: Record<string, unknown> = {
    id: "lead-1",
    name: "נועה",
    company: "סטודיו נועה",
    ownerId: options.ownerId === undefined ? "seller-1" : options.ownerId,
    eligibleSellerId: "seller-1",
    migrationReviewRequired: options.review ?? false,
    intentLevel: "AD_RESPONSE",
    sourceKey: "meta_lead_ads",
    stage: options.stage === undefined ? "QUALIFIED" : options.stage,
    status: "IN_PROGRESS",
    source: "FACEBOOK",
    acquisitionChannel: "META",
    externalLeadId: "meta-1",
    externalFormId: null,
    externalFormName: null,
    externalCampaignId: null,
    externalAdId: null,
    nextFollowUpAt: null,
    lastContactedAt: new Date("2026-07-23T08:00:00.000Z"),
    closedAt: null,
    qualifiedAt: new Date("2026-07-23T08:00:00.000Z"),
    wonAt: null,
    lostAt: null,
    lossReason: null,
    lossReasonDetails: null,
    assignees:
      options.ownerId === null ? [] : [{ id: options.ownerId ?? "seller-1" }],
  };
  const agreements: Array<Record<string, unknown>> = options.activeAgreement
    ? [
        {
          id: "agreement-existing",
          leadId: "lead-1",
          status: "SENT",
          paymentStatus: "PENDING",
          paidAt: null,
          creditedSellerId: "seller-1",
          createdBy: "seller-1",
          isSellerDeal: true,
          customerName: "נועה",
          monthlyPrice: 599,
        },
      ]
    : [];
  const events: Array<Record<string, unknown>> = [];
  const commissions: Array<Record<string, unknown>> = [];
  const followUps: Array<Record<string, unknown>> = [];
  const roles: Record<string, "ADMIN" | "SELLER"> = {
    "seller-1": "SELLER",
    "seller-2": "SELLER",
    "admin-1": "ADMIN",
  };
  const tx = {
    user: {
      async findUnique({ where }: { where: { id: string } }) {
        return roles[where.id] ? { id: where.id, role: roles[where.id] } : null;
      },
      async findMany() {
        return [{ id: "admin-1" }];
      },
    },
    contactSubmission: {
      async findUnique() {
        return lead;
      },
      async update({ data }: { data: Record<string, unknown> }) {
        Object.assign(lead, data);
        return lead;
      },
    },
    agreement: {
      async findFirst({ where }: { where: Record<string, unknown> }) {
        return (
          agreements.find(
            (agreement) =>
              agreement.leadId === where.leadId &&
              ["DRAFT", "SENT", "SIGNED"].includes(String(agreement.status)),
          ) ?? null
        );
      },
      async findUnique({
        where,
        include,
      }: {
        where: Record<string, string>;
        include?: Record<string, unknown>;
      }) {
        const key = Object.keys(where)[0]!;
        const agreement =
          agreements.find((item) => item[key] === where[key]) ?? null;
        return agreement && include?.lead
          ? { ...agreement, lead }
          : agreement;
      },
      async create({ data }: { data: Record<string, unknown> }) {
        if (
          agreements.some(
            (agreement) =>
              agreement.leadId === data.leadId &&
              ["DRAFT", "SENT", "SIGNED"].includes(String(agreement.status)),
          )
        ) {
          throw Object.assign(new Error("unique"), { code: "P2002" });
        }
        const agreement = {
          id: `agreement-${agreements.length + 1}`,
          signToken: `token-${agreements.length + 1}`,
          status: "DRAFT",
          paymentStatus: "PENDING",
          paidAt: null,
          paidAmount: null,
          ...data,
        };
        agreements.push(agreement);
        return agreement;
      },
      async update({
        where,
        data,
      }: {
        where: Record<string, string>;
        data: Record<string, unknown>;
      }) {
        const key = Object.keys(where)[0]!;
        const agreement = agreements.find(
          (item) => item[key] === where[key],
        );
        if (!agreement) throw new Error("not found");
        Object.assign(agreement, data);
        return agreement;
      },
      async updateMany({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) {
        const agreement = agreements.find((item) => item.id === where.id);
        if (!agreement) return { count: 0 };
        if (
          where.paymentStatus &&
          typeof where.paymentStatus === "object" &&
          agreement.paymentStatus ===
            (where.paymentStatus as { not?: string }).not
        ) {
          return { count: 0 };
        }
        Object.assign(agreement, data);
        return { count: 1 };
      },
    },
    sellerCommission: {
      async findUnique({ where }: { where: Record<string, string> }) {
        const key = Object.keys(where)[0]!;
        return (
          commissions.find((commission) => commission[key] === where[key]) ??
          null
        );
      },
      async create({ data }: { data: Record<string, unknown> }) {
        const row = {
          id: `commission-${commissions.length + 1}`,
          status: "PENDING",
          createdAt: new Date(),
          ...data,
        };
        commissions.push(row);
        return row;
      },
      async update({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) {
        const row = commissions.find((item) => item.id === where.id)!;
        Object.assign(row, data);
        return row;
      },
    },
    leadFollowUp: {
      async findFirst() {
        return followUps[0] ?? null;
      },
      async updateMany({ data }: { data: Record<string, unknown> }) {
        for (const followUp of followUps) Object.assign(followUp, data);
        return { count: followUps.length };
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
  };
  return {
    lead,
    agreements,
    events,
    commissions,
    async transaction(callback) {
      return callback(tx as never);
    },
  };
}

test("agreement creation requires a qualified owned lead and freezes seller credit", async () => {
  const nonOwner = fakeAgreementStore();
  await assert.rejects(
    createAgreementForLead(
      { leadId: "lead-1", actor: seller2, agreement: draft },
      { store: nonOwner },
    ),
    /owned/i,
  );

  const unowned = fakeAgreementStore({ ownerId: null });
  await assert.rejects(
    createAgreementForLead(
      { leadId: "lead-1", actor: admin, agreement: draft },
      { store: unowned },
    ),
    /owner|assigned/i,
  );

  const store = fakeAgreementStore();
  const created = await createAgreementForLead(
    { leadId: "lead-1", actor: seller1, agreement: draft },
    { store },
  );
  assert.equal(created.creditedSellerId, "seller-1");
  assert.equal(store.lead.stage, "AGREEMENT_DRAFT");
  assert.equal(store.events.at(-1)?.dedupeKey, "lead:lead-1:agreement-created:agreement-1");

  await assert.rejects(
    createAgreementForLead(
      { leadId: "lead-1", actor: seller1, agreement: draft },
      { store },
    ),
    /active agreement|qualified/i,
  );

  const reviewStore = fakeAgreementStore({ review: true });
  await assert.rejects(
    createAgreementForLead(
      { leadId: "lead-1", actor: admin, agreement: draft },
      { store: reviewStore },
    ),
    /review/i,
  );
});

test("sent and signed agreement events are idempotent and repair a missing sent step", async () => {
  const store = fakeAgreementStore();
  const created = await createAgreementForLead(
    { leadId: "lead-1", actor: seller1, agreement: draft },
    { store },
  );
  await applyAgreementEvent(
    {
      agreementId: created.id,
      type: "SIGNED",
      actor: integration,
    },
    { store },
  );
  await applyAgreementEvent(
    {
      agreementId: created.id,
      type: "SIGNED",
      actor: integration,
    },
    { store },
  );
  assert.equal(store.lead.stage, "AGREEMENT_SIGNED");
  assert.equal(
    store.events.filter((event) => event.type === "AGREEMENT_SENT").length,
    1,
  );
  assert.equal(
    store.events.filter((event) => event.type === "AGREEMENT_SIGNED").length,
    1,
  );

  const legacyStore = fakeAgreementStore();
  const legacyAgreement = await createAgreementForLead(
    { leadId: "lead-1", actor: seller1, agreement: draft },
    { store: legacyStore },
  );
  legacyAgreement.status = "SIGNED";
  legacyStore.lead.stage = "AGREEMENT_DRAFT";
  await applyAgreementEvent(
    {
      agreementId: legacyAgreement.id,
      type: "SIGNED",
      actor: integration,
    },
    { store: legacyStore },
  );
  assert.equal(
    legacyStore.events.filter((event) => event.type === "AGREEMENT_SENT").length,
    1,
  );
  assert.equal(legacyStore.lead.stage, "AGREEMENT_SIGNED");
});

test("payment retry records one payment, won event and frozen commission", async () => {
  const store = fakeAgreementStore();
  const agreement = await createAgreementForLead(
    { leadId: "lead-1", actor: seller1, agreement: draft },
    { store },
  );
  await applyAgreementEvent(
    { agreementId: agreement.id, type: "SIGNED", actor: integration },
    { store },
  );
  const input = {
    agreementId: agreement.id,
    providerTransactionId: "deal-1",
    paidAt: new Date("2026-07-23T10:00:00.000Z"),
    paidAmount: 599,
    actor: integration,
  };
  await store.transaction((transaction) =>
    applyPaymentSuccess(transaction, input),
  );
  await store.transaction((transaction) =>
    applyPaymentSuccess(transaction, input),
  );
  assert.equal(store.lead.stage, "WON");
  assert.equal(
    store.events.filter((event) => event.type === "PAYMENT_SUCCEEDED").length,
    1,
  );
  assert.equal(
    store.events.filter((event) => event.type === "WON").length,
    1,
  );
  assert.equal(store.commissions.length, 1);
  assert.equal(store.commissions[0]?.sellerId, "seller-1");
});

test("payment keeps frozen credit after reassignment and flags a lost-lead mismatch", async () => {
  const store = fakeAgreementStore();
  const agreement = await createAgreementForLead(
    { leadId: "lead-1", actor: seller1, agreement: draft },
    { store },
  );
  store.lead.ownerId = "seller-2";
  store.lead.assignees = [{ id: "seller-2" }];
  store.lead.stage = "LOST";

  const result = await store.transaction((transaction) =>
    applyPaymentSuccess(transaction, {
      agreementId: agreement.id,
      providerTransactionId: "deal-after-loss",
      paidAt: new Date("2026-07-23T10:00:00.000Z"),
      paidAmount: 599,
      actor: integration,
    }),
  );

  assert.equal(store.lead.stage, "WON");
  assert.equal(store.commissions[0]?.sellerId, "seller-1");
  assert.ok(
    result.effects.some(
      (effect) => effect.input.type === "PAYMENT_MISMATCH",
    ),
  );
});

test("verified signature preserves review truth while payment derives won", async () => {
  const store = fakeAgreementStore({
    review: true,
    stage: null,
    activeAgreement: true,
  });
  await applyAgreementEvent(
    {
      agreementId: "agreement-existing",
      type: "SIGNED",
      actor: integration,
    },
    { store },
  );
  assert.equal(store.lead.stage, null);
  assert.equal(store.lead.migrationReviewRequired, true);
  assert.equal(
    store.events.find((event) => event.type === "AGREEMENT_SIGNED")?.toStage,
    null,
  );

  await store.transaction((transaction) =>
    applyPaymentSuccess(transaction, {
      agreementId: "agreement-existing",
      providerTransactionId: "review-deal",
      paidAt: new Date("2026-07-23T10:00:00.000Z"),
      paidAmount: 599,
      actor: integration,
    }),
  );
  assert.equal(store.lead.stage, "WON");
  assert.equal(store.lead.migrationReviewRequired, true);
  assert.equal(store.lead.sourceKey, "meta_lead_ads");
});

test("failed first payment records recovery truth without changing stage", async () => {
  const store = fakeAgreementStore();
  const agreement = await createAgreementForLead(
    { leadId: "lead-1", actor: seller1, agreement: draft },
    { store },
  );
  const result = await store.transaction((transaction) =>
    applyPaymentFailure(transaction, {
      agreementId: agreement.id,
      providerAttemptId: "attempt-1",
      occurredAt: new Date("2026-07-23T10:00:00.000Z"),
      actor: integration,
    }),
  );
  assert.equal(store.lead.stage, "AGREEMENT_DRAFT");
  assert.equal(
    store.events.filter((event) => event.type === "PAYMENT_FAILED").length,
    1,
  );
  assert.equal(result.effects[0]?.input.recipientId, "seller-1");

  const retry = await store.transaction((transaction) =>
    applyPaymentFailure(transaction, {
      agreementId: agreement.id,
      providerAttemptId: "attempt-1",
      occurredAt: new Date("2026-07-23T10:01:00.000Z"),
      actor: integration,
    }),
  );
  assert.equal(
    store.events.filter((event) => event.type === "PAYMENT_FAILED").length,
    1,
  );
  assert.equal(
    retry.effects[0]?.input.dedupeKey,
    "seller-1:payment-failed:agreement-1:attempt-1",
  );
});

test("cancellation is reasoned, idempotent and returns an unpaid lead to qualified", async () => {
  const store = fakeAgreementStore();
  const agreement = await createAgreementForLead(
    { leadId: "lead-1", actor: seller1, agreement: draft },
    { store },
  );
  await assert.rejects(
    applyAgreementEvent(
      {
        agreementId: agreement.id,
        type: "CANCELLED",
        actor: seller1,
      },
      { store },
    ),
    /reason/i,
  );
  const cancellation = {
    agreementId: agreement.id,
    type: "CANCELLED" as const,
    reason: "Customer postponed the project",
    actor: seller1,
  };
  await applyAgreementEvent(cancellation, { store });
  await applyAgreementEvent(cancellation, { store });
  assert.equal(store.lead.stage, "QUALIFIED");
  assert.equal(
    store.events.filter((event) => event.type === "AGREEMENT_CANCELLED").length,
    1,
  );
});

test("only an admin can change frozen commission credit with a reason", async () => {
  const store = fakeAgreementStore();
  const agreement = await createAgreementForLead(
    { leadId: "lead-1", actor: seller1, agreement: draft },
    { store },
  );
  await assert.rejects(
    changeAgreementCredit(
      {
        agreementId: agreement.id,
        creditedSellerId: "seller-2",
        reason: "Correction",
        actor: seller1,
      },
      { store },
    ),
    /admin/i,
  );
  await changeAgreementCredit(
    {
      agreementId: agreement.id,
      creditedSellerId: "seller-2",
      reason: "Original assignment was wrong",
      actor: admin,
    },
    { store },
  );
  assert.equal(store.agreements[0]?.creditedSellerId, "seller-2");
  assert.equal(store.events.at(-1)?.type, "COMMISSION_CREDIT_CHANGED");

  store.commissions.push({
    id: "commission-existing",
    agreementId: agreement.id,
    sellerId: "seller-2",
  });
  await changeAgreementCredit(
    {
      agreementId: agreement.id,
      creditedSellerId: "seller-1",
      reason: "Commission audit correction",
      actor: admin,
    },
    { store },
  );
  assert.equal(store.commissions[0]?.sellerId, "seller-1");
});
