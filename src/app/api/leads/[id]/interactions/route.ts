import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { leadDomainErrorResponse } from "@/lib/leads/http";
import { recordInteraction } from "@/lib/leads/interactions";
import { prisma } from "@/lib/prisma";
import { leadInteractionSchema } from "@/lib/validations";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (admin?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
    const result = await recordInteraction({
      leadId: id,
      actor: { userId: session.user.id, role: "ADMIN" },
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
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return leadDomainErrorResponse(error);
  }
}
