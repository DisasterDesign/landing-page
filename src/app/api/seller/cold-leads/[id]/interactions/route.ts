import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProspectingConfig } from "@/lib/prospecting/config";
import { GooglePlacesProspectingProvider } from "@/lib/prospecting/places";
import { hashSuppressionValue, normalizeDomain, normalizePhone } from "@/lib/prospecting/suppression";
import { prospectInteractionSchema } from "@/lib/validations";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sellerId = session.user.id;
  const { id } = await params;
  const parsed = prospectInteractionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const prospect = await prisma.prospect.findFirst({
    where: { id, assignedSellerId: sellerId, qualityScore: { lte: 4 } },
  });
  if (!prospect) return NextResponse.json({ error: "Cold lead not found" }, { status: 404 });

  const now = new Date();
  const nextFollowUpAt = parsed.data.nextFollowUpAt
    ? new Date(parsed.data.nextFollowUpAt)
    : ["NO_ANSWER", "CALLBACK"].includes(parsed.data.outcome)
      ? new Date(now.getTime() + 24 * 60 * 60 * 1_000)
      : null;
  const nextStatus = {
    NO_ANSWER: "FOLLOW_UP",
    CALLBACK: "FOLLOW_UP",
    CONNECTED: "PUBLISHED",
    INTERESTED: "QUALIFIED",
    NOT_INTERESTED: "NOT_INTERESTED",
    WRONG_NUMBER: "INVALID",
    DO_NOT_CALL: "DO_NOT_CALL",
  }[parsed.data.outcome] as
    | "FOLLOW_UP"
    | "PUBLISHED"
    | "QUALIFIED"
    | "NOT_INTERESTED"
    | "INVALID"
    | "DO_NOT_CALL";

  let livePhone: string | null = null;
  if (parsed.data.outcome === "DO_NOT_CALL") {
    const config = getProspectingConfig();
    if (config.placesApiKey) {
      livePhone =
        (
          await new GooglePlacesProspectingProvider({
            apiKey: config.placesApiKey,
            maxDiscoveredPerCycle: 1,
            maxPlacesCallsPerCycle: 1,
          }).getLiveDetails([prospect.placeId])
        ).get(prospect.placeId)?.nationalPhoneNumber ?? null;
    }
  }

  const config = getProspectingConfig();
  if (parsed.data.outcome === "DO_NOT_CALL" && !config.hashSecret) {
    return NextResponse.json(
      { error: "Suppression hashing is not configured" },
      { status: 503 },
    );
  }
  const interaction = await prisma.$transaction(async (transaction) => {
    if (parsed.data.outcome === "DO_NOT_CALL") {
      const phoneHash = livePhone
        ? hashSuppressionValue(normalizePhone(livePhone), config.hashSecret)
        : null;
      const domainHash = prospect.auditedDomain
        ? hashSuppressionValue(normalizeDomain(prospect.auditedDomain), config.hashSecret)
        : null;
      const existing = await transaction.prospectSuppression.findFirst({
        where: {
          OR: [
            { placeId: prospect.placeId },
            ...(phoneHash ? [{ phoneHash }] : []),
            ...(domainHash ? [{ domainHash }] : []),
          ],
        },
      });
      if (existing) {
        await transaction.prospectSuppression.update({
          where: { id: existing.id },
          data: { reason: parsed.data.note || "Seller requested do not call" },
        });
      } else {
        await transaction.prospectSuppression.create({
          data: {
            placeId: prospect.placeId,
            phoneHash,
            domainHash,
            reason: parsed.data.note || "Seller requested do not call",
            sourceProspectId: prospect.id,
            createdById: sellerId,
          },
        });
      }
    }

    const created = await transaction.prospectInteraction.create({
      data: {
        prospectId: prospect.id,
        authorId: sellerId,
        outcome: parsed.data.outcome,
        note: parsed.data.note,
        nextFollowUpAt,
      },
    });
    await transaction.prospect.update({
      where: { id: prospect.id },
      data: { status: nextStatus, lastContactedAt: now, nextFollowUpAt },
    });
    return created;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  return NextResponse.json({ interaction, status: nextStatus });
}
