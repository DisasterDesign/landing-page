import {
  type Agreement,
  type LeadStage,
  Prisma,
} from "@prisma/client";

import {
  createNotification,
  type CreateNotificationInput,
} from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

import { leadActionUrlFor, sellerLeadActionUrl } from "./action-url";
import {
  assertActorCanMutateLead,
  assertCommercialLeadReady,
} from "./authorization";
import { LeadDomainError } from "./errors";
import { appendLeadEvent, appendLeadEventOnce } from "./events";
import { cancelActiveFollowUps } from "./follow-ups";
import {
  legacyHashForLead,
  type LeadPostCommitEffect,
} from "./lifecycle";
import { legacyStatusForStage } from "./stage-machine";
import type {
  ApplyAgreementEventInput,
  AuthenticatedLeadActor,
  ChangeAgreementCreditInput,
  CreateAgreementForLeadInput,
  LeadActor,
  PaymentFailureInput,
  PaymentSuccessInput,
  ValidatedAgreementDraft,
} from "./types";

export interface AgreementLifecycleStore {
  transaction<T>(
    callback: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T>;
}

const prismaAgreementLifecycleStore: AgreementLifecycleStore = {
  transaction: (callback) =>
    prisma.$transaction(callback, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }),
};

export interface AgreementLeadResult {
  agreementId: string;
  leadId: string | null;
  stage: LeadStage | null;
  effects: LeadPostCommitEffect[];
}

export interface PaymentLeadResult extends AgreementLeadResult {
  commissionCreated: boolean;
  paymentRecorded: boolean;
}

function userActor(actor: AuthenticatedLeadActor): LeadActor {
  return { type: "USER", userId: actor.userId, role: actor.role };
}

function isAuthenticatedActor(
  actor: AuthenticatedLeadActor | LeadActor,
): actor is AuthenticatedLeadActor {
  return !("type" in actor);
}

function isUniqueViolation(error: unknown): boolean {
  return (
    (error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002") ||
    (typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: string }).code === "P2002")
  );
}

async function persistLeadAgreementStage(
  transaction: Prisma.TransactionClient,
  input: {
    lead: Prisma.ContactSubmissionGetPayload<{
      include: { assignees: { select: { id: true } } };
    }>;
    toStage: LeadStage;
    occurredAt: Date;
  },
) {
  const status = legacyStatusForStage(input.toStage);
  return transaction.contactSubmission.update({
    where: { id: input.lead.id },
    data: {
      stage: input.toStage,
      status,
      legacyStateHash: legacyHashForLead(
        input.lead,
        input.lead.assignees.map(({ id }) => id),
        { status },
      ),
    },
  });
}

