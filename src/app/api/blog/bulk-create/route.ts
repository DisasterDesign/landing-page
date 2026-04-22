import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { bulkCreateBlogPostSchema } from "@/lib/validations";
import { generateBlogSlug } from "@/lib/blog-slug";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = bulkCreateBlogPostSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const adminUser = await prisma.user.findFirst({
      where: { role: "ADMIN" },
      select: { id: true },
    });

    if (!adminUser) {
      return NextResponse.json(
        { error: "No admin user found" },
        { status: 500 }
      );
    }

    const data = parsed.data.posts.map((post) => {
      const { slug, ...rest } = post;
      return {
        title: rest.title,
        content: rest.content,
        excerpt: rest.excerpt,
        coverImage: rest.coverImage,
        category: rest.category,
        tags: rest.tags ?? [],
        metaTitle: rest.metaTitle,
        metaDesc: rest.metaDesc,
        targetKeyword: rest.targetKeyword,
        keywords: rest.keywords ?? [],
        slug: slug?.trim() || generateBlogSlug(rest.title),
        status: "DRAFT" as const,
        published: false,
        authorId: adminUser.id,
      };
    });

    const result = await prisma.blogPost.createMany({
      data,
      skipDuplicates: true,
    });

    const createdSlugs = data.map((d) => d.slug);
    const posts = await prisma.blogPost.findMany({
      where: { slug: { in: createdSlugs } },
      select: { id: true, slug: true, title: true },
    });

    return NextResponse.json(
      { created: result.count, posts },
      { status: 201 }
    );
  } catch (error) {
    console.error("Bulk create blog posts error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
