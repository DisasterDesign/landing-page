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
import { verifiedFirstPaymentEvidence } from "./payment-verification";
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

async function assertPersistedMigrationAdmin(
  transaction: Prisma.TransactionClient,
  actor: AuthenticatedLeadActor,
  reason: string,
): Promise<string> {
  const normalizedReason = reason.trim();
  if (!normalizedReason) {
    throw new LeadDomainError(
      "VALIDATION",
      "Migration resolution reason is required",
    );
  }
  if (actor.role !== "ADMIN") {
    throw new LeadDomainError("FORBIDDEN", "Admin role is required");
  }
  const persistedActor = await transaction.user.findUnique({
    where: { id: actor.userId },
    select: { role: true },
  });
  if (persistedActor?.role !== "ADMIN") {
    throw new LeadDomainError("FORBIDDEN", "Admin role is required");
  }
  return normalizedReason;
}

function normalizedPhone(value: string | null | undefined): string | null {
  const normalized = value?.replace(/\D/g, "") ?? "";
  return normalized || null;
}

function normalizedEmail(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLocaleLowerCase("en") ?? "";
  return normalized || null;
}

interface ContactIdentityEvidence {
  phone?: string | null;
  email?: string | null;
}

function hasMatchingContactIdentity(
  left: ContactIdentityEvidence | null,
  right: ContactIdentityEvidence | null,
): boolean {
  if (!left || !right) return false;
  const leftPhone = normalizedPhone(left.phone);
  const rightPhone = normalizedPhone(right.phone);
  if (leftPhone && rightPhone && leftPhone === rightPhone) return true;
  const leftEmail = normalizedEmail(left.email);
  const rightEmail = normalizedEmail(right.email);
  return Boolean(leftEmail && rightEmail && leftEmail === rightEmail);
}

function hasAnyMatchingContactIdentity(
  left: Array<ContactIdentityEvidence | null>,
  right: Array<ContactIdentityEvidence | null>,
): boolean {
  return left.some((leftIdentity) =>
    right.some((rightIdentity) =>
      hasMatchingContactIdentity(leftIdentity, rightIdentity),
    ),
  );
}

