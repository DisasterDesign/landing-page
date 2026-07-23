import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { sellerLeadActionUrl } from "@/lib/leads/action-url";
import {
  requirePersistedLeadReadRole,
  sellerLeadScope,
} from "@/lib/leads/authorization";
import { leadDomainErrorResponse } from "@/lib/leads/http";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await requirePersistedLeadReadRole(session.user.id, ["ADMIN", "SELLER"]);
    const followUps = await prisma.leadFollowUp.findMany({
      where: {
        ownerId: session.user.id,
        status: "SCHEDULED",
        dueAt: { lte: new Date() },
        lead: { is: sellerLeadScope(session.user.id) },
      },
      select: {
        id: true,
        dueAt: true,
        reason: true,
        lead: {
          select: {
            id: true,
            name: true,
            company: true,
            intentLevel: true,
          },
        },
      },
      orderBy: [{ dueAt: "asc" }, { id: "asc" }],
      take: 20,
    });

    return NextResponse.json({
      followUps: followUps.map((followUp) => ({
        id: followUp.id,
        dueAt: followUp.dueAt,
        reason: followUp.reason,
        leadId: followUp.lead.id,
        leadName:
          followUp.lead.company ?? followUp.lead.name ?? "ליד ללא שם",
        url: sellerLeadActionUrl(followUp.lead),
      })),
    });
  } catch (error) {
    return leadDomainErrorResponse(error);
  }
}
