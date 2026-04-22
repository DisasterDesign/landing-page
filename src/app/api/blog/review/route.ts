import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { reviewBlogPostSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const apiKey = process.env.BLOG_API_KEY || "";

    if (!apiKey) {
      console.error("BLOG_API_KEY not configured");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    if (!authHeader || authHeader !== `Bearer ${apiKey}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = reviewBlogPostSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { postId, contentScore, reviewNotes } = parsed.data;

    const existing = await prisma.blogPost.findUnique({
      where: { id: postId },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    const post = await prisma.blogPost.update({
      where: { id: postId },
      data: {
        contentScore,
        reviewNotes: reviewNotes ?? null,
        lastReviewedAt: new Date(),
      },
      select: { id: true, title: true, contentScore: true },
    });

    return NextResponse.json({
      success: true,
      id: post.id,
      title: post.title,
      contentScore: post.contentScore,
    });
  } catch (error) {
    console.error("Blog review error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
