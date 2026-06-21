import { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";

/**
 * Rebuild at most hourly (ISR) so new posts/fonts appear without regenerating
 * on every crawl. Static-page lastModified values below are real per-page
 * change dates (not the request time), so crawlers get a stable, trustworthy
 * signal. Update a page's date here when its content actually changes.
 */
export const revalidate = 3600;

const SITE_URL = "https://www.fuzionwebz.com";

// Static pages with their real last-content-change date, priority and freq.
const staticPages = [
  { path: "", lastModified: "2026-06-21", priority: 1.0, changeFrequency: "weekly" as const },
  { path: "/about", lastModified: "2026-05-07", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/services", lastModified: "2026-05-08", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "/contact", lastModified: "2026-05-11", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "/faq", lastModified: "2026-03-31", priority: 0.6, changeFrequency: "monthly" as const },
  { path: "/portfolio", lastModified: "2026-05-07", priority: 0.8, changeFrequency: "weekly" as const },
  { path: "/blog", lastModified: "2026-06-21", priority: 0.9, changeFrequency: "daily" as const },
  { path: "/fonts", lastModified: "2026-03-31", priority: 0.8, changeFrequency: "weekly" as const },
  { path: "/privacy", lastModified: "2026-05-07", priority: 0.2, changeFrequency: "yearly" as const },
  { path: "/terms", lastModified: "2026-05-07", priority: 0.2, changeFrequency: "yearly" as const },
  { path: "/accessibility", lastModified: "2026-05-11", priority: 0.2, changeFrequency: "yearly" as const },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static pages — real per-page dates, NOT the request time.
  const staticEntries = staticPages.map(({ path, lastModified, priority, changeFrequency }) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
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
