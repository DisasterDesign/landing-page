import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { requirePersistedLeadReadRole } from "@/lib/leads/authorization";
import { getLeadLifecycleConfig } from "@/lib/leads/config";
import { leadDomainErrorResponse } from "@/lib/leads/http";
import { getSellerLeadDetail } from "@/lib/leads/projection";
import { prisma } from "@/lib/prisma";
import { serializeCanonicalSellerProspect } from "@/lib/prospecting/seller-view";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await requirePersistedLeadReadRole(session.user.id, ["ADMIN", "SELLER"]);
    const { id } = await params;
    const config = getLeadLifecycleConfig();
    let leadId = id;
    if (!(config.enabled && config.coldPreparationEnabled)) {
      const prospect = await prisma.prospect.findUnique({
        where: { id },
        select: { promotedLeadId: true },
      });
      leadId = prospect?.promotedLeadId ?? id;
    }
    const lead = await getSellerLeadDetail({
      id: leadId,
      sellerId: session.user.id,
    });
    if (lead.intentLevel !== "OUTBOUND") {
      return NextResponse.json(
        { error: "Cold lead not found" },
        { status: 404 },
      );
    }
    return NextResponse.json(
      config.enabled && config.coldPreparationEnabled
        ? lead
        : serializeCanonicalSellerProspect(lead),
    );
  } catch (error) {
    return leadDomainErrorResponse(error);
  }
}
