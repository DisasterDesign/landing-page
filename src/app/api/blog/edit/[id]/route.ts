import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { updateBlogPostSchema } from "@/lib/validations";

// PATCH - protected: update blog post
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
    const parsed = updateBlogPostSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const existing = await prisma.blogPost.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Verify ownership: only the author can edit their post
    if (existing.authorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const data: Record<string, unknown> = { ...parsed.data };

    // If publishing for the first time, set publishedAt
    if (parsed.data.published === true && !existing.publishedAt) {
      data.publishedAt = new Date();
    }

    // Keep `status` in sync when `published` is explicitly toggled,
    // unless the caller explicitly set `status` in the same payload.
    if (parsed.data.published === true && parsed.data.status === undefined) {
      data.status = "PUBLISHED";
    } else if (
      parsed.data.published === false &&
      parsed.data.status === undefined
    ) {
      data.status = "DRAFT";
    }

    const post = await prisma.blogPost.update({
      where: { id },
      data,
      include: {
        author: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(post);
  } catch (error) {
    console.error("Error updating blog post:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - protected: delete blog post
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const existing = await prisma.blogPost.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Verify ownership: only the author can delete their post
    if (existing.authorId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.blogPost.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting blog post:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
