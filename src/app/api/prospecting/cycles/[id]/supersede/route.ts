import { NextResponse } from "next/server";
import { z } from "zod";

import { requireProspectingAdmin } from "@/lib/prospecting/admin-auth";
import { supersedePublishedCycle } from "@/lib/prospecting/replacement";

const bodySchema = z.object({
  reason: z.string().trim().min(5).max(500),
});

/**
 * Admin action: replace a PUBLISHED cycle's batch — invalidates its
 * still-open prospects, marks the cycle superseded, and spins up the
 * replacement cycle for a fresh territory proposal.
 *
 * supersedePublishedCycle existed since the sales-fit overhaul but had NO
 * caller — the Dizengoff replacement was done by a one-off script that was
 * deleted. This makes the mechanism operable from the admin dashboard.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireProspectingAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "reason is required (5-500 chars)" },
      { status: 400 },
    );
  }
  const { id } = await params;
  try {
    const result = await supersedePublishedCycle(id, parsed.data.reason);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Supersede failed";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
