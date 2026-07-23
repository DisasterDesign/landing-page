import {
  ContactNote,
  LeadInteraction,
  LeadLossReason,
  LeadStage,
  Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getProspectingConfig } from "@/lib/prospecting/config";
import {
  hashSuppressionValue,
  normalizeDomain,
  normalizePhone,
} from "@/lib/prospecting/suppression";

import {
  assertActorCanMutateLead,
  assertCommercialLeadReady,
} from "./authorization";
import { LeadDomainError } from "./errors";
import { appendLeadEventOnce } from "./events";
import {
  cancelActiveFollowUps,
  rescheduleFollowUpInTransaction,
  scheduleFollowUpInTransaction,
} from "./follow-ups";
import {
  claimLeadInTransaction,
  legacyHashForLead,
} from "./lifecycle";
import { legacyStatusForStage } from "./stage-machine";
import type {
  AddLeadNoteInput,
  LegacyColdInteractionInput,
  RecordLeadInteractionInput,
} from "./types";

export interface InteractionPlan {
  contactStage: LeadStage;
  toStage: LeadStage;
  lossReason?: LeadLossReason;
  lossReasonDetails?: string;
  followUpAt?: Date;
  shouldScheduleFollowUp: boolean;
  shouldCancelFollowUp: boolean;
  markDecisionMakerReached: boolean;
  markDoNotContact: boolean;
}

const terminalStages = new Set<LeadStage>(["WON", "LOST", "SPAM"]);
const preservedOutcomeStages = new Set([
  "NO_ANSWER",
  "CALLBACK",
  "NON_DECISION_MAKER",
]);

export function planInteraction(
  currentStage: LeadStage,
  input: RecordLeadInteractionInput,
): InteractionPlan {
  if (terminalStages.has(currentStage)) {
    throw new LeadDomainError(
      "CONFLICT",
      "Terminal lead cannot record a contact interaction",
    );
  }
  const now = Date.now();
  const schedule = input.followUpAction === "SCHEDULE";
  if (
    (input.outcome === "NO_ANSWER" ||
      input.outcome === "NON_DECISION_MAKER") &&
    !input.followUpAction
  ) {
    throw new LeadDomainError(
      "VALIDATION",
      "An explicit next action is required",
    );
  }
  if (input.outcome === "CALLBACK" && !schedule) {
    throw new LeadDomainError(
      "VALIDATION",
      "Callback requires a scheduled follow-up",
    );
  }
  if (
    schedule &&
    (!input.followUpAt ||
      Number.isNaN(input.followUpAt.getTime()) ||
      input.followUpAt.getTime() <= now)
  ) {
    throw new LeadDomainError(
      "VALIDATION",
      "A future follow-up time is required",
    );
  }
  if (input.followUpAction === "END_AS_LOST" && !input.lossReason) {
    throw new LeadDomainError("VALIDATION", "A loss reason is required");
  }
  if (input.lossReason === "OTHER" && !input.lossReasonDetails?.trim()) {
    throw new LeadDomainError(
      "VALIDATION",
      "OTHER loss reason requires details",
    );
  }
  if (
    (input.outcome === "INTERESTED" ||
      input.outcome === "NOT_INTERESTED") &&
    !input.decisionMakerReached
  ) {
    throw new LeadDomainError(
      "VALIDATION",
      "This outcome requires reaching the decision maker",
    );
  }
  if (input.outcome === "NON_DECISION_MAKER" && input.decisionMakerReached) {
    throw new LeadDomainError(
      "VALIDATION",
      "Non-decision-maker outcome cannot reach the decision maker",
    );
  }
  if (
    (input.outcome === "DO_NOT_CALL" || input.outcome === "WRONG_NUMBER") &&
    schedule
  ) {
    throw new LeadDomainError(
      "VALIDATION",
      "This outcome cannot schedule a follow-up",
    );
  }

  const contactStage: LeadStage =
    currentStage === "PREPARING" ? "CONTACTING" : currentStage;
  let toStage = contactStage;
  let lossReason = input.lossReason;
  if (input.followUpAction === "END_AS_LOST") {
    toStage = "LOST";
  } else if (input.outcome === "INTERESTED") {
    if (contactStage === "CONTACTING") toStage = "QUALIFIED";
  } else if (input.outcome === "NOT_INTERESTED") {
    toStage = "LOST";
    lossReason = input.lossReason ?? "NO_INTEREST";
  } else if (input.outcome === "WRONG_NUMBER") {
    toStage = "LOST";
    lossReason = "BAD_CONTACT";
  } else if (input.outcome === "DO_NOT_CALL") {
    toStage = "LOST";
    lossReason = "DO_NOT_CONTACT";
  } else if (preservedOutcomeStages.has(input.outcome)) {
    toStage = contactStage;
  }

  return {
    contactStage,
    toStage,
    lossReason,
    lossReasonDetails: input.lossReasonDetails?.trim() || undefined,
    followUpAt: schedule ? input.followUpAt : undefined,
    shouldScheduleFollowUp: schedule,
    shouldCancelFollowUp: toStage === "LOST",
    markDecisionMakerReached: input.decisionMakerReached,
    markDoNotContact: input.outcome === "DO_NOT_CALL",
  };
}

