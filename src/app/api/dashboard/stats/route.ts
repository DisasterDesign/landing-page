import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { startOfWeek, endOfWeek } from "date-fns";

// GET - Auth required: dashboard stats
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    const [
      openTasks,
      doneTasks,
      myOpenTasks,
      unreadContacts,
      tasksDueThisWeek,
    ] = await Promise.all([
      prisma.task.count({ where: { status: "TODO" } }),
      prisma.task.count({ where: { status: "DONE" } }),
      prisma.task.count({
        where: { status: "TODO", assignees: { some: { id: session.user.id } } },
      }),
      prisma.contactSubmission.count({ where: { isRead: false } }),
      prisma.task.count({
        where: {
          dueDate: { gte: weekStart, lte: weekEnd },
          status: "TODO",
        },
      }),
    ]);

    return NextResponse.json({
      tasks: {
        total: openTasks + doneTasks,
        TODO: openTasks,
        DONE: doneTasks,
      },
      myOpenTasks,
      unreadContacts,
      tasksDueThisWeek,
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
