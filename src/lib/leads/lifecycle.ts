import {
  type ContactSubmission,
  type LeadEventType,
  type LeadPhoneProvenance,
  type LeadStage,
  Prisma,
} from "@prisma/client";

import {
  createNotification,
  type CreateNotificationInput,
} from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { hashSuppressionValue } from "@/lib/prospecting/suppression";

import {
  assertActorCanMutateLead,
  assertCommercialLeadReady,
  canSellerReadLead,
} from "./authorization";
import { LeadDomainError } from "./errors";
import { appendLeadEvent, appendLeadEventOnce } from "./events";
import { legacyLeadStateHash } from "./legacy-compat";
import { assertLeadStageTransition, legacyStatusForStage } from "./stage-machine";
import {
  intentForSource,
  isLeadSourceKey,
  validateSourceSnapshot,
} from "./source";
import { leadActionUrlFor, sellerLeadActionUrl } from "./action-url";
import type {
  AuthenticatedLeadActor,
  ClaimLeadInput,
  CreateLeadFromSourceInput,
  LeadActor,
  LeadRecord,
  OwnershipMutationInput,
  TransitionLeadStageInput,
} from "./types";

const terminalStages: readonly LeadStage[] = ["WON", "LOST", "SPAM"];
const actionableNotificationTypes = [
  "CONTACT_RECEIVED",
  "LEAD_FOLLOWUP",
  "LEAD_SLA_BREACH",
  "LEAD_SLA_ESCALATION",
] as const;

export interface LeadLifecycleStore {
  transaction<T>(
    callback: (transaction: Prisma.TransactionClient) => Promise<T>,
    options?: { isolationLevel?: "Serializable" },
  ): Promise<T>;
  findLead(leadId: string): Promise<LeadRecord | null>;
}

const prismaLifecycleStore: LeadLifecycleStore = {
  transaction: (callback) =>
    prisma.$transaction(callback, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }),
  findLead: (leadId) =>
    prisma.contactSubmission.findUnique({ where: { id: leadId } }),
};

export interface LeadPostCommitEffect {
  kind: "NOTIFICATION";
  input: CreateNotificationInput;
}

export interface LeadCreationStore extends LeadLifecycleStore {
  suppressionHashSecret?: string;
  runEffect?(effect: LeadPostCommitEffect): Promise<void>;
}

export function legacySourceMirror(sourceKey: string): {
  source: string;
  acquisitionChannel:
    | "META"
    | "WEBSITE"
    | "GOOGLE_PROSPECTING"
    | "MANUAL"
    | "OTHER";
} {
  switch (sourceKey) {
    case "google_maps":
      return {
        source: "GOOGLE_PROSPECTING",
        acquisitionChannel: "GOOGLE_PROSPECTING",
      };
    case "meta_lead_ads":
      return { source: "FACEBOOK", acquisitionChannel: "META" };
    case "website":
      return { source: "WEBSITE", acquisitionChannel: "WEBSITE" };
    case "google_search_ads":
      return { source: "GOOGLE_SEARCH_ADS", acquisitionChannel: "OTHER" };
    case "manual_outbound":
      return { source: "MANUAL_OUTBOUND", acquisitionChannel: "MANUAL" };
    case "direct_contact":
      return { source: "DIRECT_CONTACT", acquisitionChannel: "MANUAL" };
    default:
      throw new LeadDomainError("VALIDATION", `Unknown lead source: ${sourceKey}`);
  }
}

export function legacyAttributionForSource(
  sourceKey: string,
  snapshot: Record<string, unknown>,
): {
  externalFormId: string | null;
  externalFormName: string | null;
  externalCampaignId: string | null;
  externalAdId: string | null;
} {
  if (sourceKey !== "meta_lead_ads") {
    return {
      externalFormId: null,
      externalFormName: null,
      externalCampaignId: null,
      externalAdId: null,
    };
  }
  return {
    externalFormId:
      typeof snapshot.formId === "string" ? snapshot.formId : null,
    externalFormName:
      typeof snapshot.formName === "string" ? snapshot.formName : null,
    externalCampaignId:
      typeof snapshot.campaignId === "string" ? snapshot.campaignId : null,
    externalAdId: typeof snapshot.adId === "string" ? snapshot.adId : null,
  };
}

