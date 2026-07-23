import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { requirePersistedLeadReadRole } from "@/lib/leads/authorization";
import { getLeadLifecycleConfig } from "@/lib/leads/config";
import { LeadDomainError } from "@/lib/leads/errors";
import { leadDomainErrorResponse } from "@/lib/leads/http";
import {
  claimLead,
  qualifyLeadFromLegacyClosed,
} from "@/lib/leads/lifecycle";
import { getSellerLeadDetail } from "@/lib/leads/projection";
import { legacyStatusForStage } from "@/lib/leads/stage-machine";

const patchSchema = z
  .object({
    action: z.enum(["claim", "release"]).optional(),
    status: z.enum(["NEW", "IN_PROGRESS", "CLOSED", "LOST", "SPAM"]).optional(),
  })
  .strict()
  .refine((value) => Number(Boolean(value.action)) + Number(Boolean(value.status)) === 1, {
    message: "Exactly one legacy action is required",
  });

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
    const lead = await getSellerLeadDetail({
      id,
      sellerId: session.user.id,
    });
    if (getLeadLifecycleConfig().enabled) {
      return NextResponse.json(lead);
    }
    return NextResponse.json({
      id: lead.id,
      name: lead.name ?? lead.company ?? "ליד ללא שם",
      email: lead.email ?? "",
      phone: lead.phone,
      company: lead.company,
      service: lead.service,
      message: lead.message ?? "",
      status: legacyStatusForStage(lead.stage),
      source: lead.sourceKey,
      createdAt: lead.createdAt,
      nextFollowUpAt: lead.nextFollowUpAt,
      assignees: lead.owner ? [lead.owner] : [],
      notes: lead.notes,
    });
  } catch (error) {
    return leadDomainErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = patchSchema.safeParse(
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
    if (parsed.data.action === "release") {
      return NextResponse.json(
        { error: "Seller release is not allowed" },
        { status: 405 },
      );
    }
    if (parsed.data.action === "claim") {
      return NextResponse.json(
        await claimLead({ leadId: id, sellerId: session.user.id }),
      );
    }
    if (parsed.data.status === "CLOSED") {
      return NextResponse.json(
        await qualifyLeadFromLegacyClosed({
          leadId: id,
          actor: { userId: session.user.id, role: "SELLER" },
        }),
      );
    }
    throw new LeadDomainError(
      "CONFLICT",
      "Use the canonical interaction or stage action for this status",
    );
  } catch (error) {
    return leadDomainErrorResponse(error);
  }
}
