import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { leadDomainErrorResponse } from "@/lib/leads/http";
import { recordInteraction } from "@/lib/leads/interactions";
import { prisma } from "@/lib/prisma";
import { getProspectingConfig } from "@/lib/prospecting/config";
import { GooglePlacesProspectingProvider } from "@/lib/prospecting/places";
import { leadInteractionSchema } from "@/lib/validations";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = leadInteractionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const { id } = await params;
    const trustedLead = await prisma.contactSubmission.findFirst({
      where: {
        id,
        ownerId: session.user.id,
        migrationReviewRequired: false,
      },
      select: { prospect: { select: { placeId: true } } },
    });
    let livePhone: string | null = null;
    const config = getProspectingConfig();
    if (
      trustedLead?.prospect &&
      (parsed.data.outcome === "DO_NOT_CALL" ||
        parsed.data.outcome === "WRONG_NUMBER") &&
      config.placesApiKey
    ) {
      try {
        livePhone =
          (
            await new GooglePlacesProspectingProvider({
              apiKey: config.placesApiKey,
              maxDiscoveredPerCycle: 1,
              maxPlacesCallsPerCycle: 1,
            }).getLiveDetails([trustedLead.prospect.placeId])
          ).get(trustedLead.prospect.placeId)?.nationalPhoneNumber ?? null;
      } catch {
        livePhone = null;
      }
    }
    const result = await recordInteraction(
      {
        leadId: id,
        actor: { userId: session.user.id, role: "SELLER" },
        channel: parsed.data.channel,
        outcome: parsed.data.outcome,
        decisionMakerReached: parsed.data.decisionMakerReached,
        note: parsed.data.note,
        followUpAction: parsed.data.followUpAction,
        followUpAt: parsed.data.followUpAt
          ? new Date(parsed.data.followUpAt)
          : undefined,
        lossReason: parsed.data.lossReason,
        lossReasonDetails: parsed.data.lossReasonDetails,
        usedCallAngleIds: parsed.data.usedCallAngleIds,
      },
      { livePhone, hashSecret: config.hashSecret },
    );
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return leadDomainErrorResponse(error);
  }
}