export function legacyHashForLead(
  lead: {
    status: ContactSubmission["status"];
    source: string | null;
    acquisitionChannel: ContactSubmission["acquisitionChannel"];
    externalLeadId: string | null;
    externalFormId: string | null;
    externalFormName: string | null;
    externalCampaignId: string | null;
    externalAdId: string | null;
    nextFollowUpAt: Date | null;
    lastContactedAt: Date | null;
    closedAt: Date | null;
  },
  assigneeIds: readonly string[],
  overrides: Partial<{
    status: ContactSubmission["status"];
    source: string | null;
    acquisitionChannel: ContactSubmission["acquisitionChannel"];
    externalLeadId: string | null;
    externalFormId: string | null;
    externalFormName: string | null;
    externalCampaignId: string | null;
    externalAdId: string | null;
    nextFollowUpAt: Date | null;
    lastContactedAt: Date | null;
    closedAt: Date | null;
  }> = {},
): string {
  return legacyLeadStateHash({
    status: overrides.status ?? lead.status,
    assigneeIds,
    source:
      overrides.source === undefined ? lead.source : overrides.source,
    acquisitionChannel:
      overrides.acquisitionChannel === undefined
        ? lead.acquisitionChannel
        : overrides.acquisitionChannel,
    externalLeadId:
      overrides.externalLeadId === undefined
        ? lead.externalLeadId
        : overrides.externalLeadId,
    externalFormId:
      overrides.externalFormId === undefined
        ? lead.externalFormId
        : overrides.externalFormId,
    externalFormName:
      overrides.externalFormName === undefined
        ? lead.externalFormName
        : overrides.externalFormName,
    externalCampaignId:
      overrides.externalCampaignId === undefined
        ? lead.externalCampaignId
        : overrides.externalCampaignId,
    externalAdId:
      overrides.externalAdId === undefined
        ? lead.externalAdId
        : overrides.externalAdId,
    nextFollowUpAt:
      overrides.nextFollowUpAt === undefined
        ? lead.nextFollowUpAt
        : overrides.nextFollowUpAt,
    lastContactedAt:
      overrides.lastContactedAt === undefined
        ? lead.lastContactedAt
        : overrides.lastContactedAt,
    closedAt:
      overrides.closedAt === undefined ? lead.closedAt : overrides.closedAt,
  });
}

function userActor(actor: AuthenticatedLeadActor): LeadActor {
  return { type: "USER", userId: actor.userId, role: actor.role };
}

function transitionActor(actor: TransitionLeadStageInput["actor"]): LeadActor {
  if ("type" in actor) return actor;
  return userActor(actor);
}

function isRetryableTransactionError(error: unknown): boolean {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  ) {
    return true;
  }
  return (
    error instanceof Error &&
    /serialization|deadlock|write conflict/i.test(error.message)
  );
}

export async function claimLeadInTransaction(
  transaction: Prisma.TransactionClient,
  input: ClaimLeadInput,
): Promise<LeadRecord> {
  const seller = await transaction.user.findUnique({
    where: { id: input.sellerId },
    select: { role: true },
  });
  if (seller?.role !== "SELLER") {
    throw new LeadDomainError(
      "FORBIDDEN",
      "Current user no longer has the seller role",
    );
  }

  const existing = await transaction.contactSubmission.findUnique({
    where: { id: input.leadId },
    include: { assignees: { select: { id: true } } },
  });
  if (!existing) throw new LeadDomainError("NOT_FOUND", "Lead not found");
  assertCommercialLeadReady(existing);
  if (existing.doNotContactAt) {
    throw new LeadDomainError("FORBIDDEN", "Lead may not be contacted");
  }
  if (terminalStages.includes(existing.stage)) {
    throw new LeadDomainError("CONFLICT", "Terminal lead cannot be claimed");
  }
  if (existing.ownerId === input.sellerId) return existing;
  if (existing.ownerId || existing.eligibleSellerId !== input.sellerId) {
    throw new LeadDomainError(
      "CONFLICT",
      "Lead is not eligible or was already claimed",
    );
  }

  const fromStage = existing.stage;
  const intentLevel = existing.intentLevel;
  const now = new Date();
  const targetStage: LeadStage =
    fromStage === "NEW"
      ? intentLevel === "OUTBOUND"
        ? "PREPARING"
        : "CONTACTING"
      : fromStage;
  const status = legacyStatusForStage(targetStage);
  const legacyStateHash = legacyHashForLead(existing, [input.sellerId], { status });
  const guarded = await transaction.contactSubmission.updateMany({
    where: {
      id: input.leadId,
      ownerId: null,
      eligibleSellerId: input.sellerId,
      migrationReviewRequired: false,
      doNotContactAt: null,
      stage: fromStage,
    },
    data: {
      ownerId: input.sellerId,
      ownerAssignedAt: now,
      firstClaimedAt: existing.firstClaimedAt ?? now,
      stage: targetStage,
      status,
      legacyStateHash,
    },
  });

  if (guarded.count !== 1) {
    const raced = await transaction.contactSubmission.findUnique({
      where: { id: input.leadId },
      include: { assignees: { select: { id: true } } },
    });
    if (
      raced &&
      !raced.migrationReviewRequired &&
      raced.ownerId === input.sellerId
    ) {
      return raced;
    }
    throw new LeadDomainError("CONFLICT", "Lead was already claimed");
  }

  const claimed = await transaction.contactSubmission.update({
    where: { id: input.leadId },
    data: { assignees: { set: [{ id: input.sellerId }] } },
  });
  const dedupeBase = `lead:${input.leadId}:claim:${input.sellerId}:${now.toISOString()}`;
  await appendLeadEventOnce(transaction, {
    leadId: input.leadId,
    type: "CLAIMED",
    actor: { type: "USER", userId: input.sellerId, role: "SELLER" },
    fromStage,
    toStage: targetStage,
    occurredAt: now,
    dedupeKey: dedupeBase,
  });
  if (
    fromStage === "NEW" &&
    intentLevel === "OUTBOUND" &&
    targetStage === "PREPARING"
  ) {
    await appendLeadEventOnce(transaction, {
      leadId: input.leadId,
      type: "PREPARATION_STARTED",
      actor: { type: "USER", userId: input.sellerId, role: "SELLER" },
      fromStage: "NEW",
      toStage: "PREPARING",
      occurredAt: now,
      dedupeKey: `${dedupeBase}:preparation`,
    });
  }
  await transaction.notification.updateMany({
    where: {
      recipientId: input.sellerId,
      leadId: input.leadId,
      readAt: null,
      type: { in: [...actionableNotificationTypes] },
    },
    data: { readAt: now },
  });
  return claimed;
}

