import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProspectingConfig } from "@/lib/prospecting/config";
import { GooglePlacesProspectingProvider } from "@/lib/prospecting/places";
import { serializeSellerProspect } from "@/lib/prospecting/seller-view";
import type { LivePlaceDetails } from "@/lib/prospecting/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sellerId = session.user.id;
  const now = new Date();

  const currentBatch = await prisma.weeklyProspectBatch.findFirst({
    where: { sellerId, supersededAt: null },
    orderBy: { publishedAt: "desc" },
    include: {
      cycle: {
        include: {
          proposals: { where: { status: "APPROVED" }, orderBy: { approvedAt: "desc" }, take: 1 },
        },
      },
      prospects: {
        where: {
          assignedSellerId: sellerId,
          qualityScore: { lte: 4 },
        },
        include: {
          audits: { orderBy: { auditedAt: "desc" }, take: 1 },
          interactions: { orderBy: { createdAt: "desc" } },
        },
        orderBy: [
          { qualityScore: "asc" },
          { ownerReachabilityScore: "desc" },
          { salesFitConfidence: "desc" },
          { auditConfidence: "desc" },
          { createdAt: "asc" },
        ],
      },
    },
  });

  const dueFollowUps = await prisma.prospect.findMany({
    where: {
      assignedSellerId: sellerId,
      status: "FOLLOW_UP",
      nextFollowUpAt: { lte: now },
      qualityScore: { lte: 4 },
      ...(currentBatch ? { batchId: { not: currentBatch.id } } : {}),
    },
    include: {
      audits: { orderBy: { auditedAt: "desc" }, take: 1 },
      interactions: { orderBy: { createdAt: "desc" } },
    },
    orderBy: { nextFollowUpAt: "asc" },
    take: 50,
  });

  const currentActionable =
    currentBatch?.prospects.filter((prospect) =>
      ["PUBLISHED", "FOLLOW_UP", "QUALIFIED"].includes(prospect.status),
    ) ?? [];
  const allProspects = [...currentActionable, ...dueFollowUps];
  const config = getProspectingConfig();
  let liveDetails = new Map<string, LivePlaceDetails>();
  if (config.placesApiKey) {
    try {
      liveDetails = await new GooglePlacesProspectingProvider({
        apiKey: config.placesApiKey,
        maxDiscoveredPerCycle: config.maxDiscoveredPerCycle,
        maxPlacesCallsPerCycle: config.maxPlacesCallsPerCycle,
      }).getLiveDetails(Array.from(new Set(allProspects.map(({ placeId }) => placeId))));
    } catch {
      // The seller can still see derived audit data while live Places is temporarily unavailable.
    }
  }

  const batchProspects = currentBatch?.prospects ?? [];
  const completedStatuses = new Set([
    "QUALIFIED",
    "NOT_INTERESTED",
    "DO_NOT_CALL",
    "INVALID",
  ]);
  return NextResponse.json({
    batch: currentBatch
      ? {
          id: currentBatch.id,
          weekStart: currentBatch.weekStart,
          territory: currentBatch.cycle.proposals[0]?.displayName ?? "אזור שבועי",
          target: currentBatch.cycle.targetCount,
          total: batchProspects.length,
          completed: batchProspects.filter(
            (prospect) =>
              completedStatuses.has(prospect.status) || prospect.interactions.length > 0,
          ).length,
        }
      : null,
    current: currentActionable.map((prospect) =>
      serializeSellerProspect(prospect, liveDetails.get(prospect.placeId)),
    ),
    followUps: dueFollowUps.map((prospect) =>
      serializeSellerProspect(prospect, liveDetails.get(prospect.placeId)),
    ),
  });
}
