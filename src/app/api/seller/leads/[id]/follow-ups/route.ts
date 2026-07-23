import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import {
  completeFollowUp,
  rescheduleFollowUp,
  scheduleFollowUp,
} from "@/lib/leads/follow-ups";
import { leadDomainErrorResponse } from "@/lib/leads/http";
import {
  leadFollowUpCompleteSchema,
  leadFollowUpRescheduleSchema,
  leadFollowUpScheduleSchema,
} from "@/lib/validations";

const mutationSchema = z.discriminatedUnion("action", [
  leadFollowUpRescheduleSchema.extend({
    action: z.literal("reschedule"),
  }),
  leadFollowUpCompleteSchema.extend({
    action: z.literal("complete"),
  }),
]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = leadFollowUpScheduleSchema.safeParse(
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
    const followUp = await scheduleFollowUp({
      leadId: id,
      dueAt: new Date(parsed.data.dueAt),
      reason: parsed.data.reason,
      actor: { userId: session.user.id, role: "SELLER" },
    });
    return NextResponse.json({ followUp }, { status: 201 });
  } catch (error) {
    return leadDomainErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = mutationSchema.safeParse(
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
    const actor = { userId: session.user.id, role: "SELLER" as const };
    const followUp =
      parsed.data.action === "reschedule"
        ? await rescheduleFollowUp({
            leadId: id,
            followUpId: parsed.data.followUpId,
            dueAt: new Date(parsed.data.dueAt),
            reason: parsed.data.reason,
            actor,
          })
        : await completeFollowUp({
            leadId: id,
            followUpId: parsed.data.followUpId,
            actor,
          });
    return NextResponse.json({ followUp });
  } catch (error) {
    return leadDomainErrorResponse(error);
  }
}

export function DELETE() {
  return NextResponse.json(
    { error: "Lead follow-ups are append-only lifecycle records" },
    { status: 405 },
  );
}
