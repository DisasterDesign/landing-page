import { type LeadStage, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { assertCommercialLeadReady, assertSellerOwnsLead } from "./authorization";
import { LeadDomainError } from "./errors";
import { appendLeadEvent, appendLeadEventOnce } from "./events";
import {
  legacyHashForLead,
  legacySourceMirror,
  type LeadLifecycleStore,
} from "./lifecycle";
import { legacyStatusForStage } from "./stage-machine";
import {
  intentForSource,
  isLeadSourceKey,
  validateSourceSnapshot,
} from "./source";
import type {
  CorrectLeadSourceInput,
  ResolveLeadMigrationReviewInput,
  UpdateLeadContactDetailsInput,
} from "./types";

const correctionStore: LeadLifecycleStore = {
  transaction: (callback) =>
    prisma.$transaction(callback, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }),
  findLead: (leadId) =>
    prisma.contactSubmission.findUnique({ where: { id: leadId } }),
};

async function assertPersistedRole(
  transaction: Prisma.TransactionClient,
  userId: string,
  role: "ADMIN" | "SELLER",
): Promise<void> {
  const user = await transaction.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!user || user.role !== role) {
    throw new LeadDomainError(
      "FORBIDDEN",
      role === "ADMIN" ? "Admin role is required" : "Seller role is required",
    );
  }
}

function assertSourceContract(
  intentLevel: CorrectLeadSourceInput["intentLevel"],
  sourceKey: string,
  sourceSnapshot: Record<string, unknown>,
): Record<string, unknown> {
  if (!isLeadSourceKey(sourceKey)) {
    throw new LeadDomainError("VALIDATION", `Unknown lead source: ${sourceKey}`);
  }
  if (intentForSource(sourceKey) !== intentLevel) {
    throw new LeadDomainError(
      "CONFLICT",
      "Lead intent does not match its source",
    );
  }
  return validateSourceSnapshot(sourceKey, sourceSnapshot);
}

async function assertSourcePairAvailable(
  transaction: Prisma.TransactionClient,
  leadId: string,
  sourceKey: string,
  externalLeadId?: string,
): Promise<void> {
  if (!externalLeadId) return;
  const collision = await transaction.contactSubmission.findFirst({
    where: {
      id: { not: leadId },
      sourceKey,
      externalLeadId,
    },
    select: { id: true },
  });
  if (collision) {
    throw new LeadDomainError(
      "CONFLICT",
      "Duplicate source and external lead ID collision",
    );
  }
}

