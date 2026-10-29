import { getViewer, viewerErrorResponse } from "@/lib/auth/viewer";
import { financeLeadScope } from "@/lib/finance/lead-access";
import { financeTaskScope } from "@/lib/finance/task-access";
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

    const viewer = await getViewer();
    const taskFinanceScope = await financeTaskScope(viewer);
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
      prisma.task.count({ where: { AND: [taskFinanceScope], status: "TODO" } }),
      prisma.task.count({ where: { AND: [taskFinanceScope], status: "DONE" } }),
      prisma.task.count({
        where: { AND: [taskFinanceScope], status: "TODO", assignees: { some: { id: session.user.id } } },
      }),
      prisma.contactSubmission.count({ where: { isRead: false, ...financeLeadScope(viewer) } }),
      prisma.task.count({
        where: {
          AND: [taskFinanceScope],
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
    const accessError = viewerErrorResponse(error); if (accessError) return accessError;
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
