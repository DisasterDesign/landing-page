import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { correctLeadSource } from "@/lib/leads/corrections";
import { leadDomainErrorResponse } from "@/lib/leads/http";
import { leadSourceCorrectionSchema } from "@/lib/validations";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = leadSourceCorrectionSchema.safeParse(
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
    const lead = await correctLeadSource({
      leadId: id,
      ...parsed.data,
      actor: { userId: session.user.id, role: "ADMIN" },
    });
    return NextResponse.json({ lead });
  } catch (error) {
    return leadDomainErrorResponse(error);
  }
}