export async function claimLead(
  input: ClaimLeadInput,
  dependencies: { store?: LeadLifecycleStore } = {},
): Promise<LeadRecord> {
  const store = dependencies.store ?? prismaLifecycleStore;
  let lastRetryableError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await store.transaction(
        (transaction) => claimLeadInTransaction(transaction, input),
        { isolationLevel: "Serializable" },
      );
    } catch (error) {
      if (!isRetryableTransactionError(error)) throw error;
      lastRetryableError = error;
    }
  }

  // A read outside the Serializable claim transaction cannot prove that the
  // seller still has the persisted SELLER role. Never turn exhausted retries
  // into an apparent success from an unguarded owner snapshot.
  throw lastRetryableError ?? new LeadDomainError("CONFLICT", "Claim retry failed");
}

export async function releaseOrReassignLead(
  input: OwnershipMutationInput,
  dependencies: {
    store?: LeadLifecycleStore;
    notify?: (input: CreateNotificationInput) => Promise<void>;
  } = {},
): Promise<LeadRecord> {
  const store = dependencies.store ?? prismaLifecycleStore;
  const result = await store.transaction(async (transaction) => {
    const persistedActor = await transaction.user.findUnique({
      where: { id: input.actor.userId },
      select: { role: true },
    });
    if (!persistedActor || persistedActor.role !== "ADMIN") {
      throw new LeadDomainError("FORBIDDEN", "Admin role is required");
    }

    const existing = await transaction.contactSubmission.findUnique({
      where: { id: input.leadId },
      include: { assignees: { select: { id: true } } },
    });
    if (!existing) throw new LeadDomainError("NOT_FOUND", "Lead not found");
    assertCommercialLeadReady(existing);
    if (terminalStages.includes(existing.stage)) {
      throw new LeadDomainError(
        "CONFLICT",
        "Terminal lead ownership cannot be changed",
      );
    }

    const activeFollowUps = await transaction.leadFollowUp.findMany({
      where: { leadId: input.leadId, status: "SCHEDULED" },
      select: { id: true, ownerId: true, reminderSentAt: true },
    });
    if (
      input.action === "RELEASE" &&
      activeFollowUps.length > 0 &&
      !input.cancelFollowUps
    ) {
      throw new LeadDomainError(
        "CONFLICT",
        "Active follow-up must be cancelled before release",
      );
    }

    let newOwnerId: string | null;
    let eligibleSellerId: string | null;
    let reassignTargetRole: "SELLER" | "ADMIN" | null = null;
    if (input.action === "REASSIGN") {
      const owner = await transaction.user.findUnique({
        where: { id: input.sellerId },
        select: { role: true },
      });
      // An ADMIN (אלעד/רועי) may own a lead too — "מי לקח" is any team
      // member, not only the salesperson. Commission stays seller-only
      // downstream (creditedSellerId requires a current SELLER), so an
      // admin-owned deal simply earns no commission.
      if (!owner || (owner.role !== "SELLER" && owner.role !== "ADMIN")) {
        throw new LeadDomainError("VALIDATION", "Target owner is invalid");
      }
      reassignTargetRole = owner.role;
      newOwnerId = input.sellerId;
      eligibleSellerId = owner.role === "SELLER" ? input.sellerId : existing.eligibleSellerId;
    } else {
      newOwnerId = null;
      eligibleSellerId =
        input.replacementEligibleSellerId ?? existing.eligibleSellerId;
      if (input.replacementEligibleSellerId) {
        const replacement = await transaction.user.findUnique({
          where: { id: input.replacementEligibleSellerId },
          select: { role: true },
        });
        if (!replacement || replacement.role !== "SELLER") {
          throw new LeadDomainError(
            "VALIDATION",
            "Replacement eligible seller is invalid",
          );
        }
      }
    }

    const now = new Date();
    if (input.action === "REASSIGN" && activeFollowUps.length > 0) {
      await transaction.leadFollowUp.updateMany({
        where: { leadId: input.leadId, status: "SCHEDULED" },
        data: { ownerId: input.sellerId, reminderSentAt: null },
      });
    } else if (
      input.action === "RELEASE" &&
      input.cancelFollowUps &&
      activeFollowUps.length > 0
    ) {
      await transaction.leadFollowUp.updateMany({
        where: { leadId: input.leadId, status: "SCHEDULED" },
        data: { status: "CANCELLED", cancelledAt: now },
      });
    }

    if (existing.ownerId) {
      await transaction.notification.updateMany({
        where: {
          recipientId: existing.ownerId,
          leadId: input.leadId,
          readAt: null,
          type: { in: [...actionableNotificationTypes] },
        },
        data: { readAt: now },
      });
    }

    // Taking a fresh lead advances it exactly like a seller claim would:
    // NEW → PREPARING for cold, NEW → CONTACTING for warm, with
    // firstClaimedAt stamped. Without this an admin-owned lead was stuck at
    // NEW forever — no interaction path, no agreement eligibility.
    const claimStage =
      input.action === "REASSIGN" && existing.stage === "NEW"
        ? existing.intentLevel === "OUTBOUND"
          ? ("PREPARING" as const)
          : ("CONTACTING" as const)
        : null;
    const assigneeIds = newOwnerId ? [newOwnerId] : [];
    const legacyStateHash = legacyHashForLead(existing, assigneeIds);
    const updated = await transaction.contactSubmission.update({
      where: { id: input.leadId },
      data: {
        ownerId: newOwnerId,
        eligibleSellerId,
        ownerAssignedAt: newOwnerId ? now : null,
        assignees: { set: assigneeIds.map((id) => ({ id })) },
        legacyStateHash,
        ...(claimStage
          ? {
              stage: claimStage,
              firstClaimedAt: existing.firstClaimedAt ?? now,
            }
          : {}),
      },
    });
    await appendLeadEvent(transaction, {
      leadId: input.leadId,
      type: input.action === "REASSIGN" ? "REASSIGNED" : "RELEASED",
      actor: userActor(input.actor),
      fromStage: existing.stage,
      toStage: claimStage ?? existing.stage,
      occurredAt: now,
      metadata: {
        reason: input.reason,
        previousOwnerId: existing.ownerId,
        ownerId: newOwnerId,
        eligibleSellerId,
      },
    });
    if (claimStage) {
      await appendLeadEvent(transaction, {
        leadId: input.leadId,
        type: claimStage === "PREPARING" ? "PREPARATION_STARTED" : "CLAIMED",
        actor: userActor(input.actor),
        fromStage: existing.stage,
        toStage: claimStage,
        occurredAt: now,
        metadata: { via: "OWNERSHIP_REASSIGN" },
      });
    }

    return {
      lead: updated,
      effect:
        input.action === "REASSIGN"
          ? ({
              recipientId: input.sellerId,
              type: "LEAD_REASSIGNED",
              title: "ליד הועבר אליך",
              body: "הליד ממתין לטיפול שלך",
              leadId: input.leadId,
              // An admin owner works the lead in the admin workspace, not
              // the seller area (which their role cannot even open).
              url:
                reassignTargetRole === "ADMIN"
                  ? leadActionUrlFor({ audience: "ADMIN", lead: existing })
                  : sellerLeadActionUrl(existing),
              dedupeKey: `${input.sellerId}:lead-reassigned:${input.leadId}:${now.toISOString()}`,
            } satisfies CreateNotificationInput)
          : null,
    };
  });

  if (result.effect) {
    const notify =
      dependencies.notify ??
      (async (notificationInput: CreateNotificationInput) => {
        await createNotification(notificationInput);
      });
    await notify(result.effect);
  }
  return result.lead;
}

