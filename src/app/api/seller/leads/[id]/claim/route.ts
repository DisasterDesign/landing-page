import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getLeadLifecycleConfig } from "@/lib/leads/config";
import { leadDomainErrorResponse } from "@/lib/leads/http";
import { claimLead } from "@/lib/leads/lifecycle";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const seller = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    if (seller?.role !== "SELLER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    const lead = await prisma.contactSubmission.findUnique({
      where: { id },
      select: { intentLevel: true },
    });
    if (
      lead?.intentLevel === "OUTBOUND" &&
      !getLeadLifecycleConfig().coldPreparationEnabled
    ) {
      return NextResponse.json(
        { error: "Cold lead preparation is disabled" },
        { status: 409 },
      );
    }
    const claimed = await claimLead({
      leadId: id,
      sellerId: session.user.id,
    });
    return NextResponse.json({ lead: claimed });
  } catch (error) {
    return leadDomainErrorResponse(error);
  }
}
