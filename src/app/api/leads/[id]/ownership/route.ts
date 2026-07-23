import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { leadDomainErrorResponse } from "@/lib/leads/http";
import { releaseOrReassignLead } from "@/lib/leads/lifecycle";
import { leadOwnershipSchema } from "@/lib/validations";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = leadOwnershipSchema.safeParse(
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
    const actor = { userId: session.user.id, role: "ADMIN" as const };
    const lead =
      parsed.data.action === "reassign"
        ? await releaseOrReassignLead({
            action: "REASSIGN",
            leadId: id,
            sellerId: parsed.data.sellerId!,
            reason: parsed.data.reason,
            actor,
          })
        : await releaseOrReassignLead({
            action: "RELEASE",
            leadId: id,
            cancelFollowUps: parsed.data.cancelFollowUps,
            reason: parsed.data.reason,
            actor,
          });
    return NextResponse.json({ lead });
  } catch (error) {
    return leadDomainErrorResponse(error);
  }
}
