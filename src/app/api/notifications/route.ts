import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { recipientId: session.user.id },
        orderBy: { createdAt: "desc" },
        take: 30,
        include: {
          task: { select: { id: true, title: true } },
        },
      }),
      prisma.notification.count({
        where: { recipientId: session.user.id, readAt: null },
      }),
    ]);

    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
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
    console.error("Error marking notifications read:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
