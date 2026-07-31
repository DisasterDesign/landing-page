import { NextRequest, NextResponse } from "next/server";
import { setSellerCommissionPayoutStatus } from "@/lib/leads/agreement-lifecycle";
import { leadDomainErrorResponse } from "@/lib/leads/http";
import { requireOwner, viewerErrorResponse } from "@/lib/auth/viewer";
import { z } from "zod";

const patchSchema = z.object({ status: z.enum(["PENDING", "PAID"]) });

// PATCH - Owner: mark a commission paid / unpaid.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await requireOwner();

    const { id } = await params;
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }

    const updated = await setSellerCommissionPayoutStatus({
      commissionId: id,
      status: parsed.data.status,
      actor: { userId, role: "ADMIN" },
    });

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      paidAt: updated.paidAt,
    });
  } catch (error) {
    const auth = viewerErrorResponse(error);
    if (auth) return auth;
    return leadDomainErrorResponse(error);
  }
}