function isActiveAgreementStatus(status: string): boolean {
  return status === "DRAFT" || status === "SENT" || status === "SIGNED";
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

      // Attribution is the LEAD OWNER, never the creator: Elad routinely
      // types in agreements for a partner's lead, and the deal is still the
      // partner's. A lead owned by the owner himself produces a plain house
      // deal — partnerId null, no isSellerDeal, no first-month commission.
      const owner = lead.ownerId
        ? await transaction.user.findUnique({
            where: { id: lead.ownerId },
            select: { role: true },
          })
        : null;
      const sellerOwned = owner?.role === "SELLER";
      const partnerId = sellerOwned ? lead.ownerId : null;
      const agreement = await transaction.agreement.create({
        data: {
          ...input.agreement,
          businessName: input.agreement.businessName || null,
          idNumber: input.agreement.idNumber || null,
          clientId: input.agreement.clientId || null,
          leadId: lead.id,
          partnerId,
          // Legacy mirror of partnerId for SellerCommission bookkeeping.
          creditedSellerId: partnerId,
          // Audit only — who typed this in. Never attribution.
          createdBy: input.actor.userId,
          isSellerDeal: sellerOwned,
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
    // A lead-less agreement has no lead owner to attribute it to, and the
    // creator is audit data, never attribution. But an agreement written
    // against an EXISTING client is more of that client's business, so it
    // inherits their partner — otherwise the client would sit under one
    // partner while a deal on that same client sits under nobody, which is
    // exactly the split-truth this model exists to end. No client → a
    // genuine house deal, left unattributed.
    const clientId = input.agreement.clientId || null;
    const linkedClient = clientId
      ? await transaction.client.findUnique({
          where: { id: clientId },
          select: { ownerId: true },
        })
      : null;
    const inheritedPartnerId = linkedClient?.ownerId ?? null;
    const partnerIsSeller = inheritedPartnerId
      ? (
          await transaction.user.findUnique({
            where: { id: inheritedPartnerId },
            select: { role: true },
          })
        )?.role === "SELLER"
      : false;

    return transaction.agreement.create({
      data: {
        ...input.agreement,
        businessName: input.agreement.businessName || null,
        idNumber: input.agreement.idNumber || null,
        clientId,
        partnerId: partnerIsSeller ? inheritedPartnerId : null,
        // The legacy mirror stays null: it is derived at payment time from
        // partnerId, and only for partners on the first-month model.
        creditedSellerId: null,
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

/**
 * THE attribution precedence for a deal — the only one allowed in this
 * codebase:
 *   1. `partnerId`        — the explicit "which partner generated this deal".
 *   2. `creditedSellerId` — legacy mirror, for rows written before partnerId.
 *
 * `createdBy` is deliberately absent. It records who TYPED the agreement in,
 * not who brought the business; Elad creates agreements on a partner's behalf,
 * so promoting the creator is what made 8 of 14 signed agreements contradict
 * their own client's ownerId. Never add it back.
 */
export function resolveAgreementPartnerId(agreement: {
  partnerId?: string | null;
  creditedSellerId?: string | null;
}): string | null {
  return agreement.partnerId ?? agreement.creditedSellerId ?? null;
}

/**
 * The seller whose commission bookkeeping this agreement feeds. Derived from
 * the attribution above and mirrored into `creditedSellerId`, which
 * SellerCommission still keys on. Returns null for a house deal — a partnerId
 * pointing at the owner (or at any non-SELLER) must never earn a first-month
 * seller commission.
 */
async function resolveCreditedSeller(
  transaction: Prisma.TransactionClient,
  agreement: {
    id: string;
    partnerId: string | null;
    creditedSellerId: string | null;
  },
): Promise<string | null> {
  const partnerId = resolveAgreementPartnerId(agreement);
  if (!partnerId) return null;
  if (agreement.creditedSellerId === partnerId) return partnerId;
  const partner = await transaction.user.findUnique({
    where: { id: partnerId },
    select: { role: true },
  });
  if (partner?.role !== "SELLER") return null;
  await transaction.agreement.update({
    where: { id: agreement.id },
    data: { creditedSellerId: partnerId },
  });
  return partnerId;
}

type NormalizedVerifiedPayment = {
  providerAttemptId: string;
  providerReturnValue: string;
  providerTransactionId: string;
  paidAt: Date;
  paidAmount: number;
  verifiedAt: Date;
};

type PaymentProofAgreement = Pick<
  Agreement,
  | "id"
  | "paymentId"
  | "cardcomLowProfileId"
  | "paymentStatus"
  | "paidAt"
  | "paidAmount"
  | "cardcomDealId"
  | "cardcomVerifiedLowProfileId"
  | "cardcomVerifiedReturnValue"
  | "cardcomVerifiedTransactionId"
  | "cardcomVerifiedAmount"
  | "cardcomPaymentVerifiedAt"
>;

function normalizeVerifiedPaymentInput(
  input: PaymentSuccessInput,
): NormalizedVerifiedPayment {
  const providerAttemptId = input.providerAttemptId.trim();
  const providerReturnValue = input.providerReturnValue.trim();
  const providerTransactionId = input.providerTransactionId.trim();
  if (
    input.actor.type !== "INTEGRATION" ||
    !providerAttemptId ||
    !providerReturnValue ||
    !providerTransactionId ||
    !Number.isFinite(input.paidAmount) ||
    input.paidAmount <= 0 ||
    !(input.paidAt instanceof Date) ||
    Number.isNaN(input.paidAt.getTime()) ||
    !(input.verifiedAt instanceof Date) ||
    Number.isNaN(input.verifiedAt.getTime())
  ) {
    throw new LeadDomainError("VALIDATION", "Verified payment data is required");
  }
  if (providerReturnValue !== input.agreementId) {
    throw new LeadDomainError(
      "CONFLICT",
      "Provider return value does not match the agreement",
    );
  }
  return {
    providerAttemptId,
    providerReturnValue,
    providerTransactionId,
    paidAt: input.paidAt,
    paidAmount: input.paidAmount,
    verifiedAt: input.verifiedAt,
  };
}

function assertPaymentProofCompatible(
  agreement: PaymentProofAgreement,
  proof: NormalizedVerifiedPayment,
): void {
  if (proof.providerReturnValue !== agreement.id) {
    throw new LeadDomainError(
      "CONFLICT",
      "Provider return value does not match the agreement",
    );
  }
  if (
    (agreement.paymentId &&
      agreement.paymentId.trim() !== proof.providerAttemptId) ||
    (agreement.cardcomLowProfileId &&
      agreement.cardcomLowProfileId.trim() !== proof.providerAttemptId) ||
    (agreement.cardcomVerifiedLowProfileId &&
      agreement.cardcomVerifiedLowProfileId.trim() !==
        proof.providerAttemptId)
  ) {
    throw new LeadDomainError(
      "CONFLICT",
      "Provider payment attempt conflicts with the stored LowProfile attempt",
    );
  }
  // A payment page must have been persisted before its provider result can be
  // accepted. This is the immutable attempt that GetLpResult was queried for.
  if (!agreement.paymentId?.trim()) {
    throw new LeadDomainError(
      "CONFLICT",
      "Verified payment has no stored LowProfile attempt",
    );
  }
  if (
    (agreement.cardcomDealId &&
      agreement.cardcomDealId.trim() !== proof.providerTransactionId) ||
    (agreement.cardcomVerifiedTransactionId &&
      agreement.cardcomVerifiedTransactionId.trim() !==
        proof.providerTransactionId)
  ) {
    throw new LeadDomainError(
      "CONFLICT",
      "Provider transaction conflicts with immutable payment proof",
    );
  }
  if (
    agreement.cardcomVerifiedReturnValue &&
    agreement.cardcomVerifiedReturnValue.trim() !== proof.providerReturnValue
  ) {
    throw new LeadDomainError(
      "CONFLICT",
      "Provider return value conflicts with immutable payment proof",
    );
  }
  if (
    (agreement.paidAmount !== null &&
      !samePaymentAmount(agreement.paidAmount, proof.paidAmount)) ||
    (agreement.cardcomVerifiedAmount !== null &&
      !samePaymentAmount(
        agreement.cardcomVerifiedAmount,
        proof.paidAmount,
      ))
  ) {
    throw new LeadDomainError(
      "CONFLICT",
      "Provider amount conflicts with stored payment evidence",
    );
  }
}

function paymentPersistenceData(
  agreement: PaymentProofAgreement,
  proof: NormalizedVerifiedPayment,
): Prisma.AgreementUpdateManyMutationInput {
  return {
    paymentStatus: "COMPLETED",
    paidAt: proof.paidAt,
    paidAmount: proof.paidAmount,
    cardcomDealId: proof.providerTransactionId,
    cardcomVerifiedLowProfileId:
      agreement.cardcomVerifiedLowProfileId ?? proof.providerAttemptId,
    cardcomVerifiedReturnValue:
      agreement.cardcomVerifiedReturnValue ?? proof.providerReturnValue,
    cardcomVerifiedTransactionId:
      agreement.cardcomVerifiedTransactionId ??
      proof.providerTransactionId,
    cardcomVerifiedAmount:
      agreement.cardcomVerifiedAmount ?? proof.paidAmount,
    cardcomPaymentVerifiedAt:
      agreement.cardcomPaymentVerifiedAt ?? proof.verifiedAt,
  };
}

function samePaymentAmount(left: number, right: number): boolean {
  return Math.round(left * 100) === Math.round(right * 100);
}

export async function applyPaymentSuccess(
  transaction: Prisma.TransactionClient,
  input: PaymentSuccessInput,
): Promise<PaymentLeadResult> {
  const proof = normalizeVerifiedPaymentInput(input);
  const agreement = await transaction.agreement.findUnique({
    where: { id: input.agreementId },
    include: {
      lead: { include: { assignees: { select: { id: true } } } },
    },
  });
  if (!agreement) throw new LeadDomainError("NOT_FOUND", "Agreement not found");
  assertPaymentProofCompatible(agreement, proof);
  const providerTransactionId = proof.providerTransactionId;
  const paymentWrite = await transaction.agreement.updateMany({
    where: {
      id: agreement.id,
      paymentStatus: { not: "COMPLETED" },
    },
    data: paymentPersistenceData(agreement, proof),
  });
  if (paymentWrite.count === 0) {
    // updateMany may have waited behind a concurrent verified callback. Reload
    // after the guarded write so a competing provider identity can never be
    // overwritten from the stale pre-lock Agreement snapshot.
    const persisted = await transaction.agreement.findUnique({
      where: { id: agreement.id },
    });
    if (!persisted) {
      throw new LeadDomainError("NOT_FOUND", "Agreement not found");
    }
    assertPaymentProofCompatible(persisted, proof);
    await transaction.agreement.update({
      where: { id: agreement.id },
      data: paymentPersistenceData(persisted, proof),
    });
  }

  const creditedSellerId = await resolveCreditedSeller(transaction, agreement);
  // Partner split model: a first-month SellerCommission is only for partners
  // WITHOUT a recurring share. A recurring-share partner (Roy, 50%) is paid
  // monthly through the partner report — crediting him a first-month row too
  // would pay the first month twice.
  const creditedPartner = creditedSellerId
    ? await transaction.user.findUnique({
        where: { id: creditedSellerId },
        select: { revenueSharePct: true },
      })
    : null;
  const firstMonthEligible =
    creditedSellerId !== null && creditedPartner?.revenueSharePct == null;
  let commissionCreated = false;
  const existingCommission = await transaction.sellerCommission.findUnique({
    where: { agreementId: agreement.id },
  });
  if (creditedSellerId && firstMonthEligible && !existingCommission) {
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
    firstMonthEligible &&
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
        providerAttemptId: proof.providerAttemptId,
        providerReturnValue: proof.providerReturnValue,
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
    const before = resolveAgreementPartnerId(agreement);
    if (before === input.creditedSellerId) return agreement;
    // partnerId is the attribution field, so the correction MUST write it —
    // writing creditedSellerId alone would be silently overridden by the
    // stale partnerId on the next read. creditedSellerId follows as the
    // legacy mirror.
    const updated = await transaction.agreement.update({
      where: { id: agreement.id },
      data: {
        partnerId: input.creditedSellerId,
        creditedSellerId: input.creditedSellerId,
      },
    });
    // Client.ownerId is derived from the client's FIRST agreement's partnerId.
    // Re-derive it here, or the admin's correction would leave the client
    // contradicting its own agreement — the exact bug this field replaced.
    const clientOwnerChange = await syncClientOwnerFromFirstAgreement(
      transaction,
      agreement.clientId,
    );
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
          beforeClientOwnerId: clientOwnerChange?.before ?? null,
          afterClientOwnerId: clientOwnerChange?.after ?? null,
          reason: input.reason.trim(),
        },
      });
    }
    return updated;
  });
}

/**
 * Client.ownerId is DERIVED, never guessed: it is the partnerId of the
 * client's first agreement (a house deal keeps the owner as the fallback,
 * resolved at signing). Returns the change that was applied, or null when
 * there is nothing to sync.
 */
async function syncClientOwnerFromFirstAgreement(
  transaction: Prisma.TransactionClient,
  clientId: string | null,
): Promise<{ before: string | null; after: string | null } | null> {
  if (!clientId) return null;
  const client = await transaction.client.findUnique({
    where: { id: clientId },
    select: { id: true, ownerId: true },
  });
  if (!client) return null;
  const first = await transaction.agreement.findFirst({
    where: { clientId },
    orderBy: { createdAt: "asc" },
    select: { partnerId: true, creditedSellerId: true },
  });
  if (!first) return null;
  const derived = resolveAgreementPartnerId(first);
  // A house deal (no partner) leaves the existing owner in place — dropping
  // it to null would hide the client from every scoped query.
  if (!derived || derived === client.ownerId) return null;
  await transaction.client.update({
    where: { id: clientId },
    data: { ownerId: derived },
  });
  return { before: client.ownerId, after: derived };
}

export async function recordAgreementPaymentPage(
  input: {
    agreementId: string;
    paymentUrl: string;
    providerPaymentId: string;
  },
  dependencies: { store?: AgreementLifecycleStore } = {},
): Promise<Agreement> {
  if (!input.paymentUrl.trim() || !input.providerPaymentId.trim()) {
    throw new LeadDomainError(
      "VALIDATION",
      "Payment page URL and provider ID are required",
    );
  }
  const store = dependencies.store ?? prismaAgreementLifecycleStore;
  return store.transaction(async (transaction) => {
    const agreement = await transaction.agreement.findUnique({
      where: { id: input.agreementId },
    });
    if (!agreement) {
      throw new LeadDomainError("NOT_FOUND", "Agreement not found");
    }
    if (agreement.paymentStatus === "COMPLETED") {
      throw new LeadDomainError(
        "CONFLICT",
        "Completed payment cannot be replaced",
      );
    }
    if (
      agreement.paymentStatus === "SENT" &&
      agreement.paymentUrl === input.paymentUrl &&
      agreement.paymentId === input.providerPaymentId
    ) {
      return agreement;
    }
    return transaction.agreement.update({
      where: { id: agreement.id },
      data: {
        paymentUrl: input.paymentUrl.trim(),
        paymentId: input.providerPaymentId.trim(),
        paymentStatus: "SENT",
      },
    });
  });
}

export async function claimCommissionBriefTask(
  input: {
    commissionId: string;
    taskId: string;
    actor: AuthenticatedLeadActor;
  },
  dependencies: { store?: AgreementLifecycleStore } = {},
) {
  if (input.actor.role !== "SELLER") {
    throw new LeadDomainError("FORBIDDEN", "Seller role is required");
  }
  const store = dependencies.store ?? prismaAgreementLifecycleStore;
  return store.transaction(async (transaction) => {
    const persistedActor = await transaction.user.findUnique({
      where: { id: input.actor.userId },
      select: { role: true },
    });
    if (persistedActor?.role !== "SELLER") {
      throw new LeadDomainError("FORBIDDEN", "Seller role is required");
    }
    const commission = await transaction.sellerCommission.findUnique({
      where: { id: input.commissionId },
    });
    if (!commission) {
      throw new LeadDomainError("NOT_FOUND", "Commission not found");
    }
    if (commission.sellerId !== input.actor.userId) {
      throw new LeadDomainError(
        "FORBIDDEN",
        "Commission is not owned by this seller",
      );
    }
    if (commission.briefTaskId === input.taskId) return commission;
    if (commission.briefTaskId) {
      throw new LeadDomainError(
        "CONFLICT",
        "Commission already has a developer brief",
      );
    }
    const claimed = await transaction.sellerCommission.updateMany({
      where: {
        id: commission.id,
        sellerId: input.actor.userId,
        briefTaskId: null,
      },
      data: { briefTaskId: input.taskId },
    });
    if (claimed.count !== 1) {
      const current = await transaction.sellerCommission.findUnique({
        where: { id: commission.id },
      });
      if (current?.briefTaskId === input.taskId) return current;
      throw new LeadDomainError(
        "CONFLICT",
        "Commission developer brief was claimed concurrently",
      );
    }
    const updated = await transaction.sellerCommission.findUnique({
      where: { id: commission.id },
    });
    if (!updated) {
      throw new LeadDomainError("NOT_FOUND", "Commission not found");
    }
    return updated;
  });
}

export async function setSellerCommissionPayoutStatus(
  input: {
    commissionId: string;
    status: "PENDING" | "PAID";
    actor: AuthenticatedLeadActor;
  },
  dependencies: { store?: AgreementLifecycleStore } = {},
) {
  if (input.actor.role !== "ADMIN") {
    throw new LeadDomainError("FORBIDDEN", "Admin role is required");
  }
  const store = dependencies.store ?? prismaAgreementLifecycleStore;
  return store.transaction(async (transaction) => {
    const persistedActor = await transaction.user.findUnique({
      where: { id: input.actor.userId },
      select: { role: true },
    });
    if (persistedActor?.role !== "ADMIN") {
      throw new LeadDomainError("FORBIDDEN", "Admin role is required");
    }
    const commission = await transaction.sellerCommission.findUnique({
      where: { id: input.commissionId },
    });
    if (!commission) {
      throw new LeadDomainError("NOT_FOUND", "Commission not found");
    }
    if (commission.status === input.status) return commission;
    return transaction.sellerCommission.update({
      where: { id: commission.id },
      data: {
        status: input.status,
        paidAt: input.status === "PAID" ? new Date() : null,
      },
    });
  });
}

export async function linkAgreementToLeadForMigrationInTransaction(
  transaction: Prisma.TransactionClient,
  input: {
    agreementId: string;
    leadId: string;
    reason: string;
    actor: AuthenticatedLeadActor;
  },
): Promise<AgreementLeadResult> {
  const reason = await assertPersistedMigrationAdmin(
    transaction,
    input.actor,
    input.reason,
  );
  const agreement = await transaction.agreement.findUnique({
    where: { id: input.agreementId },
  });
  if (!agreement) {
    throw new LeadDomainError("NOT_FOUND", "Agreement not found");
  }
  const [lead, agreementClient] = await Promise.all([
    transaction.contactSubmission.findUnique({
      where: { id: input.leadId },
      include: { assignees: { select: { id: true } } },
    }),
    agreement.clientId
      ? transaction.client.findUnique({
          where: { id: agreement.clientId },
          select: { phone: true, email: true },
        })
      : null,
  ]);
  if (!lead) throw new LeadDomainError("NOT_FOUND", "Lead not found");
  if (agreement.leadId && agreement.leadId !== lead.id) {
    throw new LeadDomainError(
      "CONFLICT",
      "Agreement is already linked to another lead",
    );
  }

  const compatibleEvidence = hasAnyMatchingContactIdentity(
    [agreement, agreementClient],
    [lead],
  );
  if (!compatibleEvidence) {
    throw new LeadDomainError(
      "CONFLICT",
      "Agreement and lead lack compatible contact or client evidence",
    );
  }

  if (isActiveAgreementStatus(agreement.status)) {
    const collision = await transaction.agreement.findFirst({
      where: {
        leadId: lead.id,
        id: { not: agreement.id },
        status: { in: ["DRAFT", "SENT", "SIGNED"] },
      },
      select: { id: true },
    });
    if (collision) {
      throw new LeadDomainError(
        "CONFLICT",
        "Link would create an active agreement collision",
      );
    }
  }

  if (agreement.leadId !== lead.id) {
    await transaction.agreement.update({
      where: { id: agreement.id },
      data: { leadId: lead.id },
    });
  }
  await appendLeadEventOnce(transaction, {
    leadId: lead.id,
    type: "MIGRATED",
    actor: userActor(input.actor),
    fromStage: lead.stage,
    toStage: lead.stage,
    dedupeKey: `lead:${lead.id}:migration-agreement-link:${agreement.id}`,
    metadata: {
      agreementId: agreement.id,
      reason,
    },
  });

  const verifiedPayment = verifiedFirstPaymentEvidence(agreement);
  if (verifiedPayment) {
    return applyPaymentSuccess(transaction, {
      agreementId: agreement.id,
      providerAttemptId: verifiedPayment.lowProfileId,
      providerReturnValue: agreement.id,
      providerTransactionId: verifiedPayment.providerTransactionId,
      paidAt: verifiedPayment.paidAt,
      paidAmount: verifiedPayment.paidAmount,
      verifiedAt: verifiedPayment.verifiedAt,
      actor: { type: "INTEGRATION" },
    });
  }

  if (agreement.paymentStatus === "COMPLETED" || agreement.paidAt) {
    const reviewReason = [
      ...new Set(
        [
          ...(lead.migrationReviewReason?.split(",") ?? []),
          "UNVERIFIED_FIRST_PAYMENT",
        ].filter(Boolean),
      ),
    ].join(",");
    await transaction.contactSubmission.update({
      where: { id: lead.id },
      data: {
        migrationReviewRequired: true,
        migrationReviewReason: reviewReason,
      },
    });
  }

  return {
    agreementId: agreement.id,
    leadId: lead.id,
    stage: lead.stage,
    effects: [],
  };
}

export async function cancelDuplicateAgreementForMigrationInTransaction(
  transaction: Prisma.TransactionClient,
  input: {
    agreementId: string;
    retainedAgreementId: string;
    reason: string;
    actor: AuthenticatedLeadActor;
  },
): Promise<Agreement> {
  const reason = await assertPersistedMigrationAdmin(
    transaction,
    input.actor,
    input.reason,
  );
  if (input.agreementId === input.retainedAgreementId) {
    throw new LeadDomainError(
      "VALIDATION",
      "Duplicate and retained agreement IDs must differ",
    );
  }
  const [duplicate, retained] = await Promise.all([
    transaction.agreement.findUnique({ where: { id: input.agreementId } }),
    transaction.agreement.findUnique({
      where: { id: input.retainedAgreementId },
    }),
  ]);
  if (!duplicate || !retained) {
    throw new LeadDomainError("NOT_FOUND", "Agreement not found");
  }
  if (!isActiveAgreementStatus(retained.status)) {
    throw new LeadDomainError(
      "CONFLICT",
      "Retained agreement must be an active record",
    );
  }
  if (
    duplicate.leadId &&
    retained.leadId &&
    duplicate.leadId !== retained.leadId
  ) {
    throw new LeadDomainError(
      "CONFLICT",
      "Duplicate and retained agreements do not share a lead",
    );
  }
  const shareLead =
    duplicate.leadId !== null && duplicate.leadId === retained.leadId;
  if (!shareLead) {
    const [duplicateClient, retainedClient] = await Promise.all([
      duplicate.clientId
        ? transaction.client.findUnique({
            where: { id: duplicate.clientId },
            select: { phone: true, email: true },
          })
        : null,
      retained.clientId
        ? transaction.client.findUnique({
            where: { id: retained.clientId },
            select: { phone: true, email: true },
          })
        : null,
    ]);
    const shareClient = Boolean(
      duplicate.clientId && duplicate.clientId === retained.clientId,
    );
    const shareContact = hasAnyMatchingContactIdentity(
      [duplicate, duplicateClient],
      [retained, retainedClient],
    );
    if (!shareClient && !shareContact) {
      throw new LeadDomainError(
        "CONFLICT",
        "Unlinked duplicate and retained agreements lack shared contact or client identity",
      );
    }
  }
  if (duplicate.paymentStatus === "COMPLETED" || duplicate.paidAt) {
    throw new LeadDomainError(
      "CONFLICT",
      "A paid agreement cannot be cancelled as a duplicate",
    );
  }
  if (duplicate.status === "CANCELLED") return duplicate;
  if (!isActiveAgreementStatus(duplicate.status)) {
    throw new LeadDomainError(
      "CONFLICT",
      "Only an active unpaid duplicate agreement may be cancelled",
    );
  }

  const cancelled = await transaction.agreement.update({
    where: { id: duplicate.id },
    data: { status: "CANCELLED" },
  });
  const leadId = duplicate.leadId ?? retained.leadId;
  if (leadId) {
    const lead = await transaction.contactSubmission.findUnique({
      where: { id: leadId },
      select: { stage: true },
    });
    if (lead) {
      await appendLeadEventOnce(transaction, {
        leadId,
        type: "MIGRATED",
        actor: userActor(input.actor),
        fromStage: lead.stage,
        toStage: lead.stage,
        dedupeKey: `lead:${leadId}:migration-agreement-duplicate:${duplicate.id}:${retained.id}`,
        metadata: {
          cancelledAgreementId: duplicate.id,
          retainedAgreementId: retained.id,
          reason,
        },
      });
    }
  }
  return cancelled;
}

export async function linkHistoricalCommissionInTransaction(
  transaction: Prisma.TransactionClient,
  input: {
    commissionId: string;
    agreementId: string;
    reason: string;
    actor: AuthenticatedLeadActor;
  },
) {
  const reason = await assertPersistedMigrationAdmin(
    transaction,
    input.actor,
    input.reason,
  );
  const commission = await transaction.sellerCommission.findUnique({
    where: { id: input.commissionId },
  });
  if (!commission) {
    throw new LeadDomainError("NOT_FOUND", "Commission not found");
  }
  if (
    commission.agreementLinkStatus === "LINKED" &&
    commission.agreementRefId === input.agreementId
  ) {
    return commission;
  }
  if (commission.agreementLinkStatus || commission.agreementRefId) {
    throw new LeadDomainError(
      "CONFLICT",
      "Commission already has a conflicting classification",
    );
  }
  const agreement = await transaction.agreement.findUnique({
    where: { id: input.agreementId },
    include: { lead: { select: { stage: true } } },
  });
  if (!agreement) {
    throw new LeadDomainError("NOT_FOUND", "Agreement not found");
  }
  if (!verifiedFirstPaymentEvidence(agreement)) {
    throw new LeadDomainError(
      "CONFLICT",
      "Target agreement has no verified first payment",
    );
  }
  // Attribution only — the creator of the row is not evidence of who earned
  // the commission, so createdBy is no longer accepted as a match here.
  const sellerMatches =
    resolveAgreementPartnerId(agreement) === commission.sellerId;
  const amountMatches =
    Number.isFinite(commission.amount) &&
    Number.isFinite(agreement.monthlyPrice) &&
    Math.abs(commission.amount - agreement.monthlyPrice) < 0.01;
  if (!sellerMatches || !amountMatches) {
    throw new LeadDomainError(
      "CONFLICT",
      "Commission seller or payment evidence does not match the agreement",
    );
  }
  const existingLink = await transaction.sellerCommission.findUnique({
    where: { agreementRefId: agreement.id },
  });
  if (existingLink && existingLink.id !== commission.id) {
    throw new LeadDomainError(
      "CONFLICT",
      "Agreement is already linked to another commission",
    );
  }

  const reviewedAt = new Date();
  const linked = await transaction.sellerCommission.update({
    where: { id: commission.id },
    data: {
      agreementRefId: agreement.id,
      agreementLinkStatus: "LINKED",
      agreementLinkReviewedAt: reviewedAt,
      agreementLinkReviewReason: reason,
      agreementLinkReviewedById: input.actor.userId,
    },
  });
  if (agreement.leadId) {
    await appendLeadEventOnce(transaction, {
      leadId: agreement.leadId,
      type: "MIGRATED",
      actor: userActor(input.actor),
      fromStage: agreement.lead?.stage ?? null,
      toStage: agreement.lead?.stage ?? null,
      occurredAt: reviewedAt,
      dedupeKey: `lead:${agreement.leadId}:migration-commission-link:${commission.id}:${agreement.id}`,
      metadata: {
        agreementId: agreement.id,
        commissionId: commission.id,
        reason,
      },
    });
  }
  return linked;
}

export async function classifyLegacyOrphanCommissionInTransaction(
  transaction: Prisma.TransactionClient,
  input: {
    commissionId: string;
    reason: string;
    actor: AuthenticatedLeadActor;
  },
) {
  const reason = await assertPersistedMigrationAdmin(
    transaction,
    input.actor,
    input.reason,
  );
  const commission = await transaction.sellerCommission.findUnique({
    where: { id: input.commissionId },
  });
  if (!commission) {
    throw new LeadDomainError("NOT_FOUND", "Commission not found");
  }
  const legacyAgreement = await transaction.agreement.findUnique({
    where: { id: commission.agreementId },
    select: { id: true },
  });
  if (legacyAgreement) {
    throw new LeadDomainError(
      "CONFLICT",
      "Legacy agreement still exists; commission is not an orphan",
    );
  }
  if (
    commission.agreementLinkStatus === "LEGACY_ORPHAN" &&
    commission.agreementRefId === null
  ) {
    return commission;
  }
  if (commission.agreementLinkStatus || commission.agreementRefId) {
    throw new LeadDomainError(
      "CONFLICT",
      "Commission already has a conflicting classification",
    );
  }
  return transaction.sellerCommission.update({
    where: { id: commission.id },
    data: {
      agreementRefId: null,
      agreementLinkStatus: "LEGACY_ORPHAN",
      agreementLinkReviewedAt: new Date(),
      agreementLinkReviewReason: reason,
      agreementLinkReviewedById: input.actor.userId,
    },
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