function eventTypeForTransition(
  fromStage: LeadStage,
  toStage: LeadStage,
): LeadEventType {
  if (fromStage === "LOST" && toStage === "CONTACTING") return "REOPENED";
  switch (toStage) {
    case "PREPARING":
      return "PREPARATION_STARTED";
    case "CONTACTING":
      return "CONTACT_ATTEMPTED";
    case "QUALIFIED":
      return "QUALIFIED";
    case "AGREEMENT_DRAFT":
      return "AGREEMENT_CREATED";
    case "AGREEMENT_SENT":
      return "AGREEMENT_SENT";
    case "AGREEMENT_SIGNED":
      return "AGREEMENT_SIGNED";
    case "WON":
      return "WON";
    case "LOST":
      return "LOST";
    case "SPAM":
      return "SPAM_MARKED";
    case "NEW":
      throw new LeadDomainError(
        "INVALID_TRANSITION",
        "No transition may return a lead to NEW",
      );
  }
}

export async function transitionLeadStageInTransaction(
  transaction: Prisma.TransactionClient,
  input: TransitionLeadStageInput,
): Promise<LeadRecord> {
  const existing = await transaction.contactSubmission.findUnique({
      where: { id: input.leadId },
      include: { assignees: { select: { id: true } } },
    });
    if (!existing) throw new LeadDomainError("NOT_FOUND", "Lead not found");
    assertCommercialLeadReady(existing);

    const actor = transitionActor(input.actor);
    assertLeadStageTransition(existing.stage, input.toStage, {
      actorType: actor.type,
      actorRole: actor.role ?? null,
      intentLevel: existing.intentLevel,
    });
    if (input.toStage === "LOST" && !input.lossReason) {
      throw new LeadDomainError(
        "VALIDATION",
        "A structured loss reason is required",
      );
    }
    if (
      input.toStage === "LOST" &&
      input.lossReason === "OTHER" &&
      !input.lossReasonDetails?.trim()
    ) {
      throw new LeadDomainError("VALIDATION", "Loss details are required");
    }
    if (
      existing.stage === "LOST" &&
      input.toStage === "CONTACTING" &&
      !input.reason?.trim()
    ) {
      throw new LeadDomainError(
        "VALIDATION",
        "An admin reopen reason is required",
      );
    }

    const now = actor.occurredAt ?? new Date();
    const status = legacyStatusForStage(input.toStage);
    const reopening =
      existing.stage === "LOST" && input.toStage === "CONTACTING";
    const terminalTransition = terminalStages.includes(input.toStage);
    const activeFollowUp = terminalTransition
      ? await transaction.leadFollowUp.findFirst({
          where: { leadId: input.leadId, status: "SCHEDULED" },
          select: { id: true },
        })
      : null;
    if (activeFollowUp) {
      await transaction.leadFollowUp.updateMany({
        where: { leadId: input.leadId, status: "SCHEDULED" },
        data: { status: "CANCELLED", cancelledAt: now },
      });
    }
    const closedAt = input.toStage === "WON" ? now : null;
    const nextFollowUpAt = terminalTransition
      ? null
      : existing.nextFollowUpAt;
    const data: Prisma.ContactSubmissionUpdateInput = {
      stage: input.toStage,
      status,
      closedAt,
      nextFollowUpAt,
      legacyStateHash: legacyHashForLead(
        existing,
        existing.assignees.map(({ id }) => id),
        { status, closedAt, nextFollowUpAt },
      ),
    };
    if (input.toStage === "QUALIFIED") data.qualifiedAt = now;
    if (input.toStage === "WON") data.wonAt = now;
    if (input.toStage === "LOST") {
      data.lostAt = now;
      data.lossReason = input.lossReason;
      data.lossReasonDetails = input.lossReasonDetails?.trim() || null;
    }
    if (reopening) {
      data.lostAt = null;
      data.lossReason = null;
      data.lossReasonDetails = null;
    }

    const updated = await transaction.contactSubmission.update({
      where: { id: input.leadId },
      data,
    });
    await appendLeadEvent(transaction, {
      leadId: input.leadId,
      type: eventTypeForTransition(existing.stage, input.toStage),
      actor,
      fromStage: existing.stage,
      toStage: input.toStage,
      occurredAt: now,
      metadata: {
        ...(input.reason ? { reason: input.reason.trim() } : {}),
        ...(input.lossReason ? { lossReason: input.lossReason } : {}),
        ...(input.lossReasonDetails
          ? { lossReasonDetails: input.lossReasonDetails.trim() }
          : {}),
        ...(activeFollowUp
          ? { cancelledFollowUpId: activeFollowUp.id }
          : {}),
      },
    });
  return updated;
}

