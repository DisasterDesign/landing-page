import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { LeadDomainError } from "@/lib/leads/errors";
import { leadDomainErrorResponse } from "@/lib/leads/http";
import {
  claimLead,
  qualifyLeadFromLegacyClosed,
} from "@/lib/leads/lifecycle";

const patchSchema = z
  .object({
    action: z.enum(["claim", "release"]).optional(),
    status: z.enum(["NEW", "IN_PROGRESS", "CLOSED", "LOST", "SPAM"]).optional(),
  })
  .strict()
  .refine((value) => Number(Boolean(value.action)) + Number(Boolean(value.status)) === 1, {
    message: "Exactly one legacy action is required",
  });

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
