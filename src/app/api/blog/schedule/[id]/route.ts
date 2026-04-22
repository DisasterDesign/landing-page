import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { scheduleBlogPostSchema } from "@/lib/validations";

export async function PATCH(
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
    const parsed = scheduleBlogPostSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await prisma.blogPost.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    if (existing.status !== "READY" && existing.status !== "SCHEDULED") {
      return NextResponse.json(
        {
          error:
            "Only posts with status READY or SCHEDULED can be scheduled/unscheduled",
        },
        { status: 400 }
      );
    }

    const { scheduledAt } = parsed.data;

    const post = await prisma.blogPost.update({
      where: { id },
      data:
        scheduledAt === null
          ? { scheduledAt: null, status: "READY" }
          : { scheduledAt: new Date(scheduledAt), status: "SCHEDULED" },
      include: {
        author: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(post);
  } catch (error) {
    console.error("Error scheduling blog post:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