export async function createAgreementForLead(
  input: CreateAgreementForLeadInput,
  dependencies: { store?: AgreementLifecycleStore } = {},
): Promise<Agreement> {
  const store = dependencies.store ?? prismaAgreementLifecycleStore;
  try {
    return await store.transaction(async (transaction) => {
      const lead = await transaction.contactSubmission.findUnique({
        where: { id: input.leadId },
        include: { assignees: { select: { id: true } } },
      });
      if (!lead) throw new LeadDomainError("NOT_FOUND", "Lead not found");
      assertCommercialLeadReady(lead);
      await assertActorCanMutateLead(transaction, input.actor, lead);
      if (!lead.ownerId) {
        throw new LeadDomainError(
          "CONFLICT",
          "Lead must be assigned to an owner before agreement creation",
        );
      }
      if (lead.stage !== "QUALIFIED") {
        throw new LeadDomainError(
          "CONFLICT",
          "Only a qualified lead may create an agreement",
        );
      }
      const active = await transaction.agreement.findFirst({
        where: {
          leadId: lead.id,
          status: { in: ["DRAFT", "SENT", "SIGNED"] },
        },
        select: { id: true },
      });
      if (active) {
        throw new LeadDomainError(
          "CONFLICT",
          "Lead already has an active agreement",
        );
      }

      const agreement = await transaction.agreement.create({
        data: {
          ...input.agreement,
          businessName: input.agreement.businessName || null,
          idNumber: input.agreement.idNumber || null,
          clientId: input.agreement.clientId || null,
          leadId: lead.id,
          creditedSellerId: lead.ownerId,
          createdBy: input.actor.userId,
          isSellerDeal: true,
          status: "DRAFT",
        },
      });
      const occurredAt = new Date();
      await persistLeadAgreementStage(transaction, {
        lead,
        toStage: "AGREEMENT_DRAFT",
        occurredAt,
      });
      await appendLeadEventOnce(transaction, {
        leadId: lead.id,
        type: "AGREEMENT_CREATED",
        actor: userActor(input.actor),
        fromStage: "QUALIFIED",
        toStage: "AGREEMENT_DRAFT",
        occurredAt,
        dedupeKey: `lead:${lead.id}:agreement-created:${agreement.id}`,
        metadata: { agreementId: agreement.id },
      });
      return agreement;
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new LeadDomainError(
        "CONFLICT",
        "Lead already has an active agreement",
      );
    }
    throw error;
  }
}

export async function createStandaloneAgreement(
  input: {
    actor: AuthenticatedLeadActor;
    agreement: ValidatedAgreementDraft;
  },
  dependencies: { store?: AgreementLifecycleStore } = {},
): Promise<Agreement> {
  if (input.actor.role !== "ADMIN") {
    throw new LeadDomainError("FORBIDDEN", "Admin role is required");
  }
  const store = dependencies.store ?? prismaAgreementLifecycleStore;
  return store.transaction(async (transaction) => {
    const actor = await transaction.user.findUnique({
      where: { id: input.actor.userId },
      select: { role: true },
    });
    if (actor?.role !== "ADMIN") {
      throw new LeadDomainError("FORBIDDEN", "Admin role is required");
    }
    return transaction.agreement.create({
      data: {
        ...input.agreement,
        businessName: input.agreement.businessName || null,
        idNumber: input.agreement.idNumber || null,
        clientId: input.agreement.clientId || null,
        createdBy: input.actor.userId,
        isSellerDeal: false,
        status: "DRAFT",
      },
    });
  });
}

export async function updateAgreementDraftFields(
  input: {
    agreementId: string;
    actor: AuthenticatedLeadActor;
    data: {
      tier?: Agreement["tier"];
      additionalServices?: string[];
      monthlyPrice?: number;
      oneTimeFee?: number | null;
      customerName?: string;
      businessName?: string | null;
      idNumber?: string | null;
      phone?: string;
      email?: string;
      clientId?: string | null;
      locale?: string;
      vatExempt?: boolean;
      content?: string;
      documentVersion?: number;
    };
  },
  dependencies: { store?: AgreementLifecycleStore } = {},
): Promise<Agreement> {
  const store = dependencies.store ?? prismaAgreementLifecycleStore;
  return store.transaction(async (transaction) => {
    const agreement = await transaction.agreement.findUnique({
      where: { id: input.agreementId },
      include: {
        lead: { include: { assignees: { select: { id: true } } } },
      },
    });
    if (!agreement) {
      throw new LeadDomainError("NOT_FOUND", "Agreement not found");
    }
    await authorizeAgreementUserAction(transaction, input.actor, agreement);
    if (agreement.status === "SIGNED" || agreement.status === "CANCELLED") {
      throw new LeadDomainError(
        "CONFLICT",
        "Finalized agreement content is immutable",
      );
    }
    return transaction.agreement.update({
      where: { id: agreement.id },
      data: input.data,
    });
  });
}

async function authorizeAgreementUserAction(
  transaction: Prisma.TransactionClient,
  actor: AuthenticatedLeadActor,
  agreement: {
    lead:
      | (Prisma.ContactSubmissionGetPayload<{
          include: { assignees: { select: { id: true } } };
        }>)
      | null;
  },
): Promise<void> {
  if (!agreement.lead) {
    const user = await transaction.user.findUnique({
      where: { id: actor.userId },
      select: { role: true },
    });
    if (!user || user.role !== actor.role || user.role !== "ADMIN") {
      throw new LeadDomainError(
        "FORBIDDEN",
        "Only an admin may mutate an unlinked agreement",
      );
    }
    return;
  }
  await assertActorCanMutateLead(transaction, actor, agreement.lead);
}

async function applySingleAgreementEvent(
  transaction: Prisma.TransactionClient,
  input: ApplyAgreementEventInput,
  agreement: Prisma.AgreementGetPayload<{
    include: {
      lead: { include: { assignees: { select: { id: true } } } };
    };
  }>,
  options: { allowImplicitIntegrationSent?: boolean } = {},
): Promise<AgreementLeadResult> {
  const occurredAt =
    "occurredAt" in input.actor && input.actor.occurredAt
      ? input.actor.occurredAt
      : new Date();
  if (input.type === "CANCELLED" && !input.reason?.trim()) {
    throw new LeadDomainError(
      "VALIDATION",
      "Agreement cancellation requires a reason",
    );
  }
  if (isAuthenticatedActor(input.actor)) {
    await authorizeAgreementUserAction(transaction, input.actor, agreement);
  } else if (
    input.actor.type !== "INTEGRATION" ||
    (input.type !== "SIGNED" &&
      !(input.type === "SENT" && options.allowImplicitIntegrationSent))
  ) {
    throw new LeadDomainError(
      "FORBIDDEN",
      "This agreement event requires an authenticated user",
    );
  }

  const targetStatus =
    input.type === "SENT"
      ? "SENT"
      : input.type === "SIGNED"
        ? "SIGNED"
        : "CANCELLED";
  const statusAlreadyApplied =
    agreement.status === targetStatus ||
    (input.type === "SENT" && agreement.status === "SIGNED");
  if (agreement.status === "CANCELLED" && input.type !== "CANCELLED") {
    throw new LeadDomainError("CONFLICT", "Agreement is cancelled");
  }
  if (
    input.type === "CANCELLED" &&
    agreement.paymentStatus === "COMPLETED"
  ) {
    throw new LeadDomainError(
      "CONFLICT",
      "A paid agreement cannot be cancelled through this path",
    );
  }
  if (
    input.type === "SENT" &&
    agreement.status !== "DRAFT" &&
    agreement.status !== "SENT" &&
    agreement.status !== "SIGNED"
  ) {
    throw new LeadDomainError("CONFLICT", "Agreement cannot be marked sent");
  }

  if (!statusAlreadyApplied) {
    await transaction.agreement.update({
      where: { id: agreement.id },
      data: { status: targetStatus },
    });
  }
  let stage = agreement.lead?.stage ?? null;
  if (agreement.lead) {
    const ready =
      !agreement.lead.migrationReviewRequired &&
      agreement.lead.intentLevel !== null &&
      agreement.lead.sourceKey !== null &&
      agreement.lead.stage !== null;
    const fromStage = agreement.lead.stage;
    const terminal =
      fromStage === "WON" || fromStage === "LOST" || fromStage === "SPAM";
    let toStage = fromStage;
    if (ready && !terminal) {
      if (input.type === "SENT") {
        toStage =
          fromStage === "AGREEMENT_DRAFT" ? "AGREEMENT_SENT" : fromStage;
      } else if (input.type === "SIGNED") {
        toStage =
          fromStage === "AGREEMENT_DRAFT" ||
          fromStage === "AGREEMENT_SENT" ||
          fromStage === "QUALIFIED"
            ? "AGREEMENT_SIGNED"
            : fromStage;
      } else {
        toStage =
          fromStage === "AGREEMENT_DRAFT" ||
          fromStage === "AGREEMENT_SENT" ||
          fromStage === "AGREEMENT_SIGNED"
            ? "QUALIFIED"
            : fromStage;
      }
    }
    if (
      ready &&
      !terminal &&
      fromStage !== null &&
      toStage !== null &&
      fromStage !== toStage
    ) {
      await persistLeadAgreementStage(transaction, {
        lead: agreement.lead,
        toStage,
        occurredAt,
      });
      agreement.lead.stage = toStage;
      agreement.lead.status = legacyStatusForStage(toStage);
      stage = toStage;
    }
    const eventType =
      input.type === "SENT"
        ? "AGREEMENT_SENT"
        : input.type === "SIGNED"
          ? "AGREEMENT_SIGNED"
          : "AGREEMENT_CANCELLED";
    const suffix =
      input.type === "SENT"
        ? "sent"
        : input.type === "SIGNED"
          ? "signed"
          : "cancelled";
    await appendLeadEventOnce(transaction, {
      leadId: agreement.lead.id,
      type: eventType,
      actor: isAuthenticatedActor(input.actor)
        ? userActor(input.actor)
        : input.actor,
      fromStage,
      toStage,
      occurredAt,
      dedupeKey: `lead:${agreement.lead.id}:agreement-${suffix}:${agreement.id}`,
      metadata: {
        agreementId: agreement.id,
        ...(input.reason ? { reason: input.reason.trim() } : {}),
      },
    });
  }
  return {
    agreementId: agreement.id,
    leadId: agreement.leadId,
    stage,
    effects: [],
  };
}

export async function applyAgreementEventInTransaction(
  transaction: Prisma.TransactionClient,
  input: ApplyAgreementEventInput,
): Promise<AgreementLeadResult> {
  let agreement = await transaction.agreement.findUnique({
    where: { id: input.agreementId },
    include: {
      lead: { include: { assignees: { select: { id: true } } } },
    },
  });
  if (!agreement) throw new LeadDomainError("NOT_FOUND", "Agreement not found");

  // A verified signature is also the bounded repair path for legacy rows that
  // reached SIGNED without ever recording the explicit SENT fact.
  if (input.type === "SIGNED" && agreement.status !== "CANCELLED") {
    await applySingleAgreementEvent(
      transaction,
      { ...input, type: "SENT" },
      agreement,
      { allowImplicitIntegrationSent: true },
    );
    agreement = await transaction.agreement.findUnique({
      where: { id: input.agreementId },
      include: {
        lead: { include: { assignees: { select: { id: true } } } },
      },
    });
    if (!agreement) {
      throw new LeadDomainError("NOT_FOUND", "Agreement not found");
    }
  }
  return applySingleAgreementEvent(transaction, input, agreement);
}

export async function applyAgreementEvent(
  input: ApplyAgreementEventInput,
  dependencies: {
    store?: AgreementLifecycleStore;
    runEffect?: (effect: LeadPostCommitEffect) => Promise<void>;
  } = {},
): Promise<AgreementLeadResult> {
  const store = dependencies.store ?? prismaAgreementLifecycleStore;
  const result = await store.transaction((transaction) =>
    applyAgreementEventInTransaction(transaction, input),
  );
  const runEffect =
    dependencies.runEffect ??
    (dependencies.store
      ? undefined
      : async (effect: LeadPostCommitEffect) => {
          await createNotification(effect.input);
        });
  if (runEffect) {
    await Promise.all(result.effects.map((effect) => runEffect(effect)));
  }
  return result;
}

async function resolveCreditedSeller(
  transaction: Prisma.TransactionClient,
  agreement: {
    id: string;
    creditedSellerId: string | null;
    createdBy: string;
    isSellerDeal: boolean;
  },
): Promise<string | null> {
  if (agreement.creditedSellerId) return agreement.creditedSellerId;
  if (!agreement.isSellerDeal || !agreement.createdBy) return null;
  const creator = await transaction.user.findUnique({
    where: { id: agreement.createdBy },
    select: { role: true },
  });
  if (creator?.role !== "SELLER") return null;
  await transaction.agreement.update({
    where: { id: agreement.id },
    data: { creditedSellerId: agreement.createdBy },
  });
  return agreement.createdBy;
}

export async function applyPaymentSuccess(
  transaction: Prisma.TransactionClient,
  input: PaymentSuccessInput,
): Promise<PaymentLeadResult> {
  if (
    input.actor.type !== "INTEGRATION" ||
    !input.providerTransactionId.trim() ||
    !Number.isFinite(input.paidAmount) ||
    input.paidAmount <= 0
  ) {
    throw new LeadDomainError("VALIDATION", "Verified payment data is required");
  }
  const agreement = await transaction.agreement.findUnique({
    where: { id: input.agreementId },
    include: {
      lead: { include: { assignees: { select: { id: true } } } },
    },
  });
  if (!agreement) throw new LeadDomainError("NOT_FOUND", "Agreement not found");
  const providerTransactionId =
    agreement.cardcomDealId ?? input.providerTransactionId.trim();
  const paymentWrite = await transaction.agreement.updateMany({
    where: {
      id: agreement.id,
      paymentStatus: { not: "COMPLETED" },
    },
    data: {
      paymentStatus: "COMPLETED",
      paidAt: input.paidAt,
      paidAmount: input.paidAmount,
      cardcomDealId: providerTransactionId,
    },
  });
  if (paymentWrite.count === 0 && !agreement.paidAt) {
    await transaction.agreement.update({
      where: { id: agreement.id },
      data: {
        paidAt: input.paidAt,
        paidAmount: input.paidAmount,
        cardcomDealId: providerTransactionId,
      },
    });
  }

  const creditedSellerId = await resolveCreditedSeller(transaction, agreement);
  let commissionCreated = false;
  const existingCommission = await transaction.sellerCommission.findUnique({
    where: { agreementId: agreement.id },
  });
  if (creditedSellerId && !existingCommission) {
    try {
      await transaction.sellerCommission.create({
        data: {
          sellerId: creditedSellerId,
          agreementId: agreement.id,
          agreementRefId: agreement.id,
          agreementLinkStatus: "LINKED",
          clientName: agreement.customerName,
          amount: agreement.monthlyPrice,
        },
      });
      commissionCreated = true;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  } else if (
    creditedSellerId &&
    existingCommission &&
    (existingCommission.agreementRefId !== agreement.id ||
      existingCommission.agreementLinkStatus !== "LINKED" ||
      existingCommission.sellerId !== creditedSellerId)
  ) {
    await transaction.sellerCommission.update({
      where: { id: existingCommission.id },
      data: {
        sellerId: creditedSellerId,
        agreementRefId: agreement.id,
        agreementLinkStatus: "LINKED",
      },
    });
  }

  const effects: LeadPostCommitEffect[] = [];
  let stage = agreement.lead?.stage ?? null;
  if (agreement.lead) {
    const lead = agreement.lead;
    const fromStage = lead.stage;
    await appendLeadEventOnce(transaction, {
      leadId: lead.id,
      type: "PAYMENT_SUCCEEDED",
      actor: input.actor,
      fromStage,
      toStage: "WON",
      occurredAt: input.paidAt,
      dedupeKey: `lead:${lead.id}:payment-succeeded:${providerTransactionId}`,
      metadata: {
        agreementId: agreement.id,
        providerTransactionId,
        paidAmount: input.paidAmount,
      },
    });
    await cancelActiveFollowUps(transaction, {
      leadId: lead.id,
      occurredAt: input.paidAt,
    });
    const status = legacyStatusForStage("WON");
    await transaction.contactSubmission.update({
      where: { id: lead.id },
      data: {
        stage: "WON",
        status,
        wonAt: lead.wonAt ?? input.paidAt,
        closedAt: lead.closedAt ?? input.paidAt,
        nextFollowUpAt: null,
        legacyStateHash: legacyHashForLead(
          lead,
          lead.assignees.map(({ id }) => id),
          {
            status,
            closedAt: lead.closedAt ?? input.paidAt,
            nextFollowUpAt: null,
          },
        ),
      },
    });
    stage = "WON";
    await appendLeadEventOnce(transaction, {
      leadId: lead.id,
      type: "WON",
      actor: input.actor,
      fromStage,
      toStage: "WON",
      occurredAt: input.paidAt,
      dedupeKey: `lead:${lead.id}:won`,
      metadata: { agreementId: agreement.id },
    });
    if (fromStage === "LOST") {
      const admins = await transaction.user.findMany({
        where: { role: "ADMIN" },
        select: { id: true },
      });
      for (const admin of admins) {
        effects.push({
          kind: "NOTIFICATION",
          input: {
            recipientId: admin.id,
            type: "PAYMENT_MISMATCH",
            title: "תשלום התקבל לאחר שהליד סומן כאבוד",
            leadId: lead.id,
            url: leadActionUrlFor({ audience: "ADMIN", lead }),
            dedupeKey: `${admin.id}:payment-mismatch:${agreement.id}:${providerTransactionId}`,
          },
        });
      }
    }
  }
  if (creditedSellerId && (commissionCreated || existingCommission)) {
    effects.push({
      kind: "NOTIFICATION",
      input: {
        recipientId: creditedSellerId,
        type: "AGREEMENT_SIGNED",
        title: `העסקה שולמה — ${agreement.customerName}`,
        body: `עמלה: ${agreement.monthlyPrice} ₪ נרשמה לך`,
        leadId: agreement.leadId ?? undefined,
        url: `/seller/report/${agreement.id}`,
        dedupeKey: `${creditedSellerId}:commission-created:${agreement.id}`,
      },
    });
  } else if (agreement.isSellerDeal && !creditedSellerId) {
    const admins = await transaction.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true },
    });
    for (const admin of admins) {
      effects.push({
        kind: "NOTIFICATION",
        input: {
          recipientId: admin.id,
          type: "PAYMENT_MISMATCH",
          title: "תשלום מוכר ללא שיוך עמלה מוכח",
          leadId: agreement.leadId ?? undefined,
          url: agreement.lead
            ? leadActionUrlFor({ audience: "ADMIN", lead: agreement.lead })
            : "/admin/agreements",
          dedupeKey: `${admin.id}:payment-credit-missing:${agreement.id}:${providerTransactionId}`,
        },
      });
    }
  }
  return {
    agreementId: agreement.id,
    leadId: agreement.leadId,
    stage,
    effects,
    commissionCreated,
    paymentRecorded: paymentWrite.count === 1,
  };
}

