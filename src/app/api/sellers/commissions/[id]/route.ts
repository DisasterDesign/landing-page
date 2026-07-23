import { NextRequest, NextResponse } from "next/server";
import { setSellerCommissionPayoutStatus } from "@/lib/leads/agreement-lifecycle";
import { leadDomainErrorResponse } from "@/lib/leads/http";
import { requireProspectingAdmin } from "@/lib/prospecting/admin-auth";
import { z } from "zod";

const patchSchema = z.object({ status: z.enum(["PENDING", "PAID"]) });

// PATCH - Admin: mark a commission paid / unpaid.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireProspectingAdmin();
    if (!admin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }

    const updated = await setSellerCommissionPayoutStatus({
      commissionId: id,
      status: parsed.data.status,
      actor: { userId: admin.id, role: "ADMIN" },
    });

    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      paidAt: updated.paidAt,
    });
  } catch (error) {
    return leadDomainErrorResponse(error);
  }
}
