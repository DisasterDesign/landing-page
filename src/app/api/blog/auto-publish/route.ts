import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createBlogPostSchema } from "@/lib/validations";

/**
 * Auto-publish endpoint for scheduled blog post publishing.
 * Authenticates via BLOG_API_KEY environment variable instead of session.
 *
 * Usage:
 *   POST /api/blog/auto-publish
 *   Authorization: Bearer <BLOG_API_KEY>
 *   Body: { title, content, slug?, excerpt?, category?, tags?, metaTitle?, metaDesc?, published? }
 */

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

export async function POST(request: NextRequest) {
    try {
          // Verify API key
          const authHeader = request.headers.get("authorization");
          const apiKey = process.env.BLOG_API_KEY;

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

          // Find admin user for authorId
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

          const body = await request.json();
          const parsed = createBlogPostSchema.safeParse(body);

          if (!parsed.success) {
                  return NextResponse.json(
                            { error: "Validation failed", details: parsed.error.flatten() },
                            { status: 400 }
                          );
                }

          const { slug, published, ...rest } = parsed.data;
          const finalSlug = slug?.trim() || generateSlug(rest.title);

          const post = await prisma.blogPost.create({
                  data: {
                            ...rest,
                            slug: finalSlug,
                            published: published ?? true, // Default to published for auto-publish
                            publishedAt: new Date(),
                            authorId: adminUser.id,
                          },
                });

          return NextResponse.json(
                  { success: true, id: post.id, slug: post.slug, title: post.title },
                  { status: 201 }
                );
        } catch (error) {
          console.error("Auto-publish error:", error);
          return NextResponse.json(
                  { error: "Internal server error" },
                  { status: 500 }
                );
        }
  }