export async function applyPaymentFailure(
  transaction: Prisma.TransactionClient,
  input: PaymentFailureInput,
): Promise<PaymentLeadResult> {
  if (
    input.actor.type !== "INTEGRATION" ||
    !input.providerAttemptId.trim()
  ) {
    throw new LeadDomainError(
      "VALIDATION",
      "A verified provider attempt ID is required",
    );
  }
  const agreement = await transaction.agreement.findUnique({
    where: { id: input.agreementId },
    include: {
      lead: { include: { assignees: { select: { id: true } } } },
    },
  });
  if (!agreement) throw new LeadDomainError("NOT_FOUND", "Agreement not found");
  if (agreement.paymentStatus !== "COMPLETED") {
    await transaction.agreement.update({
      where: { id: agreement.id },
      data: { paymentStatus: "FAILED" },
    });
  }
  const effects: LeadPostCommitEffect[] = [];
  if (agreement.lead) {
    await appendLeadEventOnce(transaction, {
      leadId: agreement.lead.id,
      type: "PAYMENT_FAILED",
      actor: input.actor,
      fromStage: agreement.lead.stage,
      toStage: agreement.lead.stage,
      occurredAt: input.occurredAt,
      dedupeKey: `lead:${agreement.lead.id}:payment-failed:${input.providerAttemptId}`,
      metadata: {
        agreementId: agreement.id,
        providerAttemptId: input.providerAttemptId,
      },
    });
    const recipientId = await resolveCreditedSeller(transaction, agreement);
    if (recipientId) {
      effects.push({
        kind: "NOTIFICATION",
        input: {
          recipientId,
          type: "PAYMENT_FAILED",
          title: "התשלום הראשון נכשל",
          body: agreement.customerName,
          leadId: agreement.lead.id,
          url: sellerLeadActionUrl(agreement.lead),
          dedupeKey: `${recipientId}:payment-failed:${agreement.id}:${input.providerAttemptId}`,
        },
      });
    } else {
      const admins = await transaction.user.findMany({
        where: { role: "ADMIN" },
        select: { id: true },
      });
      for (const admin of admins) {
        effects.push({
          kind: "NOTIFICATION",
          input: {
            recipientId: admin.id,
            type: "PAYMENT_FAILED",
            title: "התשלום הראשון נכשל",
            body: agreement.customerName,
            leadId: agreement.lead.id,
            url: leadActionUrlFor({
              audience: "ADMIN",
              lead: agreement.lead,
            }),
            dedupeKey: `${admin.id}:payment-failed:${agreement.id}:${input.providerAttemptId}`,
          },
        });
      }
    }
  }
  return {
    agreementId: agreement.id,
    leadId: agreement.leadId,
    stage: agreement.lead?.stage ?? null,
    effects,
    commissionCreated: false,
    paymentRecorded: false,
  };
}

