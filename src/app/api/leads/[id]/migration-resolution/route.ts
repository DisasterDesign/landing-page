import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { resolveLeadMigrationReview } from "@/lib/leads/corrections";
import { leadDomainErrorResponse } from "@/lib/leads/http";

const schema = z
  .object({
    intentLevel: z.enum(["OUTBOUND", "AD_RESPONSE", "INBOUND"]),
    sourceKey: z.string().trim().min(1).max(100),
    externalLeadId: z.string().trim().min(1).max(300).optional(),
    sourceSnapshot: z.record(z.string(), z.unknown()),
    stage: z
      .enum([
        "NEW",
        "PREPARING",
        "CONTACTING",
        "QUALIFIED",
        "AGREEMENT_DRAFT",
        "AGREEMENT_SENT",
        "AGREEMENT_SIGNED",
        "LOST",
        "SPAM",
      ])
      .optional(),
    ownerId: z.string().min(1).max(200).nullable(),
    eligibleSellerId: z.string().min(1).max(200),
    reason: z.string().trim().min(3).max(500),
  })
  .strict();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  try {
    const { id } = await params;
    const lead = await resolveLeadMigrationReview({
      leadId: id,
      ...parsed.data,
      version: 1,
      actor: { userId: session.user.id, role: "ADMIN" },
    });
    return NextResponse.json({ lead });
  } catch (error) {
    return leadDomainErrorResponse(error);
  }
}
