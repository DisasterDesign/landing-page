import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProspectingConfig } from "@/lib/prospecting/config";
import { GooglePlacesProspectingProvider } from "@/lib/prospecting/places";
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
    where: { sellerId },
    orderBy: { weekStart: "desc" },
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
        orderBy: [{ qualityScore: "asc" }, { auditConfidence: "desc" }, { createdAt: "asc" }],
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

  const serialize = (prospect: (typeof allProspects)[number]) => {
    const live = liveDetails.get(prospect.placeId);
    return {
      id: prospect.id,
      status: prospect.status,
      websiteStatus: prospect.websiteStatus,
      auditedDomain: prospect.auditedDomain,
      qualityScore: prospect.qualityScore,
      rawQualityScore: prospect.rawQualityScore,
      auditConfidence: prospect.auditConfidence,
      opportunitySummary: prospect.opportunitySummary,
      callAngles: prospect.callAngles,
      nextFollowUpAt: prospect.nextFollowUpAt,
      lastContactedAt: prospect.lastContactedAt,
      live: live
        ? {
            displayName: live.displayName,
            phone: live.nationalPhoneNumber,
            address: live.formattedAddress,
            website: live.websiteUri,
            businessStatus: live.businessStatus,
          }
        : null,
      scoreBreakdown: prospect.audits[0]
        ? {
            availability: prospect.audits[0].availabilityScore,
            performance: prospect.audits[0].performanceScore,
            seo: prospect.audits[0].seoScore,
            maintenance: prospect.audits[0].maintenanceScore,
            visual: prospect.audits[0].visualScore,
            commercial: prospect.audits[0].commercialScore,
          }
        : null,
      interactions: prospect.interactions.map((interaction) => ({
        id: interaction.id,
        outcome: interaction.outcome,
        note: interaction.note,
        nextFollowUpAt: interaction.nextFollowUpAt,
        createdAt: interaction.createdAt,
      })),
    };
  };

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
    current: currentActionable.map(serialize),
    followUps: dueFollowUps.map(serialize),
  });
}