export async function changeAgreementCredit(
  input: ChangeAgreementCreditInput,
  dependencies: { store?: AgreementLifecycleStore } = {},
): Promise<Agreement> {
  if (input.actor.role !== "ADMIN") {
    throw new LeadDomainError("FORBIDDEN", "Admin role is required");
  }
  if (!input.reason.trim()) {
    throw new LeadDomainError("VALIDATION", "Credit change reason is required");
  }
  const store = dependencies.store ?? prismaAgreementLifecycleStore;
  return store.transaction(async (transaction) => {
    const actor = await transaction.user.findUnique({
      where: { id: input.actor.userId },
      select: { role: true },
    });
    if (actor?.role !== "ADMIN") {
      throw new LeadDomainError("FORBIDDEN", "Admin role is required");
    }
    const seller = await transaction.user.findUnique({
      where: { id: input.creditedSellerId },
      select: { role: true },
    });
    if (seller?.role !== "SELLER") {
      throw new LeadDomainError("VALIDATION", "Credited seller is invalid");
    }
    const agreement = await transaction.agreement.findUnique({
      where: { id: input.agreementId },
      include: {
        lead: { include: { assignees: { select: { id: true } } } },
      },
    });
    if (!agreement) {
      throw new LeadDomainError("NOT_FOUND", "Agreement not found");
    }
    const before = agreement.creditedSellerId;
    if (before === input.creditedSellerId) return agreement;
    const updated = await transaction.agreement.update({
      where: { id: agreement.id },
      data: { creditedSellerId: input.creditedSellerId },
    });
    const commission = await transaction.sellerCommission.findUnique({
      where: { agreementId: agreement.id },
    });
    if (commission) {
      await transaction.sellerCommission.update({
        where: { id: commission.id },
        data: { sellerId: input.creditedSellerId },
      });
    }
    if (agreement.lead) {
      await appendLeadEvent(transaction, {
        leadId: agreement.lead.id,
        type: "COMMISSION_CREDIT_CHANGED",
        actor: userActor(input.actor),
        fromStage: agreement.lead.stage,
        toStage: agreement.lead.stage,
        metadata: {
          agreementId: agreement.id,
          beforeSellerId: before,
          afterSellerId: input.creditedSellerId,
          reason: input.reason.trim(),
        },
      });
    }
    return updated;
  });
}

export async function runLeadPostCommitEffects(
  effects: readonly LeadPostCommitEffect[],
): Promise<void> {
  await Promise.all(
    effects.map((effect) => createNotification(effect.input)),
  );
}

export type { CreateNotificationInput };
