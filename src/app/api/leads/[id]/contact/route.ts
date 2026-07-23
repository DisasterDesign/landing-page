import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { updateLeadContactDetails } from "@/lib/leads/corrections";
import { leadDomainErrorResponse } from "@/lib/leads/http";

const schema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    company: z.string().trim().min(1).max(200).optional(),
    email: z.string().email().optional(),
    phone: z.string().trim().min(9).max(30).optional(),
    reason: z.string().trim().min(3).max(500),
  })
  .strict()
  .refine(
    (value) =>
      value.name !== undefined ||
      value.company !== undefined ||
      value.email !== undefined ||
      value.phone !== undefined,
    { message: "At least one contact detail is required" },
  );

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
    const { reason, ...details } = parsed.data;
    const lead = await updateLeadContactDetails({
      leadId: id,
      details,
      reason,
      confirmation: "ADMIN_CONFIRMED",
      actor: { userId: session.user.id, role: "ADMIN" },
    });
    return NextResponse.json({ lead });
  } catch (error) {
    return leadDomainErrorResponse(error);
  }
}
