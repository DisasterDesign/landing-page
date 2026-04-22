import { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import BlogPostClient from "./BlogPostClient";

interface Props {
  params: Promise<{ slug: string }>;
}

async function getPost(slug: string) {
  const post = await prisma.blogPost.findUnique({
    where: { slug, published: true },
    include: {
      author: { select: { id: true, name: true } },
    },
  });
  return post;
}

async function getAdjacentPosts(publishedAt: Date) {
  const [prev, next] = await Promise.all([
    prisma.blogPost.findFirst({
      where: { published: true, publishedAt: { lt: publishedAt } },
      orderBy: { publishedAt: "desc" },
      select: { title: true, slug: true },
    }),
    prisma.blogPost.findFirst({
      where: { published: true, publishedAt: { gt: publishedAt } },
      orderBy: { publishedAt: "asc" },
      select: { title: true, slug: true },
    }),
  ]);
  return { prev, next };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: "מאמר לא נמצא" };

  return {
    title: post.metaTitle || `${post.title} | ${SITE_NAME}`,
    description: post.metaDesc || post.excerpt || undefined,
    alternates: {
      canonical: `${SITE_URL}/blog/${post.slug}`,
    },
    openGraph: {
      title: post.metaTitle || post.title,
      description: post.metaDesc || post.excerpt || undefined,
      url: `${SITE_URL}/blog/${post.slug}`,
      type: "article",
      publishedTime: post.publishedAt?.toISOString(),
      authors: [post.author.name],
      ...(post.coverImage ? { images: [{ url: post.coverImage }] } : {}),
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const adjacent = post.publishedAt
    ? await getAdjacentPosts(post.publishedAt)
    : { prev: null, next: null };

  const canonicalImage =
    post.coverImage || `${SITE_URL}/blog/${post.slug}/opengraph-image`;
  const plainExcerpt =
    post.excerpt ||
    post.content.replace(/<[^>]+>/g, "").trim().slice(0, 200);

  // Schema.org JSON-LD
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.metaDesc || post.excerpt || undefined,
    image: [canonicalImage],
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt.toISOString(),
    author: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/icon-white.svg`,
        width: 360,
        height: 360,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": `${SITE_URL}/blog/${post.slug}`,
    },
    inLanguage: "he",
    isPartOf: {
      "@type": "Blog",
      "@id": `${SITE_URL}/blog`,
    },
    articleBody: plainExcerpt,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <BlogPostClient
        post={{
          title: post.title,
          slug: post.slug,
          content: post.content,
          excerpt: post.excerpt,
          coverImage: post.coverImage,
          category: post.category,
          tags: post.tags,
          publishedAt: post.publishedAt?.toISOString() || null,
          author: post.author,
        }}
        prevPost={adjacent.prev}
        nextPost={adjacent.next}
      />
    </>
  );
}
