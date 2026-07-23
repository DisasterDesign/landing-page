import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { sellerLeadScope } from "@/lib/leads/authorization";
import { getLeadLifecycleConfig } from "@/lib/leads/config";
import { leadDomainErrorResponse } from "@/lib/leads/http";
import {
  getSellerLeadDetailsByIds,
  getSellerLeadList,
  type SellerLeadDetail,
} from "@/lib/leads/projection";
import { prisma } from "@/lib/prisma";
import { serializeCanonicalSellerProspect } from "@/lib/prospecting/seller-view";

export const dynamic = "force-dynamic";

async function loadColdPages(input: {
  sellerId: string;
  cursor?: string;
  legacy: boolean;
}) {
  const items: SellerLeadDetail[] = [];
  let cursor = input.cursor;
  do {
    const page = await getSellerLeadList({
      sellerId: input.sellerId,
      intents: ["OUTBOUND"],
      cursor,
      limit: input.legacy ? 100 : 50,
    });
    items.push(...page.items);
    cursor = page.nextCursor ?? undefined;
    if (!input.legacy) {
      return { items, nextCursor: page.nextCursor };
    }
  } while (cursor && items.length < 300);
  return { items: items.slice(0, 300), nextCursor: null };
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const sellerId = session.user.id;
    const url = new URL(request.url);
    const now = new Date();
    const config = getLeadLifecycleConfig();
    const unified = config.enabled && config.coldPreparationEnabled;
    const [page, currentBatch, dueTasks] = await Promise.all([
      loadColdPages({
        sellerId,
        cursor: url.searchParams.get("cursor") ?? undefined,
        legacy: !unified,
      }),
      prisma.weeklyProspectBatch.findFirst({
        where: { sellerId, supersededAt: null },
        orderBy: { publishedAt: "desc" },
        include: {
          cycle: {
            include: {
              proposals: {
                where: { status: "APPROVED" },
                orderBy: { approvedAt: "desc" },
                take: 1,
              },
            },
          },
          prospects: {
            select: {
              promotedLead: {
                select: { stage: true, interactions: { select: { id: true } } },
              },
            },
          },
        },
      }),
      prisma.leadFollowUp.findMany({
        where: {
          ownerId: sellerId,
          status: "SCHEDULED",
          dueAt: { lte: now },
          lead: {
            is: {
              AND: [
                sellerLeadScope(sellerId),
                {
                  ownerId: sellerId,
                  intentLevel: "OUTBOUND",
                  stage: { notIn: ["WON", "LOST", "SPAM"] },
                },
              ],
            },
          },
        },
        select: { leadId: true },
        orderBy: { dueAt: "asc" },
        take: 50,
      }),
    ]);

    const pageById = new Map(page.items.map((lead) => [lead.id, lead]));
    const missingDueIds = dueTasks
      .map(({ leadId }) => leadId)
      .filter((leadId) => !pageById.has(leadId));
    const missingDue = await getSellerLeadDetailsByIds({
      ids: missingDueIds,
      sellerId,
    });
    for (const lead of missingDue) pageById.set(lead.id, lead);
    const due = dueTasks.flatMap(({ leadId }) => {
      const lead = pageById.get(leadId);
      return lead ? [lead] : [];
    });
    const dueIds = new Set(
      due.map((lead) => lead.id),
    );
    const current = page.items.filter((lead) => !dueIds.has(lead.id));
    const responseBatch = currentBatch
      ? {
          id: currentBatch.id,
          weekStart: currentBatch.weekStart,
          territory:
            currentBatch.cycle.proposals[0]?.displayName ?? "אזור שבועי",
          target: currentBatch.cycle.targetCount,
          total: currentBatch.prospects.length,
          completed: currentBatch.prospects.filter(({ promotedLead }) => {
            if (!promotedLead?.stage) return false;
            return (
              promotedLead.stage !== "NEW" ||
              promotedLead.interactions.length > 0
            );
          }).length,
        }
      : null;

    if (unified) {
      return NextResponse.json({
        batch: responseBatch,
        current,
        followUps: due,
        nextCursor: page.nextCursor,
      });
    }
    return NextResponse.json({
      batch: responseBatch,
      current: current.map(serializeCanonicalSellerProspect),
      followUps: due.map(serializeCanonicalSellerProspect),
      nextCursor: page.nextCursor,
    });
  } catch (error) {
    console.error("Error listing seller cold leads:", error);
    return leadDomainErrorResponse(error);
  }
}
