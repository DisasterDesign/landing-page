import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireProspectingAdmin } from "@/lib/prospecting/admin-auth";
import { getProspectingConfig } from "@/lib/prospecting/config";
import { GooglePlacesProspectingProvider } from "@/lib/prospecting/places";
import type { LivePlaceDetails } from "@/lib/prospecting/types";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireProspectingAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const cycle = await prisma.prospectingCycle.findUnique({
    where: { id },
    include: {
      proposals: { orderBy: { createdAt: "desc" } },
      prospects: {
        orderBy: [{ qualityScore: "asc" }, { auditConfidence: "desc" }, { createdAt: "asc" }],
        include: { audits: { orderBy: { auditedAt: "desc" }, take: 1 } },
      },
      batch: true,
    },
  });
  if (!cycle) return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
  const config = getProspectingConfig();
  let liveDetails = new Map<string, LivePlaceDetails>();
  if (config.placesApiKey) {
    try {
      liveDetails = await new GooglePlacesProspectingProvider({
        apiKey: config.placesApiKey,
        maxDiscoveredPerCycle: config.maxDiscoveredPerCycle,
        maxPlacesCallsPerCycle: config.maxPlacesCallsPerCycle,
      }).getLiveDetails(cycle.prospects.map(({ placeId }) => placeId));
    } catch {
      // Admin audit evidence remains available during a temporary Places outage.
    }
  }
  return NextResponse.json({
    cycle: {
      ...cycle,
      prospects: cycle.prospects.map((prospect) => ({
        ...prospect,
        live: liveDetails.get(prospect.placeId) ?? null,
      })),
    },
  });
}
