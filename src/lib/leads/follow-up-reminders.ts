import { Prisma } from "@prisma/client";

import {
  createNotificationOnceInTransaction,
  sendNotificationPush,
  type CreateNotificationInput,
  type NotificationPersistence,
} from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

import { sellerLeadActionUrl } from "./action-url";

const terminalStages = new Set(["WON", "LOST", "SPAM"]);

export interface FollowUpReminderStore {
  findDueFollowUps(
    now: Date,
    limit: number,
  ): Promise<Array<{ id: string }>>;
  transaction<T>(
    callback: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T>;
}

const prismaFollowUpReminderStore: FollowUpReminderStore = {
  findDueFollowUps: (now, limit) =>
    prisma.leadFollowUp.findMany({
      where: {
        status: "SCHEDULED",
        dueAt: { lte: now },
        reminderSentAt: null,
      },
      select: { id: true },
      orderBy: [{ dueAt: "asc" }, { id: "asc" }],
      take: limit,
    }),
  transaction: (callback) =>
    prisma.$transaction(callback, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }),
};

export async function dispatchDueFollowUps(
  now: Date = new Date(),
  dependencies: {
    store?: FollowUpReminderStore;
    push?: (input: CreateNotificationInput) => Promise<void>;
    limit?: number;
  } = {},
): Promise<{ scanned: number; created: number }> {
  const store = dependencies.store ?? prismaFollowUpReminderStore;
  const candidates = await store.findDueFollowUps(
    now,
    dependencies.limit ?? 100,
  );
  const effects: CreateNotificationInput[] = [];
  let created = 0;

  for (const candidate of candidates) {
    const result = await store.transaction(async (transaction) => {
      const followUp = await transaction.leadFollowUp.findUnique({
        where: { id: candidate.id },
        include: {
          lead: {
            select: {
              id: true,
              name: true,
              company: true,
              ownerId: true,
              intentLevel: true,
              stage: true,
              migrationReviewRequired: true,
            },
          },
        },
      });
      if (
        !followUp ||
        followUp.status !== "SCHEDULED" ||
        followUp.reminderSentAt ||
        followUp.dueAt > now ||
        !followUp.ownerId ||
        followUp.lead.ownerId !== followUp.ownerId ||
        followUp.lead.migrationReviewRequired ||
        !followUp.lead.stage ||
        terminalStages.has(followUp.lead.stage)
      ) {
        return null;
      }
      const input: CreateNotificationInput = {
        recipientId: followUp.ownerId,
        type: "LEAD_FOLLOWUP",
        title: `פולואפ: ${followUp.lead.company ?? followUp.lead.name ?? "ליד"}`,
        body: followUp.reason,
        leadId: followUp.leadId,
        url: sellerLeadActionUrl(followUp.lead),
        dedupeKey: `${followUp.ownerId}:lead-followup:${followUp.id}`,
      };
      const persisted = await createNotificationOnceInTransaction(
        transaction.notification as unknown as NotificationPersistence,
        input,
      );
      const marked = await transaction.leadFollowUp.updateMany({
        where: {
          id: followUp.id,
          ownerId: followUp.ownerId,
          status: "SCHEDULED",
          reminderSentAt: null,
        },
        data: { reminderSentAt: now },
      });
      if (marked.count !== 1) {
        throw new Error("Follow-up changed while dispatching its reminder");
      }
      return { input, created: persisted.created };
    });
    if (result?.created) {
      created += 1;
      effects.push(result.input);
    }
  }

  const push = dependencies.push ?? sendNotificationPush;
  await Promise.all(effects.map((effect) => push(effect)));
  return { scanned: candidates.length, created };
}
