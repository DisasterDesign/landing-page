import {
  LeadFollowUp,
  Prisma,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { assertActorCanMutateLead } from "./authorization";
import { LeadDomainError } from "./errors";
import { appendLeadEventOnce } from "./events";
import { legacyHashForLead } from "./lifecycle";
import type {
  CompleteFollowUpInput,
  RescheduleFollowUpInput,
  ScheduleFollowUpInput,
} from "./types";

export interface FollowUpStore {
  transaction<T>(
    callback: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T>;
}

const prismaFollowUpStore: FollowUpStore = {
  transaction: (callback) =>
    prisma.$transaction(callback, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }),
};

async function loadAuthorizedLead(
  transaction: Prisma.TransactionClient,
  leadId: string,
  actor: ScheduleFollowUpInput["actor"],
) {
  const lead = await transaction.contactSubmission.findUnique({
    where: { id: leadId },
    include: { assignees: { select: { id: true } } },
  });
  if (!lead) throw new LeadDomainError("NOT_FOUND", "Lead not found");
  await assertActorCanMutateLead(transaction, actor, lead);
  return lead;
}

function assertFutureDueAt(dueAt: Date): void {
  if (Number.isNaN(dueAt.getTime()) || dueAt.getTime() <= Date.now()) {
    throw new LeadDomainError(
      "VALIDATION",
      "Follow-up date must be in the future",
    );
  }
}

function assertFollowUpAllowed(lead: {
  ownerId: string | null;
  stage: string | null;
  doNotContactAt: Date | null;
}): asserts lead is typeof lead & { ownerId: string } {
  if (lead.doNotContactAt) {
    throw new LeadDomainError("FORBIDDEN", "Lead may not be contacted");
  }
  if (!lead.ownerId) {
    throw new LeadDomainError(
      "CONFLICT",
      "Lead must have an owner before scheduling a follow-up",
    );
  }
  if (lead.stage === "WON" || lead.stage === "LOST" || lead.stage === "SPAM") {
    throw new LeadDomainError(
      "CONFLICT",
      "Terminal lead cannot receive a follow-up",
    );
  }
}

export async function scheduleFollowUpInTransaction(
  transaction: Prisma.TransactionClient,
  input: ScheduleFollowUpInput,
): Promise<LeadFollowUp> {
  assertFutureDueAt(input.dueAt);
  const reason = input.reason.trim();
  if (!reason) throw new LeadDomainError("VALIDATION", "Reason is required");
  const lead = await loadAuthorizedLead(
    transaction,
    input.leadId,
    input.actor,
  );
  assertFollowUpAllowed(lead);
  const active = await transaction.leadFollowUp.findFirst({
    where: { leadId: input.leadId, status: "SCHEDULED" },
    select: { id: true },
  });
  if (active) {
    throw new LeadDomainError(
      "CONFLICT",
      "Lead already has an active scheduled follow-up",
    );
  }

  const followUp = await transaction.leadFollowUp.create({
    data: {
      leadId: input.leadId,
      ownerId: lead.ownerId,
      createdById: input.actor.userId,
      dueAt: input.dueAt,
      reason,
    },
  });
  await transaction.contactSubmission.update({
    where: { id: input.leadId },
    data: {
      nextFollowUpAt: input.dueAt,
      legacyStateHash: legacyHashForLead(
        lead,
        lead.assignees.map(({ id }) => id),
        { nextFollowUpAt: input.dueAt },
      ),
    },
  });
  await appendLeadEventOnce(transaction, {
    leadId: input.leadId,
    type: "FOLLOW_UP_SCHEDULED",
    actor: {
      type: "USER",
      userId: input.actor.userId,
      role: input.actor.role,
    },
    fromStage: lead.stage,
    toStage: lead.stage,
    dedupeKey: `lead:${input.leadId}:follow-up-scheduled:${followUp.id}`,
    metadata: {
      followUpId: followUp.id,
      dueAt: input.dueAt.toISOString(),
      reason,
    },
  });
  return followUp;
}

export async function scheduleFollowUp(
  input: ScheduleFollowUpInput,
  dependencies: { store?: FollowUpStore } = {},
): Promise<LeadFollowUp> {
  const store = dependencies.store ?? prismaFollowUpStore;
  return store.transaction((transaction) =>
    scheduleFollowUpInTransaction(transaction, input),
  );
}

export async function rescheduleFollowUpInTransaction(
  transaction: Prisma.TransactionClient,
  input: RescheduleFollowUpInput,
): Promise<LeadFollowUp> {
  assertFutureDueAt(input.dueAt);
  const reason = input.reason.trim();
  if (!reason) throw new LeadDomainError("VALIDATION", "Reason is required");
  const lead = await loadAuthorizedLead(
    transaction,
    input.leadId,
    input.actor,
  );
  assertFollowUpAllowed(lead);
  const previous = await transaction.leadFollowUp.findUnique({
    where: { id: input.followUpId },
  });
  if (
    !previous ||
    previous.leadId !== input.leadId ||
    previous.status !== "SCHEDULED"
  ) {
    throw new LeadDomainError("CONFLICT", "Active follow-up was not found");
  }
  const now = new Date();
  await transaction.leadFollowUp.update({
    where: { id: previous.id },
    data: { status: "CANCELLED", cancelledAt: now },
  });
  const replacement = await transaction.leadFollowUp.create({
    data: {
      leadId: input.leadId,
      ownerId: lead.ownerId,
      createdById: input.actor.userId,
      dueAt: input.dueAt,
      reason,
    },
  });
  await transaction.contactSubmission.update({
    where: { id: input.leadId },
    data: {
      nextFollowUpAt: input.dueAt,
      legacyStateHash: legacyHashForLead(
        lead,
        lead.assignees.map(({ id }) => id),
        { nextFollowUpAt: input.dueAt },
      ),
    },
  });
  await appendLeadEventOnce(transaction, {
    leadId: input.leadId,
    type: "FOLLOW_UP_RESCHEDULED",
    actor: {
      type: "USER",
      userId: input.actor.userId,
      role: input.actor.role,
    },
    fromStage: lead.stage,
    toStage: lead.stage,
    dedupeKey: `lead:${input.leadId}:follow-up-rescheduled:${previous.id}:${replacement.id}`,
    metadata: {
      previousFollowUpId: previous.id,
      followUpId: replacement.id,
      previousDueAt: previous.dueAt.toISOString(),
      dueAt: input.dueAt.toISOString(),
      reason,
    },
  });
  return replacement;
}

export async function rescheduleFollowUp(
  input: RescheduleFollowUpInput,
  dependencies: { store?: FollowUpStore } = {},
): Promise<LeadFollowUp> {
  const store = dependencies.store ?? prismaFollowUpStore;
  return store.transaction((transaction) =>
    rescheduleFollowUpInTransaction(transaction, input),
  );
}

export async function completeFollowUpInTransaction(
  transaction: Prisma.TransactionClient,
  input: CompleteFollowUpInput,
): Promise<LeadFollowUp> {
  const lead = await loadAuthorizedLead(
    transaction,
    input.leadId,
    input.actor,
  );
  const followUp = await transaction.leadFollowUp.findUnique({
    where: { id: input.followUpId },
  });
  if (
    !followUp ||
    followUp.leadId !== input.leadId ||
    followUp.status !== "SCHEDULED"
  ) {
    throw new LeadDomainError("CONFLICT", "Active follow-up was not found");
  }
  const occurredAt = input.occurredAt ?? new Date();
  const completed = await transaction.leadFollowUp.update({
    where: { id: followUp.id },
    data: { status: "COMPLETED", completedAt: occurredAt },
  });
  await transaction.contactSubmission.update({
    where: { id: input.leadId },
    data: {
      nextFollowUpAt: null,
      legacyStateHash: legacyHashForLead(
        lead,
        lead.assignees.map(({ id }) => id),
        { nextFollowUpAt: null },
      ),
    },
  });
  await appendLeadEventOnce(transaction, {
    leadId: input.leadId,
    type: "FOLLOW_UP_COMPLETED",
    actor: {
      type: "USER",
      userId: input.actor.userId,
      role: input.actor.role,
    },
    fromStage: lead.stage,
    toStage: lead.stage,
    occurredAt,
    dedupeKey: `lead:${input.leadId}:follow-up-completed:${followUp.id}`,
    metadata: { followUpId: followUp.id },
  });
  return completed;
}

export async function completeFollowUp(
  input: CompleteFollowUpInput,
  dependencies: { store?: FollowUpStore } = {},
): Promise<LeadFollowUp> {
  const store = dependencies.store ?? prismaFollowUpStore;
  return store.transaction((transaction) =>
    completeFollowUpInTransaction(transaction, input),
  );
}

export async function cancelActiveFollowUps(
  transaction: Prisma.TransactionClient,
  input: {
    leadId: string;
    occurredAt?: Date;
  },
): Promise<number> {
  const active = await transaction.leadFollowUp.findFirst({
    where: { leadId: input.leadId, status: "SCHEDULED" },
    select: { id: true },
  });
  if (!active) return 0;
  const occurredAt = input.occurredAt ?? new Date();
  const result = await transaction.leadFollowUp.updateMany({
    where: { leadId: input.leadId, status: "SCHEDULED" },
    data: { status: "CANCELLED", cancelledAt: occurredAt },
  });
  await transaction.contactSubmission.update({
    where: { id: input.leadId },
    data: { nextFollowUpAt: null },
  });
  return result.count;
}
