import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAgreementEvent,
  applyPaymentFailure,
  applyPaymentSuccess,
  cancelDuplicateAgreementForMigrationInTransaction,
  changeAgreementCredit,
  claimCommissionBriefTask,
  classifyLegacyOrphanCommissionInTransaction,
  createAgreementForLead,
  linkAgreementToLeadForMigrationInTransaction,
  linkHistoricalCommissionInTransaction,
  recordAgreementPaymentPage,
  setSellerCommissionPayoutStatus,
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
  clients: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
  commissions: Array<Record<string, unknown>>;
  followUps: Array<Record<string, unknown>>;
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
    phone: "0501234567",
    email: "noa@example.com",
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
  const clients: Array<Record<string, unknown>> = [];
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
    client: {
      async findUnique({ where }: { where: { id: string } }) {
        return clients.find((client) => client.id === where.id) ?? null;
      },
    },
    agreement: {
      async findFirst({ where }: { where: Record<string, unknown> }) {
        return (
          agreements.find(
            (agreement) =>
              agreement.leadId === where.leadId &&
              ["DRAFT", "SENT", "SIGNED"].includes(String(agreement.status)) &&
              (!where.id ||
                typeof where.id !== "object" ||
                agreement.id !== (where.id as { not?: string }).not),
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
          ? { ...agreement, lead: agreement.leadId ? lead : null }
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
      async updateMany({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) {
        const row = commissions.find(
          (item) =>
            item.id === where.id &&
            (where.sellerId === undefined || item.sellerId === where.sellerId) &&
            (where.briefTaskId === undefined ||
              item.briefTaskId === where.briefTaskId),
        );
        if (!row) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
    },
    leadFollowUp: {
      async findFirst({ where }: { where?: Record<string, unknown> } = {}) {
        return (
          followUps.find(
            (followUp) =>
              (!where?.leadId || followUp.leadId === where.leadId) &&
              (!where?.status || followUp.status === where.status) &&
              (!where?.id ||
                typeof where.id !== "object" ||
                followUp.id !== (where.id as { not?: string }).not),
          ) ?? null
        );
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
    clients,
    events,
    commissions,
    followUps,
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

test("reassignment transfers agreement operations without changing frozen seller credit", async () => {
  const store = fakeAgreementStore();
  const agreement = await createAgreementForLead(
    { leadId: "lead-1", actor: seller1, agreement: draft },
    { store },
  );
  store.lead.ownerId = "seller-2";
  store.lead.assignees = [{ id: "seller-2" }];

  await assert.rejects(
    applyAgreementEvent(
      {
        agreementId: agreement.id,
        type: "SENT",
        actor: seller1,
      },
      { store },
    ),
    /owned/i,
  );

  await applyAgreementEvent(
    {
      agreementId: agreement.id,
      type: "SENT",
      actor: seller2,
    },
    { store },
  );

  assert.equal(agreement.status, "SENT");
  assert.equal(agreement.creditedSellerId, "seller-1");
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

test("migration linking requires persisted admin, contact evidence and no active collision", async () => {
  const store = fakeAgreementStore();
  store.agreements.push({
    id: "agreement-unlinked",
    leadId: null,
    status: "DRAFT",
    paymentStatus: "PENDING",
    paidAt: null,
    paidAmount: null,
    phone: "050-123-4567",
    email: "other@example.com",
    clientId: null,
    creditedSellerId: "seller-1",
    createdBy: "seller-1",
    isSellerDeal: true,
    customerName: "נועה",
    monthlyPrice: 599,
  });

  await assert.rejects(
    store.transaction((transaction) =>
      linkAgreementToLeadForMigrationInTransaction(transaction, {
        agreementId: "agreement-unlinked",
        leadId: "lead-1",
        reason: "Historical contact match",
        actor: seller1,
      }),
    ),
    /admin/i,
  );

  await store.transaction((transaction) =>
    linkAgreementToLeadForMigrationInTransaction(transaction, {
      agreementId: "agreement-unlinked",
      leadId: "lead-1",
      reason: "Historical contact match",
      actor: admin,
    }),
  );
  assert.equal(store.agreements[0]?.leadId, "lead-1");
  assert.equal(store.events.at(-1)?.type, "MIGRATED");

  await store.transaction((transaction) =>
    linkAgreementToLeadForMigrationInTransaction(transaction, {
      agreementId: "agreement-unlinked",
      leadId: "lead-1",
      reason: "Historical contact match",
      actor: admin,
    }),
  );
  assert.equal(
    store.events.filter((event) => event.type === "MIGRATED").length,
    1,
  );

  const mismatch = fakeAgreementStore();
  mismatch.agreements.push({
    id: "agreement-mismatch",
    leadId: null,
    status: "DRAFT",
    paymentStatus: "PENDING",
    paidAt: null,
    phone: "0999999999",
    email: "wrong@example.com",
    clientId: null,
  });
  await assert.rejects(
    mismatch.transaction((transaction) =>
      linkAgreementToLeadForMigrationInTransaction(transaction, {
        agreementId: "agreement-mismatch",
        leadId: "lead-1",
        reason: "No actual matching evidence",
        actor: admin,
      }),
    ),
    /evidence|contact/i,
  );
});

test("migration linking rejects a clientId alone and accepts matching client contact evidence", async () => {
  const unrelated = fakeAgreementStore();
  unrelated.agreements.push({
    id: "agreement-unrelated-client",
    leadId: null,
    status: "DRAFT",
    paymentStatus: "PENDING",
    paidAt: null,
    phone: "0999999999",
    email: "wrong@example.com",
    clientId: "client-unrelated",
  });
  unrelated.clients.push({
    id: "client-unrelated",
    phone: "0529999999",
    email: "also-wrong@example.com",
  });

  await assert.rejects(
    unrelated.transaction((transaction) =>
      linkAgreementToLeadForMigrationInTransaction(transaction, {
        agreementId: "agreement-unrelated-client",
        leadId: "lead-1",
        reason: "Client record exists but identifies another customer",
        actor: admin,
      }),
    ),
    /evidence|contact|identity/i,
  );

  const compatible = fakeAgreementStore();
  compatible.agreements.push({
    id: "agreement-compatible-client",
    leadId: null,
    status: "DRAFT",
    paymentStatus: "PENDING",
    paidAt: null,
    phone: "0999999999",
    email: "legacy-wrong@example.com",
    clientId: "client-compatible",
  });
  compatible.clients.push({
    id: "client-compatible",
    phone: "050-123-4567",
    email: "client@example.com",
  });

  await compatible.transaction((transaction) =>
    linkAgreementToLeadForMigrationInTransaction(transaction, {
      agreementId: "agreement-compatible-client",
      leadId: "lead-1",
      reason: "Linked Client phone matches the Lead",
      actor: admin,
    }),
  );
  assert.equal(compatible.agreements[0]?.leadId, "lead-1");
});

test("migration duplicate cancellation preserves lead state and paid agreements", async () => {
  const store = fakeAgreementStore();
  store.agreements.push(
    {
      id: "agreement-duplicate",
      leadId: "lead-1",
      status: "SENT",
      paymentStatus: "PENDING",
      paidAt: null,
    },
    {
      id: "agreement-retained",
      leadId: "lead-1",
      status: "SIGNED",
      paymentStatus: "PENDING",
      paidAt: null,
    },
  );
  const stageBefore = store.lead.stage;
  await store.transaction((transaction) =>
    cancelDuplicateAgreementForMigrationInTransaction(transaction, {
      agreementId: "agreement-duplicate",
      retainedAgreementId: "agreement-retained",
      reason: "Duplicate draft created during the legacy cutover",
      actor: admin,
    }),
  );
  assert.equal(store.agreements[0]?.status, "CANCELLED");
  assert.equal(store.agreements[1]?.status, "SIGNED");
  assert.equal(store.lead.stage, stageBefore);
  assert.equal(store.events.at(-1)?.type, "MIGRATED");

  const paid = fakeAgreementStore();
  paid.agreements.push(
    {
      id: "agreement-paid",
      leadId: "lead-1",
      status: "SIGNED",
      paymentStatus: "COMPLETED",
      paidAt: new Date("2026-07-01T08:00:00.000Z"),
    },
    {
      id: "agreement-retained",
      leadId: "lead-1",
      status: "SIGNED",
      paymentStatus: "PENDING",
      paidAt: null,
    },
  );
  await assert.rejects(
    paid.transaction((transaction) =>
      cancelDuplicateAgreementForMigrationInTransaction(transaction, {
        agreementId: "agreement-paid",
        retainedAgreementId: "agreement-retained",
        reason: "Must not cancel paid history",
        actor: admin,
      }),
    ),
    /paid/i,
  );
});

test("unlinked duplicate cancellation requires shared contact or client identity", async () => {
  const unrelated = fakeAgreementStore();
  unrelated.agreements.push(
    {
      id: "agreement-unlinked-duplicate",
      leadId: null,
      status: "SENT",
      paymentStatus: "PENDING",
      paidAt: null,
      phone: "0501111111",
      email: "duplicate@example.com",
      clientId: "client-duplicate",
    },
    {
      id: "agreement-linked-retained",
      leadId: "lead-1",
      status: "SIGNED",
      paymentStatus: "PENDING",
      paidAt: null,
      phone: "0522222222",
      email: "retained@example.com",
      clientId: "client-retained",
    },
  );
  unrelated.clients.push(
    {
      id: "client-duplicate",
      phone: "0533333333",
      email: "duplicate-client@example.com",
    },
    {
      id: "client-retained",
      phone: "0544444444",
      email: "retained-client@example.com",
    },
  );

  await assert.rejects(
    unrelated.transaction((transaction) =>
      cancelDuplicateAgreementForMigrationInTransaction(transaction, {
        agreementId: "agreement-unlinked-duplicate",
        retainedAgreementId: "agreement-linked-retained",
        reason: "These records have no shared identity",
        actor: admin,
      }),
    ),
    /identity|contact|client|share/i,
  );
  assert.equal(unrelated.agreements[0]?.status, "SENT");

  const compatible = fakeAgreementStore();
  compatible.agreements.push(
    {
      id: "agreement-shared-client-duplicate",
      leadId: null,
      status: "SENT",
      paymentStatus: "PENDING",
      paidAt: null,
      phone: "0501111111",
      email: "old@example.com",
      clientId: "client-shared",
    },
    {
      id: "agreement-shared-client-retained",
      leadId: "lead-1",
      status: "SIGNED",
      paymentStatus: "PENDING",
      paidAt: null,
      phone: "0522222222",
      email: "new@example.com",
      clientId: "client-shared",
    },
  );

  await compatible.transaction((transaction) =>
    cancelDuplicateAgreementForMigrationInTransaction(transaction, {
      agreementId: "agreement-shared-client-duplicate",
      retainedAgreementId: "agreement-shared-client-retained",
      reason: "Both agreements belong to the same persisted Client",
      actor: admin,
    }),
  );
  assert.equal(compatible.agreements[0]?.status, "CANCELLED");
});

test("historical commission linking is audited, idempotent and rejects conflicting evidence", async () => {
  const store = fakeAgreementStore();
  store.agreements.push({
    id: "agreement-paid",
    leadId: "lead-1",
    status: "SIGNED",
    paymentStatus: "COMPLETED",
    paidAt: new Date("2026-07-01T08:00:00.000Z"),
    paidAmount: 599,
    monthlyPrice: 599,
    creditedSellerId: "seller-1",
    createdBy: "seller-1",
    isSellerDeal: true,
  });
  store.commissions.push({
    id: "commission-historical",
    sellerId: "seller-1",
    agreementId: "legacy-agreement-id",
    agreementRefId: null,
    agreementLinkStatus: null,
    agreementLinkReviewedAt: null,
    agreementLinkReviewReason: null,
    agreementLinkReviewedById: null,
    clientName: "נועה",
    amount: 599,
    status: "PENDING",
    paidAt: null,
    createdAt: new Date("2026-07-01T08:01:00.000Z"),
  });

  await store.transaction((transaction) =>
    linkHistoricalCommissionInTransaction(transaction, {
      commissionId: "commission-historical",
      agreementId: "agreement-paid",
      reason: "Payment and seller evidence match",
      actor: admin,
    }),
  );
  const linked = store.commissions[0]!;
  assert.equal(linked.agreementId, "legacy-agreement-id");
  assert.equal(linked.agreementRefId, "agreement-paid");
  assert.equal(linked.agreementLinkStatus, "LINKED");
  assert.equal(linked.agreementLinkReviewedById, "admin-1");
  assert.equal(store.events.at(-1)?.type, "MIGRATED");

  await store.transaction((transaction) =>
    linkHistoricalCommissionInTransaction(transaction, {
      commissionId: "commission-historical",
      agreementId: "agreement-paid",
      reason: "Payment and seller evidence match",
      actor: admin,
    }),
  );
  assert.equal(
    store.events.filter((event) => event.type === "MIGRATED").length,
    1,
  );

  store.agreements.push({
    id: "agreement-other-paid",
    leadId: "lead-1",
    status: "SIGNED",
    paymentStatus: "COMPLETED",
    paidAt: new Date("2026-07-02T08:00:00.000Z"),
    paidAmount: 599,
    monthlyPrice: 599,
    creditedSellerId: "seller-1",
  });
  await assert.rejects(
    store.transaction((transaction) =>
      linkHistoricalCommissionInTransaction(transaction, {
        commissionId: "commission-historical",
        agreementId: "agreement-other-paid",
        reason: "Conflicting second resolution",
        actor: admin,
      }),
    ),
    /conflict|classified|linked/i,
  );
});

test("genuine legacy orphan commission classification preserves financial history", async () => {
  const store = fakeAgreementStore();
  const createdAt = new Date("2026-06-01T08:00:00.000Z");
  const paidAt = new Date("2026-07-01T08:00:00.000Z");
  store.commissions.push({
    id: "commission-orphan",
    sellerId: "seller-1",
    agreementId: "deleted-agreement",
    agreementRefId: null,
    agreementLinkStatus: null,
    agreementLinkReviewedAt: null,
    agreementLinkReviewReason: null,
    agreementLinkReviewedById: null,
    clientName: "נועה",
    amount: 599,
    status: "PAID",
    paidAt,
    createdAt,
  });
  const immutableBefore = {
    sellerId: store.commissions[0]?.sellerId,
    agreementId: store.commissions[0]?.agreementId,
    amount: store.commissions[0]?.amount,
    status: store.commissions[0]?.status,
    paidAt: store.commissions[0]?.paidAt,
    createdAt: store.commissions[0]?.createdAt,
  };

  await assert.rejects(
    store.transaction((transaction) =>
      classifyLegacyOrphanCommissionInTransaction(transaction, {
        commissionId: "commission-orphan",
        reason: "Deleted agreement confirmed in archived records",
        actor: seller1,
      }),
    ),
    /admin/i,
  );
  await assert.rejects(
    store.transaction((transaction) =>
      classifyLegacyOrphanCommissionInTransaction(transaction, {
        commissionId: "commission-orphan",
        reason: " ",
        actor: admin,
      }),
    ),
    /reason/i,
  );

  await store.transaction((transaction) =>
    classifyLegacyOrphanCommissionInTransaction(transaction, {
      commissionId: "commission-orphan",
      reason: "Deleted agreement confirmed in archived records",
      actor: admin,
    }),
  );
  assert.equal(store.commissions[0]?.agreementRefId, null);
  assert.equal(store.commissions[0]?.agreementLinkStatus, "LEGACY_ORPHAN");
  assert.deepEqual(
    {
      sellerId: store.commissions[0]?.sellerId,
      agreementId: store.commissions[0]?.agreementId,
      amount: store.commissions[0]?.amount,
      status: store.commissions[0]?.status,
      paidAt: store.commissions[0]?.paidAt,
      createdAt: store.commissions[0]?.createdAt,
    },
    immutableBefore,
  );

  await store.transaction((transaction) =>
    classifyLegacyOrphanCommissionInTransaction(transaction, {
      commissionId: "commission-orphan",
      reason: "Deleted agreement confirmed in archived records",
      actor: admin,
    }),
  );

  const existingAgreement = fakeAgreementStore();
  existingAgreement.agreements.push({
    id: "existing-agreement",
    leadId: null,
    status: "CANCELLED",
  });
  existingAgreement.commissions.push({
    id: "commission-not-orphan",
    sellerId: "seller-1",
    agreementId: "existing-agreement",
    agreementRefId: null,
    agreementLinkStatus: null,
    amount: 599,
  });
  await assert.rejects(
    existingAgreement.transaction((transaction) =>
      classifyLegacyOrphanCommissionInTransaction(transaction, {
        commissionId: "commission-not-orphan",
        reason: "Incorrect orphan attempt",
        actor: admin,
      }),
    ),
    /exists|orphan/i,
  );
});

test("commission brief task can be claimed once only by its seller", async () => {
  const store = fakeAgreementStore();
  store.commissions.push({
    id: "commission-brief",
    agreementId: "agreement-1",
    sellerId: "seller-1",
    briefTaskId: null,
  });
  const claimed = await claimCommissionBriefTask(
    {
      commissionId: "commission-brief",
      taskId: "task-1",
      actor: seller1,
    },
    { store },
  );
  assert.equal(claimed.briefTaskId, "task-1");

  const retry = await claimCommissionBriefTask(
    {
      commissionId: "commission-brief",
      taskId: "task-1",
      actor: seller1,
    },
    { store },
  );
  assert.equal(retry.briefTaskId, "task-1");

  await assert.rejects(
    claimCommissionBriefTask(
      {
        commissionId: "commission-brief",
        taskId: "task-2",
        actor: seller2,
      },
      { store },
    ),
    /seller|owned|commission/i,
  );
});

test("only a persisted admin can record commission payout status", async () => {
  const store = fakeAgreementStore();
  store.commissions.push({
    id: "commission-payout",
    agreementId: "agreement-1",
    sellerId: "seller-1",
    status: "PENDING",
    paidAt: null,
  });
  await assert.rejects(
    setSellerCommissionPayoutStatus(
      {
        commissionId: "commission-payout",
        status: "PAID",
        actor: seller1,
      },
      { store },
    ),
    /admin/i,
  );
  const paid = await setSellerCommissionPayoutStatus(
    {
      commissionId: "commission-payout",
      status: "PAID",
      actor: admin,
    },
    { store },
  );
  assert.equal(paid.status, "PAID");
  assert.ok(paid.paidAt instanceof Date);
});

test("payment page persistence is centralized and does not overwrite completed payment", async () => {
  const store = fakeAgreementStore();
  const agreement = await createAgreementForLead(
    { leadId: "lead-1", actor: seller1, agreement: draft },
    { store },
  );
  const updated = await recordAgreementPaymentPage(
    {
      agreementId: agreement.id,
      paymentUrl: "https://pay.example/checkout",
      providerPaymentId: "low-profile-1",
    },
    { store },
  );
  assert.equal(updated.paymentStatus, "SENT");
  assert.equal(updated.paymentUrl, "https://pay.example/checkout");
  assert.equal(updated.paymentId, "low-profile-1");

  agreement.paymentStatus = "COMPLETED";
  await assert.rejects(
    recordAgreementPaymentPage(
      {
        agreementId: agreement.id,
        paymentUrl: "https://pay.example/replacement",
        providerPaymentId: "low-profile-2",
      },
      { store },
    ),
    /paid|completed/i,
  );
});
