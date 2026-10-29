import { getViewer, viewerErrorResponse } from "@/lib/auth/viewer";
import { requireFinanceTaskAccess } from "@/lib/finance/task-access";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createCommentSchema } from "@/lib/validations";

// POST - Auth required: create comment
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createCommentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    await requireFinanceTaskAccess(await getViewer(), parsed.data.taskId);
    const comment = await prisma.comment.create({
      data: {
        content: parsed.data.content,
        taskId: parsed.data.taskId,
        authorId: session.user.id!,
      },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    const accessError = viewerErrorResponse(error); if (accessError) return accessError;
    console.error("Error creating comment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
