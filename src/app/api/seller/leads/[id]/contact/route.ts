import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { updateLeadContactDetails } from "@/lib/leads/corrections";
import { leadDomainErrorResponse } from "@/lib/leads/http";
import { leadContactCorrectionSchema } from "@/lib/validations";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = leadContactCorrectionSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  if (parsed.data.phone !== undefined && !parsed.data.confirmedBySeller) {
    return NextResponse.json(
      { error: "Seller confirmation is required for a phone number" },
      { status: 400 },
    );
  }

  try {
    const { id } = await params;
    const lead = await updateLeadContactDetails({
      leadId: id,
      details: {
        name: parsed.data.name,
        company: parsed.data.company,
        email: parsed.data.email,
        phone: parsed.data.phone,
      },
      confirmation: "SELLER_CONFIRMED",
      actor: { userId: session.user.id, role: "SELLER" },
    });
    return NextResponse.json({ lead });
  } catch (error) {
    return leadDomainErrorResponse(error);
  }
}
