export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth";
import { getLeadLifecycleConfig } from "@/lib/leads/config";
import { LeadDomainError } from "@/lib/leads/errors";
import {
  rescheduleFollowUp,
  scheduleFollowUp,
} from "@/lib/leads/follow-ups";
import { leadDomainErrorResponse } from "@/lib/leads/http";
import { markLeadRead } from "@/lib/leads/lifecycle";
import { getAdminLeadDetail } from "@/lib/leads/projection";
import { legacyStatusForStage } from "@/lib/leads/stage-machine";
import { prisma } from "@/lib/prisma";

const patchSchema = z
  .object({
    status: z.enum(["NEW", "IN_PROGRESS", "CLOSED", "LOST", "SPAM"]).optional(),
    nextFollowUpAt: z.string().datetime({ offset: true }).nullable().optional(),
    isRead: z.boolean().optional(),
    action: z.enum(["claim", "release"]).optional(),
  })
  .strict();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const role = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (role?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const lead = await getAdminLeadDetail(id);
    if (getLeadLifecycleConfig().enabled) {
      return NextResponse.json(lead);
    }
    return NextResponse.json({
      id: lead.id,
      name: lead.name ?? lead.company ?? "ליד ללא שם",
      email: lead.email ?? "",
      phone: lead.phone,
      company: lead.company,
      message: lead.message ?? "",
      service: lead.service,
      isRead: lead.isRead,
      status: lead.stage
        ? legacyStatusForStage(lead.stage)
        : lead.legacyStatus,
      source: lead.sourceKey,
      nextFollowUpAt: lead.nextFollowUpAt,
      lastContactedAt: lead.lastContactedAt,
      closedAt: lead.closedAt,
      createdAt: lead.createdAt,
      assignees: lead.owner ? [lead.owner] : [],
      notes: lead.notes,
    });
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
  const parsed = patchSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const mutationCount = [
    parsed.data.status !== undefined,
    parsed.data.nextFollowUpAt !== undefined,
    parsed.data.isRead !== undefined,
    parsed.data.action !== undefined,
  ].filter(Boolean).length;
  if (mutationCount !== 1) {
    return NextResponse.json(
      { error: "Exactly one legacy action is required" },
      { status: 400 },
    );
  }

  try {
    const { id } = await params;
    const actor = { userId: session.user.id, role: "ADMIN" as const };
    if (parsed.data.isRead !== undefined) {
      return NextResponse.json(
        await markLeadRead({ leadId: id, isRead: parsed.data.isRead, actor }),
      );
    }
    if (parsed.data.nextFollowUpAt) {
      const active = await prisma.leadFollowUp.findFirst({
        where: { leadId: id, status: "SCHEDULED" },
        select: { id: true },
      });
      const dueAt = new Date(parsed.data.nextFollowUpAt);
      const reason = "פולואפ שהוגדר בממשק הישן";
      const followUp = active
        ? await rescheduleFollowUp({
            leadId: id,
            followUpId: active.id,
            dueAt,
            reason,
            actor,
          })
        : await scheduleFollowUp({ leadId: id, dueAt, reason, actor });
      return NextResponse.json({ followUp });
    }
    throw new LeadDomainError(
      "CONFLICT",
      parsed.data.action
        ? "Use the reasoned ownership endpoint"
        : parsed.data.nextFollowUpAt === null
          ? "Complete or reschedule the active follow-up explicitly"
          : "Use the canonical stage endpoint",
    );
  } catch (error) {
    return leadDomainErrorResponse(error);
  }
}

export function DELETE() {
  return NextResponse.json(
    { error: "Leads are permanent CRM history" },
    { status: 405 },
  );
}
