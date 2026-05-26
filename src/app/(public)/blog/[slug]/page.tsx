import { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
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

/**
 * If the requested slug doesn't match a current post, fall back to `oldSlug`.
 * When that hits, we 308-permanent-redirect to the canonical slug — preserves
 * the rankings Google built up against the URL-encoded Hebrew slugs that the
 * old generateSlug produced.
 */
async function findRedirectTarget(slug: string): Promise<string | null> {
  const stale = await prisma.blogPost.findFirst({
    where: { oldSlug: slug, published: true },
    select: { slug: true },
  });
  return stale?.slug ?? null;
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
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);
  const post = await getPost(slug);
  // Don't waste a 404 metadata payload on a stale slug — let the page handler
  // run the redirect. Generating bare metadata here is fine for both cases.
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
  const { slug: rawSlug } = await params;
  const slug = decodeURIComponent(rawSlug);
  const post = await getPost(slug);
  if (!post) {
    const target = await findRedirectTarget(slug);
    if (target) permanentRedirect(`/blog/${target}`);
    notFound();
  }

  const adjacent = post.publishedAt
    ? await getAdjacentPosts(post.publishedAt)
    : { prev: null, next: null };

  const canonicalImage =
    post.coverImage || `${SITE_URL}/api/blog/og/${post.slug}`;
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
