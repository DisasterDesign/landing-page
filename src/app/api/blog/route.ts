import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner, viewerErrorResponse } from "@/lib/auth/viewer";
import { createBlogPostSchema } from "@/lib/validations";

function generateSlug(title: string): string {
  return (
    title
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^\w\u0590-\u05FF-]/g, "")
      .toLowerCase() +
    "-" +
    Date.now().toString(36)
  );
}

// GET - public: list published posts (or all posts for the owner via ?all=true)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 12));
    const category = searchParams.get("category");
    const all = searchParams.get("all") === "true";
    const statusParam = searchParams.get("status");

    let showAll = false;
    if (all) {
      await requireOwner();
      showAll = true;
    }

    const where: Record<string, unknown> = {};
    if (!showAll) {
      where.published = true;
    }
    if (category) {
      where.category = category;
    }
    if (showAll && statusParam) {
      const allowed = ["DRAFT", "READY", "SCHEDULED", "PUBLISHED", "ARCHIVED"];
      if (allowed.includes(statusParam)) {
        where.status = statusParam;
      }
    }

    const [posts, total] = await Promise.all([
      prisma.blogPost.findMany({
        where,
        include: {
          author: { select: { id: true, name: true } },
        },
        orderBy: showAll ? { updatedAt: "desc" } : { publishedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.blogPost.count({ where }),
    ]);

    return NextResponse.json({
      posts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    const authResponse = viewerErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Error fetching blog posts:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - protected: create new blog post
export async function POST(request: NextRequest) {
  try {
    const { userId } = await requireOwner();

    const body = await request.json();
    const parsed = createBlogPostSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { slug, published, status, ...rest } = parsed.data;

    const finalSlug = slug?.trim() || generateSlug(rest.title);
    const finalStatus = status ?? (published ? "PUBLISHED" : "DRAFT");

    const post = await prisma.blogPost.create({
      data: {
        ...rest,
        slug: finalSlug,
        published: published ?? false,
        publishedAt: published ? new Date() : null,
        status: finalStatus,
        authorId: userId,
      },
      include: {
        author: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    const authResponse = viewerErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Error creating blog post:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
