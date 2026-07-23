import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { leadDomainErrorResponse } from "@/lib/leads/http";
import { transitionLeadStage } from "@/lib/leads/lifecycle";
import { prisma } from "@/lib/prisma";
import { leadStageCorrectionSchema } from "@/lib/validations";

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
  const parsed = leadStageCorrectionSchema.safeParse(
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
    const lead = await transitionLeadStage({
      leadId: id,
      toStage:
        parsed.data.action === "mark-lost"
          ? "LOST"
          : parsed.data.action === "mark-spam"
            ? "SPAM"
            : "CONTACTING",
      reason: parsed.data.reason,
      lossReason: parsed.data.lossReason,
      lossReasonDetails: parsed.data.lossReasonDetails,
      actor: { userId: session.user.id, role: "ADMIN" },
    });
    return NextResponse.json({ lead });
  } catch (error) {
    return leadDomainErrorResponse(error);
  }
}