function sourceLegacyAttribution(
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

export async function correctLeadSource(
  input: CorrectLeadSourceInput,
  dependencies: { store?: LeadLifecycleStore } = {},
) {
  const store = dependencies.store ?? correctionStore;
  if (!input.reason.trim()) {
    throw new LeadDomainError("VALIDATION", "Correction reason is required");
  }
  return store.transaction(async (transaction) => {
    await assertPersistedRole(transaction, input.actor.userId, "ADMIN");
    const existing = await transaction.contactSubmission.findUnique({
      where: { id: input.leadId },
      include: { assignees: { select: { id: true } } },
    });
    if (!existing) throw new LeadDomainError("NOT_FOUND", "Lead not found");
    assertCommercialLeadReady(existing);

    const snapshot = assertSourceContract(
      input.intentLevel,
      input.sourceKey,
      input.sourceSnapshot,
    );
    await assertSourcePairAvailable(
      transaction,
      input.leadId,
      input.sourceKey,
      input.externalLeadId,
    );

    const before = {
      intentLevel: existing.intentLevel,
      sourceKey: existing.sourceKey,
    };
    const after = {
      intentLevel: input.intentLevel,
      sourceKey: input.sourceKey,
    };
    const fromStage = existing.stage;
    const stage: LeadStage =
      fromStage === "PREPARING" &&
      existing.intentLevel === "OUTBOUND" &&
      input.intentLevel !== "OUTBOUND"
        ? "CONTACTING"
        : fromStage;
    const status = legacyStatusForStage(stage);
    const mirror = legacySourceMirror(input.sourceKey);
    const externalLeadId = input.externalLeadId ?? null;
    const attribution = sourceLegacyAttribution(input.sourceKey, snapshot);
    const updated = await transaction.contactSubmission.update({
      where: { id: input.leadId },
      data: {
        intentLevel: input.intentLevel,
        sourceKey: input.sourceKey,
        sourceSnapshot: snapshot as Prisma.InputJsonValue,
        externalLeadId,
        source: mirror.source,
        acquisitionChannel: mirror.acquisitionChannel,
        ...attribution,
        stage,
        status,
        legacyStateHash: legacyHashForLead(
          existing,
          existing.assignees.map(({ id }) => id),
          {
            status,
            source: mirror.source,
            acquisitionChannel: mirror.acquisitionChannel,
            externalLeadId,
            ...attribution,
          },
        ),
      },
    });
    await appendLeadEvent(transaction, {
      leadId: input.leadId,
      type: "SOURCE_CORRECTED",
      actor: {
        type: "USER",
        userId: input.actor.userId,
        role: "ADMIN",
      },
      fromStage,
      toStage: stage,
      metadata: {
        reason: input.reason.trim(),
        before,
        after,
      },
    });
    return updated;
  });
}

export async function updateLeadContactDetails(
  input: UpdateLeadContactDetailsInput,
  dependencies: { store?: LeadLifecycleStore } = {},
) {
  const store = dependencies.store ?? correctionStore;
  const changedFields = (
    ["name", "company", "email", "phone"] as const
  ).filter((field) => input.details[field] !== undefined);
  if (changedFields.length === 0) {
    throw new LeadDomainError(
      "VALIDATION",
      "At least one contact detail is required",
    );
  }
  return store.transaction(async (transaction) => {
    const existing = await transaction.contactSubmission.findUnique({
      where: { id: input.leadId },
      include: { assignees: { select: { id: true } } },
    });
    if (!existing) throw new LeadDomainError("NOT_FOUND", "Lead not found");
    assertCommercialLeadReady(existing);

    if (input.actor.role === "SELLER") {
      await assertPersistedRole(transaction, input.actor.userId, "SELLER");
      assertSellerOwnsLead(input.actor.userId, existing);
      if (input.confirmation !== "SELLER_CONFIRMED") {
        throw new LeadDomainError(
          "VALIDATION",
          "Seller confirmation provenance is required",
        );
      }
    } else {
      await assertPersistedRole(transaction, input.actor.userId, "ADMIN");
      if (input.confirmation !== "ADMIN_CONFIRMED") {
        throw new LeadDomainError(
          "VALIDATION",
          "Admin confirmation provenance is required",
        );
      }
    }

    const details = Object.fromEntries(
      changedFields.map((field) => [field, input.details[field]?.trim() || null]),
    );
    const updated = await transaction.contactSubmission.update({
      where: { id: input.leadId },
      data: {
        ...details,
        ...(input.details.phone !== undefined
          ? { phoneProvenance: input.confirmation }
          : {}),
      },
    });
    await appendLeadEvent(transaction, {
      leadId: input.leadId,
      type: "CONTACT_DETAILS_UPDATED",
      actor: {
        type: "USER",
        userId: input.actor.userId,
        role: input.actor.role,
      },
      fromStage: existing.stage,
      toStage: existing.stage,
      metadata: {
        changedFields,
        confirmation: input.confirmation,
      },
    });
    return updated;
  });
}

function sourceRequiresExternalId(sourceKey: string): boolean {
  return sourceKey === "google_maps" || sourceKey === "meta_lead_ads";
}

export async function resolveLeadMigrationReview(
  input: ResolveLeadMigrationReviewInput,
  dependencies: { store?: LeadLifecycleStore } = {},
) {
  const store = dependencies.store ?? correctionStore;
  if (!input.reason.trim()) {
    throw new LeadDomainError("VALIDATION", "Resolution reason is required");
  }
  return store.transaction(async (transaction) => {
    await assertPersistedRole(transaction, input.actor.userId, "ADMIN");
    const existing = await transaction.contactSubmission.findUnique({
      where: { id: input.leadId },
      include: { assignees: { select: { id: true } } },
    });
    if (!existing) throw new LeadDomainError("NOT_FOUND", "Lead not found");
    if (!existing.migrationReviewRequired) {
      throw new LeadDomainError("CONFLICT", "Lead migration review is resolved");
    }

    const snapshot = assertSourceContract(
      input.intentLevel,
      input.sourceKey,
      input.sourceSnapshot,
    );
    if (sourceRequiresExternalId(input.sourceKey) && !input.externalLeadId) {
      throw new LeadDomainError(
        "VALIDATION",
        "This source requires an external lead ID",
      );
    }
    if (
      input.sourceKey === "meta_lead_ads" &&
      snapshot.externalLeadId !== input.externalLeadId
    ) {
      throw new LeadDomainError(
        "VALIDATION",
        "Meta snapshot external ID does not match",
      );
    }
    if (
      input.sourceKey === "google_maps" &&
      input.externalLeadId !== `gplaces:${String(snapshot.placeId)}`
    ) {
      throw new LeadDomainError(
        "VALIDATION",
        "Google Maps external ID does not match Place ID",
      );
    }
    await assertSourcePairAvailable(
      transaction,
      input.leadId,
      input.sourceKey,
      input.externalLeadId,
    );

    await assertPersistedRole(
      transaction,
      input.eligibleSellerId,
      "SELLER",
    );
    if (input.ownerId) {
      if (input.ownerId !== input.eligibleSellerId) {
        throw new LeadDomainError(
          "VALIDATION",
          "Owned resolution requires the same eligible seller",
        );
      }
      await assertPersistedRole(transaction, input.ownerId, "SELLER");
      if (
        existing.assignees.length > 0 &&
        !existing.assignees.some(({ id }) => id === input.ownerId)
      ) {
        throw new LeadDomainError(
          "VALIDATION",
          "Chosen owner is not supported by legacy assignment evidence",
        );
      }
    } else if (existing.assignees.length > 0) {
      throw new LeadDomainError(
        "VALIDATION",
        "Unowned resolution cannot retain legacy assignees",
      );
    }

    const payment = await transaction.agreement.findFirst({
      where: {
        leadId: input.leadId,
        paymentStatus: "COMPLETED",
        paidAt: { not: null },
      },
      orderBy: { paidAt: "asc" },
      select: { id: true, paidAt: true, paymentStatus: true },
    });
    if (!payment && (input.stage as LeadStage | undefined) === "WON") {
      throw new LeadDomainError(
        "VALIDATION",
        "WON requires verified first payment",
      );
    }
    if (!payment && !input.stage) {
      throw new LeadDomainError(
        "VALIDATION",
        "A safe non-WON stage resolution is required",
      );
    }

    const stage: LeadStage = payment ? "WON" : input.stage!;
    const wonAt = payment?.paidAt ?? null;
    const status = legacyStatusForStage(stage);
    const closedAt =
      stage === "WON" ? wonAt : ["LOST", "SPAM"].includes(stage) ? new Date() : null;
    const mirror = legacySourceMirror(input.sourceKey);
    const attribution = sourceLegacyAttribution(input.sourceKey, snapshot);
    const assigneeIds = input.ownerId ? [input.ownerId] : [];
    const before = {
      intentLevel: existing.intentLevel,
      sourceKey: existing.sourceKey,
      stage: existing.stage,
      ownerId: existing.ownerId,
      eligibleSellerId: existing.eligibleSellerId,
    };
    const after = {
      intentLevel: input.intentLevel,
      sourceKey: input.sourceKey,
      stage,
      ownerId: input.ownerId,
      eligibleSellerId: input.eligibleSellerId,
    };
    const updated = await transaction.contactSubmission.update({
      where: { id: input.leadId },
      data: {
        intentLevel: input.intentLevel,
        sourceKey: input.sourceKey,
        sourceSnapshot: snapshot as Prisma.InputJsonValue,
        externalLeadId: input.externalLeadId ?? null,
        source: mirror.source,
        acquisitionChannel: mirror.acquisitionChannel,
        ...attribution,
        stage,
        status,
        ownerId: input.ownerId,
        eligibleSellerId: input.eligibleSellerId,
        ownerAssignedAt: input.ownerId ? new Date() : null,
        wonAt,
        closedAt,
        migrationReviewRequired: false,
        migrationReviewReason: null,
        assignees: { set: assigneeIds.map((id) => ({ id })) },
        legacyStateHash: legacyHashForLead(existing, assigneeIds, {
          status,
          source: mirror.source,
          acquisitionChannel: mirror.acquisitionChannel,
          externalLeadId: input.externalLeadId ?? null,
          ...attribution,
          closedAt,
        }),
      },
    });
    await appendLeadEventOnce(transaction, {
      leadId: input.leadId,
      type: "MIGRATED",
      actor: {
        type: "USER",
        userId: input.actor.userId,
        role: "ADMIN",
      },
      fromStage: existing.stage,
      toStage: stage,
      dedupeKey: `lead:${input.leadId}:migration-review-resolved:${input.version}`,
      metadata: {
        action: "MIGRATION_REVIEW_RESOLVED",
        reason: input.reason.trim(),
        version: input.version,
        before,
        after,
      },
    });
    return updated;
  });
}