export async function transitionLeadStage(
  input: TransitionLeadStageInput,
  dependencies: { store?: LeadLifecycleStore } = {},
): Promise<LeadRecord> {
  const store = dependencies.store ?? prismaLifecycleStore;
  return store.transaction((transaction) =>
    transitionLeadStageInTransaction(transaction, input),
  );
}

export async function qualifyLeadFromLegacyClosed(
  input: {
    leadId: string;
    actor: AuthenticatedLeadActor;
  },
  dependencies: { store?: LeadLifecycleStore } = {},
): Promise<LeadRecord> {
  const store = dependencies.store ?? prismaLifecycleStore;
  return store.transaction(async (transaction) => {
    const existing = await transaction.contactSubmission.findUnique({
      where: { id: input.leadId },
      include: { assignees: { select: { id: true } } },
    });
    if (!existing) throw new LeadDomainError("NOT_FOUND", "Lead not found");
    if (input.actor.role !== "SELLER") {
      throw new LeadDomainError(
        "FORBIDDEN",
        "Legacy CLOSED requires the current seller owner",
      );
    }
    await assertActorCanMutateLead(transaction, input.actor, existing);
    if (
      existing.stage === "QUALIFIED" ||
      existing.stage === "AGREEMENT_DRAFT" ||
      existing.stage === "AGREEMENT_SENT" ||
      existing.stage === "AGREEMENT_SIGNED"
    ) {
      return existing;
    }
    if (existing.stage !== "CONTACTING") {
      throw new LeadDomainError(
        "CONFLICT",
        "Legacy CLOSED is valid only for an owned contacting lead",
      );
    }

    const occurredAt = new Date();
    const status = legacyStatusForStage("QUALIFIED");
    const updated = await transaction.contactSubmission.update({
      where: { id: input.leadId },
      data: {
        stage: "QUALIFIED",
        status,
        qualifiedAt: existing.qualifiedAt ?? occurredAt,
        legacyStateHash: legacyHashForLead(
          existing,
          existing.assignees.map(({ id }) => id),
          { status },
        ),
      },
    });
    await appendLeadEventOnce(transaction, {
      leadId: input.leadId,
      type: "QUALIFIED",
      actor: userActor(input.actor),
      fromStage: "CONTACTING",
      toStage: "QUALIFIED",
      occurredAt,
      dedupeKey: `lead:${input.leadId}:legacy-closed-qualified`,
      metadata: { legacyRequestedClosed: true },
    });
    return updated;
  });
}

