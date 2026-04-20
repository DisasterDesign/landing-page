import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";

// POST - Auth required: add comment to task
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    if (!body.content?.trim()) {
      return NextResponse.json(
        { error: "Comment content is required" },
        { status: 400 }
      );
    }

    const comment = await prisma.comment.create({
      data: {
        content: body.content,
        taskId: id,
        authorId: session.user.id!,
      },
      include: {
        author: { select: { id: true, name: true } },
      },
    });

    const task = await prisma.task.findUnique({
      where: { id },
      select: { title: true, assignees: { select: { id: true } } },
    });
    if (task) {
      const actorId = session.user.id;
      await Promise.all(
        task.assignees.map((a) =>
          createNotification(
            {
              recipientId: a.id,
              type: "TASK_COMMENTED",
              title: `${comment.author.name} הוסיף תגובה`,
              body: task.title,
              taskId: id,
            },
            actorId
          )
        )
      );
    }

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error("Error creating comment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
