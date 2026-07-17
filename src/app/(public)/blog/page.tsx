import { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { prisma } from "@/lib/prisma";
import BlogPageClient, { type BlogPost } from "./BlogPageClient";

// force-dynamic — SSR per request so the index always reflects the DB
// (cover images, freshly published posts). ISR (revalidate) proved unreliable
// in prod here (the sitemap went 59h stale), and a blog index must stay fresh.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "בלוג — טיפים ומדריכים לעיצוב אתרים",
  description:
    "הבלוג של Fuzion Webz — טיפים, מדריכים ותובנות בנושאי עיצוב אתרים, פיתוח, טרנדים וטיפים לשיווק דיגיטלי.",
  alternates: {
    canonical: `${SITE_URL}/blog`,
  },
  openGraph: {
    title: `בלוג | ${SITE_NAME}`,
    description: "טיפים, מדריכים ותובנות בנושאי עיצוב אתרים ושיווק דיגיטלי.",
    url: `${SITE_URL}/blog`,
  },
};

async function getInitialPosts(): Promise<BlogPost[]> {
  try {
    // ALL published posts — the index is the main internal-linking surface;
    // capping it (was take:12) left most posts crawlable only via the sitemap.
    const posts = await prisma.blogPost.findMany({
      where: { published: true },
      orderBy: { publishedAt: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        coverImage: true,
        category: true,
        publishedAt: true,
        author: { select: { id: true, name: true } },
      },
    });
    return posts.map((p) => ({
      ...p,
      publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
    }));
  } catch {
    return [];
  }
}

export default async function BlogPage() {
  const initialPosts = await getInitialPosts();
  const initialCategories = Array.from(
    new Set(initialPosts.map((p) => p.category).filter(Boolean) as string[])
  );

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "דף הבית", url: SITE_URL },
          { name: "בלוג", url: `${SITE_URL}/blog` },
        ]}
      />
      <BlogPageClient
        initialPosts={initialPosts}
        initialCategories={initialCategories}
      />
    </>
  );
}