export async function markLeadRead(
  input: {
    leadId: string;
    isRead: boolean;
    actor: AuthenticatedLeadActor;
  },
  dependencies: { store?: LeadLifecycleStore } = {},
): Promise<LeadRecord> {
  const store = dependencies.store ?? prismaLifecycleStore;
  return store.transaction(async (transaction) => {
    const existing = await transaction.contactSubmission.findUnique({
      where: { id: input.leadId },
    });
    if (!existing) throw new LeadDomainError("NOT_FOUND", "Lead not found");
    if (
      input.actor.role === "SELLER" &&
      !canSellerReadLead(input.actor.userId, existing)
    ) {
      throw new LeadDomainError("FORBIDDEN", "Lead is outside seller scope");
    }
    if (input.actor.role === "ADMIN") {
      const actor = await transaction.user.findUnique({
        where: { id: input.actor.userId },
        select: { role: true },
      });
      if (actor?.role !== "ADMIN") {
        throw new LeadDomainError("FORBIDDEN", "Admin role is required");
      }
    }
    return transaction.contactSubmission.update({
      where: { id: input.leadId },
      data: { isRead: input.isRead },
    });
  });
}

export async function markLeadsRead(
  input: {
    leadIds: string[];
    isRead: boolean;
    actor: AuthenticatedLeadActor;
  },
  dependencies: { store?: LeadLifecycleStore } = {},
): Promise<{ count: number }> {
  if (input.actor.role !== "ADMIN") {
    throw new LeadDomainError("FORBIDDEN", "Admin role is required");
  }
  const store = dependencies.store ?? prismaLifecycleStore;
  return store.transaction(async (transaction) => {
    const actor = await transaction.user.findUnique({
      where: { id: input.actor.userId },
      select: { role: true },
    });
    if (actor?.role !== "ADMIN") {
      throw new LeadDomainError("FORBIDDEN", "Admin role is required");
    }
    return transaction.contactSubmission.updateMany({
      where: { id: { in: input.leadIds } },
      data: { isRead: input.isRead },
    });
  });
}

export async function markLeadSlaAlertedInTransaction(
  transaction: Prisma.TransactionClient,
  input: {
    leadId: string;
    eligibleSellerId: string;
    alertedAt: Date;
  },
): Promise<boolean> {
  const marked = await transaction.contactSubmission.updateMany({
    where: {
      id: input.leadId,
      stage: "NEW",
      ownerId: null,
      eligibleSellerId: input.eligibleSellerId,
      migrationReviewRequired: false,
      slaAlertedAt: null,
    },
    data: { slaAlertedAt: input.alertedAt },
  });
  return marked.count === 1;
}

export async function markLeadSlaEscalatedInTransaction(
  transaction: Prisma.TransactionClient,
  input: {
    leadId: string;
    eligibleSellerId: string;
    escalatedAt: Date;
  },
): Promise<boolean> {
  const marked = await transaction.contactSubmission.updateMany({
    where: {
      id: input.leadId,
      stage: "NEW",
      ownerId: null,
      eligibleSellerId: input.eligibleSellerId,
      migrationReviewRequired: false,
      slaEscalatedAt: null,
    },
    data: { slaEscalatedAt: input.escalatedAt },
  });
  return marked.count === 1;
}

