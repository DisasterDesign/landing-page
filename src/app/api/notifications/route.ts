import { getViewer, viewerErrorResponse } from "@/lib/auth/viewer";
import { financeTaskScope } from "@/lib/finance/task-access";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const viewer = await getViewer();
    const taskScope = await financeTaskScope(viewer);
    const leadScope = { agreements: { none: { financeBook: { not: "SHARED" as const } } } };
    const financeWhere = viewer.isOwner ? {} : { AND: [
      { OR: [{ taskId: null }, { task: taskScope }] },
      { OR: [{ leadId: null }, { lead: leadScope }] },
      { OR: [{ type: { not: "AGREEMENT_SIGNED" as const } }, { dedupeKey: { startsWith: "finance:SHARED:" } }, { leadId: { not: null }, lead: leadScope }] },
    ] };
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { recipientId: session.user.id, ...financeWhere },
        orderBy: { createdAt: "desc" },
        take: 30,
        include: {
          task: { select: { id: true, title: true } },
        },
      }),
      prisma.notification.count({
        where: { recipientId: session.user.id, readAt: null, ...financeWhere },
      }),
    ]);

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    const accessError = viewerErrorResponse(error); if (accessError) return accessError;
    console.error("Error fetching notifications:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await prisma.notification.updateMany({
      where: { recipientId: session.user.id, readAt: null },
      data: { readAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const accessError = viewerErrorResponse(error); if (accessError) return accessError;
    console.error("Error marking notifications read:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { count } = await prisma.notification.deleteMany({
      where: { recipientId: session.user.id },
    });

    return NextResponse.json({ success: true, deleted: count });
  } catch (error) {
    const accessError = viewerErrorResponse(error); if (accessError) return accessError;
    console.error("Error deleting notifications:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
