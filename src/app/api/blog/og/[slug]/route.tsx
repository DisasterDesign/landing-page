import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { renderBlogPostOgImage, renderOgImage } from "@/lib/og-image";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const post = await prisma.blogPost.findUnique({
    where: { slug: decodeURIComponent(slug), published: true },
    select: { title: true, category: true },
  });

  if (!post) {
    return renderOgImage("Blog");
  }

  return renderBlogPostOgImage(post.title, post.category);
}