export interface InteractionStore {
  transaction<T>(
    callback: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T>;
}

const prismaInteractionStore: InteractionStore = {
  transaction: (callback) =>
    prisma.$transaction(callback, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }),
};

export interface LeadInteractionResult {
  interaction: LeadInteraction;
  lead: Awaited<
    ReturnType<Prisma.TransactionClient["contactSubmission"]["update"]>
  >;
  followUpId: string | null;
}

function validateCallAngles(
  sourceSnapshot: Prisma.JsonValue | null,
  usedCallAngleIds: string[],
): void {
  const snapshot =
    sourceSnapshot &&
    typeof sourceSnapshot === "object" &&
    !Array.isArray(sourceSnapshot)
      ? (sourceSnapshot as Record<string, unknown>)
      : {};
  const available = new Set(
    Array.isArray(snapshot.callAngles)
      ? snapshot.callAngles.flatMap((angle) =>
          angle &&
          typeof angle === "object" &&
          !Array.isArray(angle) &&
          typeof (angle as Record<string, unknown>).id === "string"
            ? [String((angle as Record<string, unknown>).id)]
            : [],
        )
      : [],
  );
  if (usedCallAngleIds.some((id) => !available.has(id))) {
    throw new LeadDomainError(
      "VALIDATION",
      "Unknown call angle was submitted",
    );
  }
}

async function persistSuppression(
  transaction: Prisma.TransactionClient,
  input: {
    leadId: string;
    prospect: { id: string; placeId: string; auditedDomain: string | null } | null;
    actorId: string;
    reason: string;
    livePhone?: string | null;
    hashSecret?: string;
    badPhoneOnly: boolean;
  },
): Promise<void> {
  const secret = input.hashSecret ?? getProspectingConfig().hashSecret;
  const phoneHash =
    secret && input.livePhone
      ? hashSuppressionValue(normalizePhone(input.livePhone), secret)
      : null;
  if (input.badPhoneOnly) {
    if (!phoneHash) return;
  }
  const domainHash =
    !input.badPhoneOnly && secret && input.prospect?.auditedDomain
      ? hashSuppressionValue(
          normalizeDomain(input.prospect.auditedDomain),
          secret,
        )
      : null;
  const placeId = input.badPhoneOnly ? null : input.prospect?.placeId ?? null;
  const filters = [
    ...(placeId ? [{ placeId }] : []),
    ...(phoneHash ? [{ phoneHash }] : []),
    ...(domainHash ? [{ domainHash }] : []),
  ];
  if (filters.length === 0) return;
  const existing = await transaction.prospectSuppression.findFirst({
    where: { OR: filters },
    select: { id: true },
  });
  if (existing) {
    await transaction.prospectSuppression.update({
      where: { id: existing.id },
      data: { reason: input.reason },
    });
  } else {
    await transaction.prospectSuppression.create({
      data: {
        placeId,
        phoneHash,
        domainHash,
        reason: input.reason,
        sourceProspectId: input.prospect?.id ?? null,
        createdById: input.actorId,
      },
    });
  }
}

