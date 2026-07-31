import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner, viewerErrorResponse } from "@/lib/auth/viewer";
import { scheduleBlogPostSchema } from "@/lib/validations";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireOwner();

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
    const authResponse = viewerErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Error scheduling blog post:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
