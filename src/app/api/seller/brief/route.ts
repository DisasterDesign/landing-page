import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { createNotification } from "@/lib/notifications";

const briefSchema = z.object({
  agreementId: z.string().min(1),
  description: z.string().min(1, "תיאור חובה").max(5000),
  phone: z.string().max(40).optional(),
});

/**
 * POST /api/seller/brief
 * A seller submits the site brief for a CLOSED deal. Creates a Task assigned
 * to all admins (so it lands in the admin task board with images + the
 * "copy everything" brief), and links it to the seller's commission row.
 * Returns { taskId } so the client can then upload images to it.
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
    const { agreementId, description, phone } = parsed.data;

    // The brief is allowed only for a closed deal that belongs to this seller.
    const commission = await prisma.sellerCommission.findFirst({
      where: { agreementId, sellerId },
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
        { error: "בריף כבר נשלח", taskId: commission.briefTaskId },
        { status: 409 }
      );
    }

    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true },
    });

    const bodyLines = [description.trim()];
    if (phone?.trim()) bodyLines.push("", `טלפון: ${phone.trim()}`);
    bodyLines.push("", `מוכר/ת: ${session.user.name ?? ""}`);

    const task = await prisma.task.create({
      data: {
        title: `בריף אתר — ${commission.clientName}`,
        description: bodyLines.join("\n"),
        tags: ["בריף", "מכירות"],
        creatorId: sellerId,
        assignees: { connect: admins.map((a) => ({ id: a.id })) },
      },
      select: { id: true, title: true },
    });

    // Atomically claim the brief slot. If a concurrent submit (double-click,
    // two tabs) already set briefTaskId, this matches 0 rows — drop the orphan
    // task and bail so admins don't get a duplicate.
    const claimed = await prisma.sellerCommission.updateMany({
      where: { id: commission.id, briefTaskId: null },
      data: { briefTaskId: task.id },
    });
    if (claimed.count === 0) {
      await prisma.task.delete({ where: { id: task.id } }).catch(() => {});
      return NextResponse.json({ error: "בריף כבר נשלח" }, { status: 409 });
    }

    // Notify the admins (skips the actor automatically; sellers aren't admins).
    await Promise.all(
      admins.map((a) =>
        createNotification(
          {
            recipientId: a.id,
            type: "TASK_ASSIGNED",
            title: `בריף אתר חדש — ${commission.clientName}`,
            body: `מאת ${session.user?.name ?? "מוכר/ת"}`,
            taskId: task.id,
          },
          sellerId
        )
      )
    );

    return NextResponse.json({ taskId: task.id }, { status: 201 });
  } catch (error) {
    console.error("Error creating seller brief:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