export async function recordInteractionInTransaction(
  transaction: Prisma.TransactionClient,
  input: RecordLeadInteractionInput,
  trusted: { livePhone?: string | null; hashSecret?: string } = {},
): Promise<LeadInteractionResult> {
  const lead = await transaction.contactSubmission.findUnique({
    where: { id: input.leadId },
    include: {
      assignees: { select: { id: true } },
      prospect: {
        select: { id: true, placeId: true, auditedDomain: true },
      },
    },
  });
  if (!lead) throw new LeadDomainError("NOT_FOUND", "Lead not found");
  assertCommercialLeadReady(lead);
  await assertActorCanMutateLead(transaction, input.actor, lead);
  if (lead.doNotContactAt) {
    throw new LeadDomainError("FORBIDDEN", "Lead may not be contacted");
  }
  validateCallAngles(lead.sourceSnapshot, input.usedCallAngleIds);
  const plan = planInteraction(lead.stage, input);
  const occurredAt = new Date();
  const activeFollowUp = await transaction.leadFollowUp.findFirst({
    where: { leadId: lead.id, status: "SCHEDULED" },
  });
  let followUpId: string | null = activeFollowUp?.id ?? null;
  if (plan.shouldScheduleFollowUp && plan.followUpAt) {
    const followUp = activeFollowUp
      ? await rescheduleFollowUpInTransaction(transaction, {
          leadId: lead.id,
          followUpId: activeFollowUp.id,
          dueAt: plan.followUpAt,
          reason: input.note?.trim() || "Follow-up from interaction",
          actor: input.actor,
        })
      : await scheduleFollowUpInTransaction(transaction, {
          leadId: lead.id,
          dueAt: plan.followUpAt,
          reason: input.note?.trim() || "Follow-up from interaction",
          actor: input.actor,
        });
    followUpId = followUp.id;
  } else if (plan.shouldCancelFollowUp) {
    await cancelActiveFollowUps(transaction, {
      leadId: lead.id,
      occurredAt,
    });
    followUpId = null;
  }

  const interaction = await transaction.leadInteraction.create({
    data: {
      leadId: lead.id,
      authorId: input.actor.userId,
      channel: input.channel,
      outcome: input.outcome,
      decisionMakerReached: input.decisionMakerReached,
      note: input.note?.trim() || null,
      nextFollowUpAt: plan.followUpAt ?? null,
      lossReason: plan.lossReason ?? null,
      lossReasonDetails: plan.lossReasonDetails ?? null,
      usedCallAngleIds: input.usedCallAngleIds,
      occurredAt,
    },
  });

  if (input.outcome === "DO_NOT_CALL" || input.outcome === "WRONG_NUMBER") {
    await persistSuppression(transaction, {
      leadId: lead.id,
      prospect: lead.prospect,
      actorId: input.actor.userId,
      reason: input.note?.trim() || input.outcome,
      livePhone: trusted.livePhone,
      hashSecret: trusted.hashSecret,
      badPhoneOnly: input.outcome === "WRONG_NUMBER",
    });
  }

  const status = legacyStatusForStage(plan.toStage);
  const closedAt = plan.toStage === "LOST" ? occurredAt : lead.closedAt;
  const nextFollowUpAt = plan.shouldScheduleFollowUp
    ? plan.followUpAt ?? null
    : plan.shouldCancelFollowUp
      ? null
      : lead.nextFollowUpAt;
  const data: Prisma.ContactSubmissionUpdateInput = {
    stage: plan.toStage,
    status,
    firstContactedAt: lead.firstContactedAt ?? occurredAt,
    lastContactedAt: occurredAt,
    nextFollowUpAt,
    closedAt,
    legacyStateHash: legacyHashForLead(
      lead,
      lead.assignees.map(({ id }) => id),
      {
        status,
        nextFollowUpAt,
        lastContactedAt: occurredAt,
        closedAt,
      },
    ),
  };
  if (plan.markDecisionMakerReached) {
    data.decisionMakerReachedAt =
      lead.decisionMakerReachedAt ?? occurredAt;
  }
  if (plan.toStage === "QUALIFIED") {
    data.qualifiedAt = lead.qualifiedAt ?? occurredAt;
  }
  if (plan.toStage === "LOST") {
    data.lostAt = occurredAt;
    data.lossReason = plan.lossReason;
    data.lossReasonDetails = plan.lossReasonDetails ?? null;
  }
  if (plan.markDoNotContact) data.doNotContactAt = occurredAt;

  const updated = await transaction.contactSubmission.update({
    where: { id: lead.id },
    data,
  });
  await appendLeadEventOnce(transaction, {
    leadId: lead.id,
    type: "CONTACT_ATTEMPTED",
    actor: {
      type: "USER",
      userId: input.actor.userId,
      role: input.actor.role,
    },
    fromStage: lead.stage,
    toStage: plan.contactStage,
    occurredAt,
    dedupeKey: `lead:${lead.id}:contact-attempted:${interaction.id}`,
    metadata: {
      interactionId: interaction.id,
      channel: input.channel,
      outcome: input.outcome,
      usedCallAngleIds: input.usedCallAngleIds,
    },
  });
  if (plan.markDecisionMakerReached) {
    await appendLeadEventOnce(transaction, {
      leadId: lead.id,
      type: "DECISION_MAKER_REACHED",
      actor: {
        type: "USER",
        userId: input.actor.userId,
        role: input.actor.role,
      },
      fromStage: plan.contactStage,
      toStage: plan.contactStage,
      occurredAt,
      dedupeKey: `lead:${lead.id}:decision-maker:${interaction.id}`,
      metadata: { interactionId: interaction.id },
    });
  }
  if (plan.toStage === "QUALIFIED" && lead.stage !== "QUALIFIED") {
    await appendLeadEventOnce(transaction, {
      leadId: lead.id,
      type: "QUALIFIED",
      actor: {
        type: "USER",
        userId: input.actor.userId,
        role: input.actor.role,
      },
      fromStage: plan.contactStage,
      toStage: "QUALIFIED",
      occurredAt,
      dedupeKey: `lead:${lead.id}:qualified:${interaction.id}`,
      metadata: { interactionId: interaction.id },
    });
  }
  if (plan.toStage === "LOST") {
    await appendLeadEventOnce(transaction, {
      leadId: lead.id,
      type: "LOST",
      actor: {
        type: "USER",
        userId: input.actor.userId,
        role: input.actor.role,
      },
      fromStage: plan.contactStage,
      toStage: "LOST",
      occurredAt,
      dedupeKey: `lead:${lead.id}:lost:${interaction.id}`,
      metadata: {
        interactionId: interaction.id,
        lossReason: plan.lossReason,
        ...(activeFollowUp
          ? { cancelledFollowUpId: activeFollowUp.id }
          : {}),
      },
    });
  }
  if (plan.markDoNotContact) {
    await appendLeadEventOnce(transaction, {
      leadId: lead.id,
      type: "DO_NOT_CALL",
      actor: {
        type: "USER",
        userId: input.actor.userId,
        role: input.actor.role,
      },
      fromStage: plan.contactStage,
      toStage: "LOST",
      occurredAt,
      dedupeKey: `lead:${lead.id}:do-not-call:${interaction.id}`,
      metadata: { interactionId: interaction.id },
    });
  }
  return { interaction, lead: updated, followUpId };
}

