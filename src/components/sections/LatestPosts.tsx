import Link from "next/link";
import { prisma } from "@/lib/prisma";

/**
 * Server-rendered "from the blog" section. Surfaces the 3 latest posts as real
 * <a> links in the home-page HTML, giving crawlers an internal path to newly
 * published posts from the one page that is reliably indexed.
 */
export default async function LatestPosts() {
  let posts: {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    coverImage: string | null;
    category: string | null;
    publishedAt: Date | null;
  }[] = [];

  try {
    posts = await prisma.blogPost.findMany({
      where: { published: true },
      orderBy: { publishedAt: "desc" },
      take: 3,
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        coverImage: true,
        category: true,
        publishedAt: true,
      },
    });
  } catch {
    return null;
  }

  if (posts.length === 0) return null;

  return (
    <section className="bg-white py-14 md:py-20 px-6" dir="rtl">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-end justify-between gap-4 flex-wrap mb-10">
          <h2 className="text-[clamp(1.8rem,5vw,3rem)] font-extrabold text-black">
            מהבלוג
          </h2>
          <Link
            href="/blog"
            className="text-cyan hover:text-pink transition-colors text-sm font-bold"
          >
            לכל המאמרים ←
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {posts.map((post) => (
            <Link
              key={post.id}
              href={`/blog/${post.slug}`}
              className="group block rounded-2xl border border-gray-200 bg-gray-50 overflow-hidden transition-all duration-300 hover:border-gray-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(0,0,0,0.12)]"
            >
              <div className="aspect-video overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={post.coverImage || `/api/blog/og/${post.slug}`}
                  alt={post.title}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="p-5">
                {post.category && (
                  <span className="text-cyan text-xs font-bold uppercase tracking-wider">
                    {post.category}
                  </span>
                )}
                <h3 className="text-lg font-bold text-black mt-1.5 mb-2 transition-colors group-hover:text-pink">
                  {post.title}
                </h3>
                {post.excerpt && (
                  <p className="text-gray-600 text-sm line-clamp-2">{post.excerpt}</p>
                )}
                {post.publishedAt && (
                  <p className="text-gray-500 text-xs mt-3">
                    {new Date(post.publishedAt).toLocaleDateString("he-IL", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
