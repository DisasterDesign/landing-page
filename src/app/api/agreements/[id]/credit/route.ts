import { NextResponse } from "next/server";
import { z } from "zod";

import { requireOwner, viewerErrorResponse } from "@/lib/auth/viewer";
import { changeAgreementCredit } from "@/lib/leads/agreement-lifecycle";
import { leadDomainErrorResponse } from "@/lib/leads/http";

const schema = z
  .object({
    creditedSellerId: z.string().min(1).max(200),
    reason: z.string().trim().min(3).max(500),
  })
  .strict();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId } = await requireOwner();
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { id } = await params;
    const agreement = await changeAgreementCredit({
      agreementId: id,
      creditedSellerId: parsed.data.creditedSellerId,
      reason: parsed.data.reason,
      actor: { userId, role: "ADMIN" },
    });
    return NextResponse.json({ agreement });
  } catch (error) {
    const auth = viewerErrorResponse(error);
    if (auth) return auth;
    return leadDomainErrorResponse(error);
  }
}
