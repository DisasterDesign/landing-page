import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProspectingConfig } from "@/lib/prospecting/config";
import { GooglePlacesProspectingProvider } from "@/lib/prospecting/places";
import { serializeSellerProspect } from "@/lib/prospecting/seller-view";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const prospect = await prisma.prospect.findFirst({
    where: { id, assignedSellerId: session.user.id, qualityScore: { lte: 4 } },
    include: {
      audits: { orderBy: { auditedAt: "desc" }, take: 1 },
      interactions: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!prospect) return NextResponse.json({ error: "Cold lead not found" }, { status: 404 });

  const config = getProspectingConfig();
  let live = null;
  if (config.placesApiKey) {
    try {
      live =
        (
          await new GooglePlacesProspectingProvider({
            apiKey: config.placesApiKey,
            maxDiscoveredPerCycle: 1,
            maxPlacesCallsPerCycle: 1,
          }).getLiveDetails([prospect.placeId])
        ).get(prospect.placeId) ?? null;
    } catch {
      live = null;
    }
  }
  return NextResponse.json(serializeSellerProspect(prospect, live ?? undefined));
}