export async function createLeadInTransaction(
  transaction: Prisma.TransactionClient,
  input: CreateLeadFromSourceInput,
  options: { suppressionHashSecret?: string } = {},
): Promise<{ lead: LeadRecord; effects: LeadPostCommitEffect[] }> {
  if (!isLeadSourceKey(input.sourceKey)) {
    throw new LeadDomainError(
      "VALIDATION",
      `Unknown lead source: ${input.sourceKey}`,
    );
  }
  const expectedIntent = intentForSource(input.sourceKey);
  if (input.intentLevel !== expectedIntent) {
    throw new LeadDomainError(
      "CONFLICT",
      "Lead intent does not match its immutable source",
    );
  }
  const sourceSnapshot = validateSourceSnapshot(
    input.sourceKey,
    input.sourceSnapshot,
  );

  if (input.externalLeadId) {
    const existing = await transaction.contactSubmission.findUnique({
      where: {
        sourceKey_externalLeadId: {
          sourceKey: input.sourceKey,
          externalLeadId: input.externalLeadId,
        },
      },
    });
    if (existing) {
      if (existing.intentLevel && existing.intentLevel !== input.intentLevel) {
        throw new LeadDomainError(
          "CONFLICT",
          "Existing lead has different immutable intent",
        );
      }
      return {
        lead: await mergeMissingContactDetails(transaction, existing, input),
        effects: [],
      };
    }
  }

  const now = new Date();
  const occurredAt = input.occurredAt ?? now;
  const mirror = legacySourceMirror(input.sourceKey);
  const attribution = legacyAttributionForSource(
    input.sourceKey,
    sourceSnapshot,
  );
  const suppressionHashSecret =
    options.suppressionHashSecret ?? process.env.PROSPECTING_HASH_SECRET?.trim();
  const suppressionFilters: Array<
    { phoneHash: string } | { domainHash: string }
  > = [];
  if (suppressionHashSecret && input.phone?.trim()) {
    suppressionFilters.push({
      phoneHash: hashSuppressionValue(input.phone, suppressionHashSecret),
    });
  }
  const auditedDomain =
    input.sourceKey === "google_maps" &&
    typeof sourceSnapshot.auditedDomain === "string"
      ? sourceSnapshot.auditedDomain
      : null;
  if (suppressionHashSecret && auditedDomain) {
    suppressionFilters.push({
      domainHash: hashSuppressionValue(auditedDomain, suppressionHashSecret),
    });
  }
  const suppression =
    suppressionFilters.length > 0
      ? await transaction.prospectSuppression.findFirst({
          where: { OR: suppressionFilters },
          select: { id: true },
        })
      : null;
  const reviewReason: string | null =
    input.forcedReviewReason ??
    (input.eligibleSellerId
      ? suppression
        ? "PERMANENT_SUPPRESSION_MATCH"
        : null
      : "MISSING_ELIGIBLE_SELLER");
  const migrationReviewRequired = reviewReason !== null;
  const phoneProvenance: LeadPhoneProvenance | null =
    input.phone &&
    (input.sourceKey === "website" || input.sourceKey === "meta_lead_ads")
      ? "FIRST_PARTY_FORM"
      : null;
  const baseData = {
    name: input.name?.trim() || null,
    company: input.company?.trim() || null,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    message: input.message?.trim() || null,
    intentLevel: input.intentLevel,
    sourceKey: input.sourceKey,
    sourceSnapshot: sourceSnapshot as Prisma.InputJsonValue,
    externalLeadId: input.externalLeadId ?? null,
    phoneProvenance,
    stage: "NEW" as const,
    ownerId: null,
    eligibleSellerId: input.eligibleSellerId ?? null,
    migrationReviewRequired,
    migrationReviewReason: reviewReason,
    source: mirror.source,
    acquisitionChannel: mirror.acquisitionChannel,
    ...attribution,
    status: "NEW" as const,
    isRead: false,
    tags: [],
    createdAt: occurredAt,
    doNotContactAt: suppression ? now : null,
    slaAlertedAt: input.captureMode === "HISTORICAL_SYNC" ? now : null,
    slaEscalatedAt: input.captureMode === "HISTORICAL_SYNC" ? now : null,
  };
  const legacyStateHash = legacyLeadStateHash({
    status: "NEW",
    assigneeIds: [],
    source: mirror.source,
    acquisitionChannel: mirror.acquisitionChannel,
    externalLeadId: input.externalLeadId,
    ...attribution,
    nextFollowUpAt: null,
    lastContactedAt: null,
    closedAt: null,
  });

  let lead: LeadRecord;
  let created = true;
  if (input.externalLeadId) {
    const creation = await transaction.contactSubmission.createMany({
      data: { ...baseData, legacyStateHash },
      skipDuplicates: true,
    });
    created = creation.count === 1;
    const persisted = await transaction.contactSubmission.findUnique({
      where: {
        sourceKey_externalLeadId: {
          sourceKey: input.sourceKey,
          externalLeadId: input.externalLeadId,
        },
      },
    });
    if (!persisted) {
      throw new Error("Lead was not persisted after idempotent create");
    }
    lead = persisted;
  } else {
    lead = await transaction.contactSubmission.create({
      data: { ...baseData, legacyStateHash },
    });
  }

  await appendLeadEventOnce(transaction, {
    leadId: lead.id,
    type: "CREATED",
    actor: { type: "SYSTEM" },
    occurredAt,
    dedupeKey: `lead:${lead.id}:created`,
    metadata: { intentLevel: input.intentLevel, sourceKey: input.sourceKey },
  });

  const effects: LeadPostCommitEffect[] = [];
  if (created && migrationReviewRequired) {
    const admins = await transaction.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true },
    });
    for (const admin of admins) {
      effects.push({
        kind: "NOTIFICATION",
        input: {
          recipientId: admin.id,
          type: "CONTACT_RECEIVED",
          title: "ליד חדש דורש בדיקת מנהל",
          body: reviewReason ?? "נדרש אימות ידני",
          leadId: lead.id,
          dedupeKey: `${admin.id}:lead-review:${lead.id}:${reviewReason}`,
          url: leadActionUrlFor({ audience: "ADMIN", lead }),
        },
      });
    }
  }
  // Admins hear about every fresh WARM lead, like the pre-unified pipeline
  // did — the eligible-seller push below is IN ADDITION, not a replacement.
  // OUTBOUND (cold) leads are excluded on purpose: they arrive dozens at a
  // time from a prospecting batch, which already sends its own single
  // batch-published notification.
  if (
    created &&
    !migrationReviewRequired &&
    input.captureMode !== "HISTORICAL_SYNC" &&
    input.intentLevel !== "OUTBOUND"
  ) {
    const admins = await transaction.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true },
    });
    for (const admin of admins) {
      effects.push({
        kind: "NOTIFICATION",
        input: {
          recipientId: admin.id,
          type: "CONTACT_RECEIVED",
          title:
            input.sourceKey === "meta_lead_ads"
              ? "📘 ליד חדש מפייסבוק"
              : "🌐 ליד חדש מהאתר",
          body: lead.name ?? lead.company ?? undefined,
          leadId: lead.id,
          dedupeKey: `${admin.id}:lead-created:${lead.id}`,
          url: leadActionUrlFor({ audience: "ADMIN", lead }),
        },
      });
    }
  }
  if (
    created &&
    !migrationReviewRequired &&
    (input.notificationMode ?? "ELIGIBLE_SELLER") === "ELIGIBLE_SELLER" &&
    input.captureMode !== "HISTORICAL_SYNC" &&
    input.eligibleSellerId
  ) {
    effects.push({
      kind: "NOTIFICATION",
      input: {
        recipientId: input.eligibleSellerId,
        type: "CONTACT_RECEIVED",
        title:
          input.intentLevel === "INBOUND"
            ? "פנייה ישירה חדשה"
            : "ליד חדש ממתין לטיפול",
        leadId: lead.id,
        dedupeKey: `${input.eligibleSellerId}:lead-created:${lead.id}`,
        url: sellerLeadActionUrl(lead),
      },
    });
  }
  return { lead, effects };
}

