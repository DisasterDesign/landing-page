import { prisma } from "@/lib/prisma";
import {
  renderBlogPostOgImage,
  renderOgImage,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
  OG_IMAGE_ALT,
} from "@/lib/og-image";

export const alt = OG_IMAGE_ALT;
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function Image({ params }: Props) {
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);

  const post = await prisma.blogPost.findUnique({
    where: { slug, published: true },
    select: { title: true, category: true },
  });

  if (!post) {
    return renderOgImage("Blog");
  }

  return renderBlogPostOgImage(post.title, post.category);
}
