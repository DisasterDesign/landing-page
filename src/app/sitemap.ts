import { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

/** Always regenerate — the sitemap must reflect the latest published posts. */
export const dynamic = "force-dynamic";

const SITE_URL = "https://www.fuzionwebz.com";

// Static pages with their priorities and change frequencies
const staticPages = [
  { path: "", priority: 1.0, changeFrequency: "weekly" as const },
  { path: "/about", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/services", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "/contact", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "/faq", priority: 0.6, changeFrequency: "monthly" as const },
  { path: "/portfolio", priority: 0.8, changeFrequency: "weekly" as const },
  { path: "/blog", priority: 0.9, changeFrequency: "daily" as const },
  { path: "/fonts", priority: 0.8, changeFrequency: "weekly" as const },
  { path: "/privacy", priority: 0.2, changeFrequency: "yearly" as const },
  { path: "/terms", priority: 0.2, changeFrequency: "yearly" as const },
  { path: "/accessibility", priority: 0.2, changeFrequency: "yearly" as const },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date().toISOString();

  // Static pages
  const staticEntries = staticPages.map(({ path, priority, changeFrequency }) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));

  // Dynamic blog posts
  let blogEntries: MetadataRoute.Sitemap = [];
  try {
    const blogPosts = await prisma.blogPost.findMany({
      where: { published: true },
      select: { slug: true, updatedAt: true },
    });
    blogEntries = blogPosts.map((post) => ({
      url: `${SITE_URL}/blog/${encodeURIComponent(post.slug)}`,
      lastModified: post.updatedAt.toISOString(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));
  } catch {
    // DB may not be available during build — continue with static entries
  }

  // Dynamic font families
  let fontEntries: MetadataRoute.Sitemap = [];
  try {
    const fontFamilies = await prisma.fontFamily.findMany({
      where: { published: true },
      select: { slug: true, updatedAt: true },
    });
    fontEntries = fontFamilies.map((font) => ({
      url: `${SITE_URL}/fonts/${encodeURIComponent(font.slug)}`,
      lastModified: font.updatedAt.toISOString(),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    }));
  } catch {
    // DB may not be available during build — continue with static entries
  }

  return [...staticEntries, ...blogEntries, ...fontEntries];
}