export async function createLeadFromSource(
  input: CreateLeadFromSourceInput,
  dependencies: { store?: LeadCreationStore } = {},
): Promise<LeadRecord> {
  const store: LeadCreationStore =
    dependencies.store ?? prismaLifecycleStore;
  const result = await store.transaction((transaction) =>
    createLeadInTransaction(transaction, input, {
      suppressionHashSecret: store.suppressionHashSecret,
    }),
  );
  for (const effect of result.effects) {
    if (store.runEffect) {
      await store.runEffect(effect);
    } else {
      await createNotification(effect.input);
    }
  }
  return result.lead;
}

async function mergeMissingContactDetails(
  transaction: Prisma.TransactionClient,
  existing: LeadRecord,
  input: CreateLeadFromSourceInput,
): Promise<LeadRecord> {
  const candidates = {
    name: input.name,
    company: input.company,
    email: input.email,
    phone: input.phone,
    message: input.message,
  };
  const changedFields = (
    Object.keys(candidates) as Array<keyof typeof candidates>
  ).filter((field) => {
    const incoming = candidates[field]?.trim();
    const current = existing[field];
    return Boolean(incoming) && (current === null || current.trim() === "");
  });
  if (changedFields.length === 0) return existing;

  const data = Object.fromEntries(
    changedFields.map((field) => [field, candidates[field]!.trim()]),
  );
  const updated = await transaction.contactSubmission.update({
    where: { id: existing.id },
    data: {
      ...data,
      ...(changedFields.includes("phone") && !existing.phoneProvenance
        ? { phoneProvenance: "FIRST_PARTY_FORM" as const }
        : {}),
    },
  });
  await appendLeadEventOnce(transaction, {
    leadId: existing.id,
    type: "CONTACT_DETAILS_UPDATED",
    actor: { type: "SYSTEM" },
    dedupeKey: `lead:${existing.id}:ingestion-contact-merge:${changedFields.join(",")}`,
    metadata: { changedFields },
  });
  return updated;
}
