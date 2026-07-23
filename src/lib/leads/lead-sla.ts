import { Prisma } from "@prisma/client";

import {
  createNotificationOnceInTransaction,
  sendNotificationPush,
  type CreateNotificationInput,
  type NotificationPersistence,
} from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

import { leadActionUrlFor, sellerLeadActionUrl } from "./action-url";

export interface LeadSlaMinutes {
  INBOUND: number;
  AD_RESPONSE: number;
}

function positiveMinutes(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getLeadSlaMinutes(
  env: Record<string, string | undefined> = process.env,
): LeadSlaMinutes {
  return {
    INBOUND: positiveMinutes(env.INBOUND_LEAD_SLA_MINUTES, 5),
    AD_RESPONSE: positiveMinutes(env.AD_RESPONSE_LEAD_SLA_MINUTES, 15),
  };
}

export interface LeadSlaStore {
  findSlaCandidates(
    now: Date,
    minutes: LeadSlaMinutes,
    limit: number,
  ): Promise<Array<{ id: string }>>;
  transaction<T>(
    callback: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T>;
}

const prismaLeadSlaStore: LeadSlaStore = {
  findSlaCandidates: (now, minutes, limit) => {
    const earliestThreshold = Math.min(
      minutes.INBOUND,
      minutes.AD_RESPONSE,
    );
    return prisma.contactSubmission.findMany({
      where: {
        stage: "NEW",
        ownerId: null,
        migrationReviewRequired: false,
        eligibleSellerId: { not: null },
        intentLevel: { in: ["INBOUND", "AD_RESPONSE"] },
        createdAt: {
          lte: new Date(now.getTime() - earliestThreshold * 60_000),
        },
        OR: [{ slaAlertedAt: null }, { slaEscalatedAt: null }],
      },
      select: { id: true },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: limit,
    });
  },
  transaction: (callback) =>
    prisma.$transaction(callback, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    }),
};

export async function dispatchLeadSlaAlerts(
  now: Date = new Date(),
  dependencies: {
    store?: LeadSlaStore;
    push?: (input: CreateNotificationInput) => Promise<void>;
    env?: Record<string, string | undefined>;
    limit?: number;
  } = {},
): Promise<{ scanned: number; created: number }> {
  const minutes = getLeadSlaMinutes(dependencies.env);
  const store = dependencies.store ?? prismaLeadSlaStore;
  const candidates = await store.findSlaCandidates(
    now,
    minutes,
    dependencies.limit ?? 100,
  );
  const effects: CreateNotificationInput[] = [];
  let created = 0;

  for (const candidate of candidates) {
    const result = await store.transaction(async (transaction) => {
      const lead = await transaction.contactSubmission.findUnique({
        where: { id: candidate.id },
        select: {
          id: true,
          name: true,
          company: true,
          intentLevel: true,
          sourceKey: true,
          stage: true,
          ownerId: true,
          eligibleSellerId: true,
          migrationReviewRequired: true,
          slaAlertedAt: true,
          slaEscalatedAt: true,
          createdAt: true,
        },
      });
      if (
        !lead ||
        lead.stage !== "NEW" ||
        lead.ownerId !== null ||
        lead.migrationReviewRequired ||
        !lead.eligibleSellerId ||
        (lead.intentLevel !== "INBOUND" &&
          lead.intentLevel !== "AD_RESPONSE")
      ) {
        return [] as CreateNotificationInput[];
      }
      const threshold = minutes[lead.intentLevel];
      const elapsedMs = now.getTime() - lead.createdAt.getTime();
      const createdEffects: CreateNotificationInput[] = [];

      if (!lead.slaAlertedAt && elapsedMs >= threshold * 60_000) {
        const input: CreateNotificationInput = {
          recipientId: lead.eligibleSellerId,
          type: "LEAD_SLA_BREACH",
          title: "ליד חדש ממתין למענה",
          body: lead.company ?? lead.name ?? "ליד חדש",
          leadId: lead.id,
          url: sellerLeadActionUrl(lead),
          dedupeKey: `${lead.eligibleSellerId}:lead-sla:${lead.id}:v1`,
        };
        const persisted = await createNotificationOnceInTransaction(
          transaction.notification as unknown as NotificationPersistence,
          input,
        );
        const marked = await transaction.contactSubmission.updateMany({
          where: {
            id: lead.id,
            stage: "NEW",
            ownerId: null,
            eligibleSellerId: lead.eligibleSellerId,
            migrationReviewRequired: false,
            slaAlertedAt: null,
          },
          data: { slaAlertedAt: now },
        });
        if (marked.count !== 1) {
          throw new Error("Lead changed while dispatching its SLA alert");
        }
        if (persisted.created) createdEffects.push(input);
      }

      if (!lead.slaEscalatedAt && elapsedMs >= threshold * 2 * 60_000) {
        const admins = await transaction.user.findMany({
          where: { role: "ADMIN" },
          select: { id: true },
        });
        if (admins.length > 0) {
          for (const admin of admins) {
            const input: CreateNotificationInput = {
              recipientId: admin.id,
              type: "LEAD_SLA_ESCALATION",
              title: "חריגת SLA בליד חדש",
              body: lead.company ?? lead.name ?? "ליד חדש",
              leadId: lead.id,
              url: leadActionUrlFor({ audience: "ADMIN", lead }),
              dedupeKey: `${admin.id}:lead-sla-escalation:${lead.id}:v1`,
            };
            const persisted = await createNotificationOnceInTransaction(
              transaction.notification as unknown as NotificationPersistence,
              input,
            );
            if (persisted.created) createdEffects.push(input);
          }
          const marked = await transaction.contactSubmission.updateMany({
            where: {
              id: lead.id,
              stage: "NEW",
              ownerId: null,
              migrationReviewRequired: false,
              slaEscalatedAt: null,
            },
            data: { slaEscalatedAt: now },
          });
          if (marked.count !== 1) {
            throw new Error("Lead changed while escalating its SLA alert");
          }
        }
      }
      return createdEffects;
    });
    created += result.length;
    effects.push(...result);
  }

  const push = dependencies.push ?? sendNotificationPush;
  await Promise.all(effects.map((effect) => push(effect)));
  return { scanned: candidates.length, created };
}