export async function recordInteraction(
  input: RecordLeadInteractionInput,
  dependencies: {
    store?: InteractionStore;
    livePhone?: string | null;
    hashSecret?: string;
  } = {},
): Promise<LeadInteractionResult> {
  const store = dependencies.store ?? prismaInteractionStore;
  return store.transaction((transaction) =>
    recordInteractionInTransaction(transaction, input, {
      livePhone: dependencies.livePhone,
      hashSecret: dependencies.hashSecret,
    }),
  );
}

export async function addLeadNoteInTransaction(
  transaction: Prisma.TransactionClient,
  input: AddLeadNoteInput,
): Promise<ContactNote> {
  const body = input.body.trim();
  if (!body) throw new LeadDomainError("VALIDATION", "Note is empty");
  if (body.length > 5_000) {
    throw new LeadDomainError("VALIDATION", "Note is too long");
  }
  const lead = await transaction.contactSubmission.findUnique({
    where: { id: input.leadId },
    include: { assignees: { select: { id: true } } },
  });
  if (!lead) throw new LeadDomainError("NOT_FOUND", "Lead not found");
  assertCommercialLeadReady(lead);
  await assertActorCanMutateLead(transaction, input.actor, lead);
  const note = await transaction.contactNote.create({
    data: {
      contactId: input.leadId,
      authorId: input.actor.userId,
      body,
    },
  });
  await appendLeadEventOnce(transaction, {
    leadId: input.leadId,
    type: "NOTE_ADDED",
    actor: {
      type: "USER",
      userId: input.actor.userId,
      role: input.actor.role,
    },
    fromStage: lead.stage,
    toStage: lead.stage,
    dedupeKey: `lead:${input.leadId}:note-added:${note.id}`,
    metadata: { noteId: note.id },
  });
  return note;
}

