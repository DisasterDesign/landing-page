import { MetadataRoute } from "next";

const SITE_URL = "https://www.fuzionwebz.com";

// Static pages with their priorities and change frequencies
const staticPages = [
  { path: "", priority: 1.0, changeFrequency: "weekly" as const },
  { path: "/about", priority: 0.7, changeFrequency: "monthly" as const },
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

  // TODO: When blog/portfolio/fonts have DB entries, fetch slugs here:
  // const blogPosts = await prisma.post.findMany({ where: { published: true }, select: { slug: true, updatedAt: true } });
  // const blogEntries = blogPosts.map(post => ({
  //   url: `${SITE_URL}/blog/${post.slug}`,
  //   lastModified: post.updatedAt.toISOString(),
  //   changeFrequency: "weekly" as const,
  //   priority: 0.7,
  // }));

  return [...staticEntries];
}
