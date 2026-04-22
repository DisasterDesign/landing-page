"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ScrollReveal from "@/components/animations/ScrollReveal";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  category: string | null;
  publishedAt: string | null;
  author: { id: string; name: string };
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function BlogPageClient() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    async function fetchPosts() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(page), limit: "12" });
        if (category) params.set("category", category);
        const res = await fetch(`/api/blog?${params}`);
        if (res.ok) {
          const data = await res.json();
          setPosts(data.posts || []);
          setPagination(data.pagination || null);

          // Extract unique categories from posts for filter tabs
          if (!category && page === 1) {
            const cats = Array.from(
              new Set(
                (data.posts as BlogPost[])
                  .map((p) => p.category)
                  .filter(Boolean) as string[]
              )
            );
            setCategories((prev) => {
              const merged = Array.from(new Set([...prev, ...cats]));
              return merged;
            });
          }
        }
      } catch (err) {
        console.error("Failed to fetch posts:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchPosts();
  }, [page, category]);

  return (
    <div className="min-h-screen bg-black">
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <ScrollReveal>
            <h1 className="chromatic-hover chromatic-always text-[clamp(2rem,6vw,4.5rem)] font-extrabold text-center text-white w-full mb-6" data-text="הבלוג">
              הבלוג
            </h1>
          </ScrollReveal>
          <ScrollReveal delay={0.2}>
            <p className="text-gray-400 text-lg md:text-xl text-center max-w-2xl mx-auto mb-12">
              תוכן מקצועי בנושאי עיצוב, פיתוח ושיווק דיגיטלי
            </p>
          </ScrollReveal>

          {/* Category filter tabs */}
          {categories.length > 0 && (
            <ScrollReveal delay={0.3}>
              <div className="flex flex-wrap justify-center gap-3 mb-12">
                <button
                  onClick={() => {
                    setCategory("");
                    setPage(1);
                  }}
                  className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
                    !category
                      ? "bg-pink text-white border-pink"
                      : "bg-transparent text-gray-400 border-gray-700 hover:border-gray-500 hover:text-white"
                  }`}
                >
                  הכל
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      setCategory(cat);
                      setPage(1);
                    }}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border ${
                      category === cat
                        ? "bg-pink text-white border-pink"
                        : "bg-transparent text-gray-400 border-gray-700 hover:border-gray-500 hover:text-white"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </ScrollReveal>
          )}

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className="bg-gray-900 border border-gray-800 rounded-2xl p-6 animate-pulse"
                >
                  <div className="aspect-video bg-gray-800 rounded-xl mb-4" />
                  <div className="h-4 bg-gray-800 rounded w-20 mb-3" />
                  <div className="h-6 bg-gray-800 rounded w-3/4 mb-2" />
                  <div className="h-4 bg-gray-800 rounded w-full" />
                </div>
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-gray-500 text-lg">
                {category ? "אין מאמרים בקטגוריה זו" : "אין מאמרים עדיין. בקרוב!"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
              {posts.map((post, i) => (
                <ScrollReveal key={post.id} delay={i * 0.08}>
                  <Link href={`/blog/${post.slug}`} className="group block">
                    <div className="relative">
                      {/* Chromatic offset layers */}
                      <div className="absolute inset-0 translate-x-1.5 translate-y-1.5 bg-cyan/20 rounded-2xl transition-transform duration-300 group-hover:translate-x-2.5 group-hover:translate-y-2.5 pointer-events-none" />
                      <div className="absolute inset-0 -translate-x-1.5 -translate-y-1.5 bg-pink/20 rounded-2xl transition-transform duration-300 group-hover:-translate-x-2.5 group-hover:-translate-y-2.5 pointer-events-none" />

                      {/* Main card */}
                      <div className="relative bg-gray-900 border border-gray-800 rounded-2xl p-6 transition-all duration-300 group-hover:border-gray-600 group-hover:-translate-y-1">
                        {/* Cover image — falls back to generated OG card when coverImage is null */}
                        <div className="aspect-video rounded-xl mb-4 overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={post.coverImage || `/blog/${post.slug}/opengraph-image`}
                            alt={post.title}
                            loading="lazy"
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        </div>

                        {/* Category badge */}
                        {post.category && (
                          <span className="text-cyan text-xs font-bold uppercase tracking-wider">
                            {post.category}
                          </span>
                        )}

                        {/* Title */}
                        <h2 className="text-lg font-bold text-white mt-2 mb-2 transition-colors group-hover:text-pink">
                          {post.title}
                        </h2>

                        {/* Excerpt */}
                        {post.excerpt && (
                          <p className="text-gray-400 text-sm line-clamp-2 mb-4">
                            {post.excerpt}
                          </p>
                        )}

                        {/* Date + Author */}
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          {post.publishedAt && (
                            <span>
                              {new Date(post.publishedAt).toLocaleDateString("he-IL", {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              })}
                            </span>
                          )}
                          <span className="w-1 h-1 rounded-full bg-gray-600" />
                          <span>{post.author.name}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                </ScrollReveal>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-16">
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map(
                (p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-11 h-11 rounded-full text-sm font-medium transition-colors ${
                      page === p
                        ? "bg-pink text-white"
                        : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
