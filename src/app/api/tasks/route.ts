import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createTaskSchema } from "@/lib/validations";
import { createNotification } from "@/lib/notifications";
import { Prisma } from "@prisma/client";

// GET - Auth required: list tasks with filters
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const projectId = searchParams.get("projectId");
    const assigneeId = searchParams.get("assigneeId");
    const priority = searchParams.get("priority");

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.TaskWhereInput = {};

    if (status) where.status = status as Prisma.EnumTaskStatusFilter;
    if (projectId) where.projectId = projectId;
    if (assigneeId) where.assigneeId = assigneeId;
    if (priority) where.priority = priority as Prisma.EnumPriorityFilter;

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: {
          project: { select: { id: true, name: true } },
          assignee: { select: { id: true, name: true, email: true } },
          creator: { select: { id: true, name: true, email: true } },
          _count: { select: { comments: true } },
        },
        orderBy: [{ order: "asc" }, { createdAt: "desc" }],
        skip,
        take: limit,
      }),
      prisma.task.count({ where }),
    ]);

    return NextResponse.json({
      data: tasks,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Error fetching tasks:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Auth required: create task
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createTaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { dueDate, ...rest } = parsed.data;

    const task = await prisma.task.create({
      data: {
        ...rest,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        creatorId: session.user.id!,
      },
      include: {
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, email: true } },
        creator: { select: { id: true, name: true, email: true } },
      },
    });

    if (task.assigneeId) {
      await createNotification(
        {
          recipientId: task.assigneeId,
          type: "TASK_ASSIGNED",
          title: "משימה חדשה שויכה אליך",
          body: task.title,
          taskId: task.id,
        },
        session.user.id
      );
    }

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error("Error creating task:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