export async function addLeadNote(
  input: AddLeadNoteInput,
  dependencies: { store?: InteractionStore } = {},
): Promise<ContactNote> {
  const store = dependencies.store ?? prismaInteractionStore;
  return store.transaction((transaction) =>
    addLeadNoteInTransaction(transaction, input),
  );
}

export async function recordLegacyColdInteraction(
  input: LegacyColdInteractionInput,
  dependencies: {
    store?: InteractionStore;
    livePhone?: string | null;
    hashSecret?: string;
  } = {},
): Promise<LeadInteractionResult> {
  if (input.actor.role !== "SELLER") {
    throw new LeadDomainError(
      "FORBIDDEN",
      "Legacy cold interactions require a seller",
    );
  }
  const store = dependencies.store ?? prismaInteractionStore;
  return store.transaction(async (transaction) => {
    const prospect = await transaction.prospect.findUnique({
      where: { id: input.prospectId },
      select: { promotedLeadId: true },
    });
    if (!prospect?.promotedLeadId) {
      throw new LeadDomainError("NOT_FOUND", "Published lead not found");
    }
    const current = await transaction.contactSubmission.findUnique({
      where: { id: prospect.promotedLeadId },
      select: { ownerId: true },
    });
    if (!current) throw new LeadDomainError("NOT_FOUND", "Lead not found");
    if (current.ownerId === null) {
      await claimLeadInTransaction(transaction, {
        leadId: prospect.promotedLeadId,
        sellerId: input.actor.userId,
      });
    } else if (current.ownerId !== input.actor.userId) {
      throw new LeadDomainError(
        "CONFLICT",
        "Lead is already owned by another seller",
      );
    }
    return recordInteractionInTransaction(
      transaction,
      {
        ...input.interaction,
        leadId: prospect.promotedLeadId,
        actor: input.actor,
      },
      {
        livePhone: dependencies.livePhone,
        hashSecret: dependencies.hashSecret,
      },
    );
  });
}
