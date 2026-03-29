import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { startOfWeek, endOfWeek } from "date-fns";

// GET - Auth required: dashboard stats
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    const [
      tasksByStatus,
      projectCount,
      unreadContacts,
      tasksDueThisWeek,
    ] = await Promise.all([
      // Task counts by status
      prisma.task.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
      // Total project count
      prisma.project.count(),
      // Unread contact submissions
      prisma.contactSubmission.count({
        where: { isRead: false },
      }),
      // Tasks due this week
      prisma.task.count({
        where: {
          dueDate: {
            gte: weekStart,
            lte: weekEnd,
          },
          status: { not: "DONE" },
        },
      }),
    ]);

    // Transform task counts into an object
    const taskCounts = {
      TODO: 0,
      IN_PROGRESS: 0,
      REVIEW: 0,
      DONE: 0,
    };

    for (const group of tasksByStatus) {
      taskCounts[group.status] = group._count.id;
    }

    const totalTasks = Object.values(taskCounts).reduce((a, b) => a + b, 0);

    return NextResponse.json({
      tasks: {
        total: totalTasks,
        ...taskCounts,
      },
      projectCount,
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
