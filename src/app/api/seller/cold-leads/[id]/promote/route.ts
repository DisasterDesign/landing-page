import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProspectingConfig } from "@/lib/prospecting/config";
import { GooglePlacesProspectingProvider } from "@/lib/prospecting/places";
import { promoteProspect } from "@/lib/prospecting/promotion";
import { promoteProspectSchema } from "@/lib/validations";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sellerId = session.user.id;
  const { id } = await params;
  const parsed = promoteProspectSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const prospect = await prisma.prospect.findFirst({
    where: { id, assignedSellerId: sellerId, status: "QUALIFIED", qualityScore: { lte: 4 } },
    select: { placeId: true },
  });
  if (!prospect) return NextResponse.json({ error: "Interested prospect not found" }, { status: 404 });

  const config = getProspectingConfig();
  if (!config.placesApiKey) {
    return NextResponse.json({ error: "Live business details are not configured" }, { status: 503 });
  }
  const live = (
    await new GooglePlacesProspectingProvider({
      apiKey: config.placesApiKey,
      maxDiscoveredPerCycle: 1,
      maxPlacesCallsPerCycle: 1,
    }).getLiveDetails([prospect.placeId])
  ).get(prospect.placeId);
  if (!live?.displayName) {
    return NextResponse.json({ error: "Live business details are unavailable" }, { status: 502 });
  }

  const result = await promoteProspect({
    prospectId: id,
    sellerId,
    live: {
      displayName: parsed.data.name ?? live.displayName,
      phone: parsed.data.phone ?? live.nationalPhoneNumber,
    },
    email: parsed.data.email,
  });
  return NextResponse.json(result, { status: result.created ? 201 : 200 });
}
