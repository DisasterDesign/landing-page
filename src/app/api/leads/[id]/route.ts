export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createNotification, notifyAllAdmins } from "@/lib/notifications";

const patchSchema = z.object({
  status: z.enum(["NEW", "IN_PROGRESS", "CLOSED", "LOST", "SPAM"]).optional(),
  nextFollowUpAt: z.string().nullable().optional(), // ISO date or null
  isRead: z.boolean().optional(),
  assigneeIds: z.array(z.string()).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const lead = await prisma.contactSubmission.findUnique({
      where: { id },
      include: {
        notes: {
          orderBy: { createdAt: "asc" },
          include: { author: { select: { id: true, name: true } } },
        },
        assignees: { select: { id: true, name: true } },
      },
    });
    if (!lead) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(lead);
  } catch (error) {
    console.error("Lead get error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Load the previous state so we can decide whether the follow-up date
    // actually changed (and thus whether to fire a notification), and whether
    // this PATCH is transitioning the lead INTO CLOSED for the first time.
    const before = await prisma.contactSubmission.findUnique({
      where: { id },
      select: { nextFollowUpAt: true, name: true, status: true, closedAt: true },
    });
    if (!before) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (parsed.data.status !== undefined) {
      data.status = parsed.data.status;
      if (parsed.data.status !== "NEW") data.isRead = true;
      // Stamp closedAt the moment a lead transitions into CLOSED so the
      // "נסגרו החודש" summary card has a real timestamp to filter on.
      // Reverting out of CLOSED leaves closedAt as-is (history of last close).
      if (
        parsed.data.status === "CLOSED" &&
        before.status !== "CLOSED" &&
        !before.closedAt
      ) {
        data.closedAt = new Date();
      }
    }
    if (parsed.data.isRead !== undefined) data.isRead = parsed.data.isRead;
    if (parsed.data.nextFollowUpAt !== undefined) {
      data.nextFollowUpAt = parsed.data.nextFollowUpAt
        ? new Date(parsed.data.nextFollowUpAt)
        : null;
    }
    if (parsed.data.assigneeIds !== undefined) {
      data.assignees = {
        set: parsed.data.assigneeIds.map((id) => ({ id })),
      };
    }

    const lead = await prisma.contactSubmission.update({
      where: { id },
      data,
      include: { assignees: { select: { id: true, name: true } } },
    });

    // Fire LEAD_FOLLOWUP only when nextFollowUpAt was set or rescheduled.
    // (Pure assignee changes stay silent — user spec.)
    const incomingDate = parsed.data.nextFollowUpAt;
    if (incomingDate !== undefined) {
      const beforeMs = before.nextFollowUpAt
        ? new Date(before.nextFollowUpAt).getTime()
        : null;
      const afterMs = incomingDate ? new Date(incomingDate).getTime() : null;
      const dateChanged = beforeMs !== afterMs;
      if (dateChanged && afterMs !== null) {
        const title = `פולואפ: ${lead.name}`;
        const body = `תאריך: ${new Date(afterMs).toLocaleDateString("he-IL")}`;
        const actorId = session.user.id;
        if (lead.assignees.length > 0) {
          await Promise.all(
            lead.assignees.map((a) =>
              createNotification(
                {
                  recipientId: a.id,
                  type: "LEAD_FOLLOWUP",
                  title,
                  body,
                  leadId: lead.id,
                },
                actorId
              )
            )
          );
        } else {
          await notifyAllAdmins(
            {
              type: "LEAD_FOLLOWUP",
              title,
              body,
              leadId: lead.id,
            },
            actorId
          );
        }
      }
    }

    return NextResponse.json(lead);
  } catch (error) {
    console.error("Lead patch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    await prisma.contactSubmission.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Lead delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
