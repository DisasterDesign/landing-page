import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { createNotification } from "@/lib/notifications";
import { claimCommissionBriefTask } from "@/lib/leads/agreement-lifecycle";
import { leadDomainErrorResponse } from "@/lib/leads/http";

const briefSchema = z.object({
  agreementId: z.string().min(1),
  // Core free-text description (required)
  description: z.string().min(1, "תיאור חובה").max(5000),
  // Structured "דוח למפתח" fields (all optional)
  businessName: z.string().max(200).optional(),
  contactName: z.string().max(200).optional(),
  phone: z.string().max(40).optional(),
  businessField: z.string().max(300).optional(),
  domainName: z.string().max(200).optional(),
  contentStatus: z.string().max(500).optional(),
  designNotes: z.string().max(2000).optional(),
  extraNotes: z.string().max(2000).optional(),
});

/**
 * POST /api/seller/brief
 * A seller submits the developer report ("דוח למפתח") for a CLOSED+PAID deal.
 * Creates a Task assigned to the owner and links it to the seller's
 * commission row. Returns { taskId } for the image uploads.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const sellerId = session.user.id;

    const body = await request.json();
    const parsed = briefSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const d = parsed.data;

    // The report is allowed only for a closed deal that belongs to this seller.
    const commission = await prisma.sellerCommission.findFirst({
      where: { agreementId: d.agreementId, sellerId },
      select: { id: true, clientName: true, briefTaskId: true },
    });
    if (!commission) {
      return NextResponse.json(
        { error: "אין עסקה סגורה שלך עבור הסכם זה" },
        { status: 400 }
      );
    }
    if (commission.briefTaskId) {
      return NextResponse.json(
        { error: "הדוח כבר נשלח", taskId: commission.briefTaskId },
        { status: 409 }
      );
    }

    // Target: the owner's account.
    const owner = await prisma.user.findFirst({
      where: { isOwner: true },
      select: { id: true },
    });
    const assignees = owner ? [owner] : [];

    const lines: string[] = [];
    const add = (label: string, v?: string) => {
      if (v?.trim()) lines.push(`${label}: ${v.trim()}`);
    };
    add("שם העסק", d.businessName);
    add("איש קשר", d.contactName);
    add("טלפון", d.phone);
    add("תחום העסק", d.businessField);
    add("דומיין רצוי", d.domainName);
    add("חומרים קיימים", d.contentStatus);
    if (lines.length > 0) lines.push("");
    lines.push("תיאור האתר המבוקש:", d.description.trim());
    if (d.designNotes?.trim()) lines.push("", "הערות עיצוב:", d.designNotes.trim());
    if (d.extraNotes?.trim()) lines.push("", "הערות נוספות:", d.extraNotes.trim());
    lines.push("", `מוכר/ת: ${session.user.name ?? ""}`);

    const task = await prisma.task.create({
      data: {
        title: `דוח למפתח — ${commission.clientName}`,
        description: lines.join("\n"),
        tags: ["דוח למפתח", "מכירות"],
        creatorId: sellerId,
        assignees: { connect: assignees.map((a) => ({ id: a.id })) },
      },
      select: { id: true },
    });

    // Atomically claim the report slot (double-submit / two-tab guard).
    try {
      await claimCommissionBriefTask({
        commissionId: commission.id,
        taskId: task.id,
        actor: { userId: sellerId, role: "SELLER" },
      });
    } catch (error) {
      await prisma.task.delete({ where: { id: task.id } }).catch(() => {});
      return leadDomainErrorResponse(error);
    }

    await Promise.all(
      assignees.map((a) =>
        createNotification(
          {
            recipientId: a.id,
            type: "TASK_ASSIGNED",
            title: `📋 דוח למפתח חדש — ${commission.clientName}`,
            body: `מאת ${session.user?.name ?? "מוכר/ת"}`,
            taskId: task.id,
          },
          sellerId
        )
      )
    );

    return NextResponse.json({ taskId: task.id }, { status: 201 });
  } catch (error) {
    console.error("Error creating developer report:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
