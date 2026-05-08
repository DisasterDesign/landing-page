"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import ScrollReveal from "@/components/animations/ScrollReveal";

interface BlogPostData {
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  coverImage: string | null;
  category: string | null;
  tags: string[];
  publishedAt: string | null;
  author: { id: string; name: string };
}

interface AdjacentPost {
  title: string;
  slug: string;
}

interface Props {
  post: BlogPostData;
  prevPost: AdjacentPost | null;
  nextPost: AdjacentPost | null;
}

export default function BlogPostClient({ post, prevPost, nextPost }: Props) {
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";

  // Sanitize content client-side only to avoid jsdom SSR crash on Vercel.
  // Initial render shows raw post.content (authored via Tiptap admin editor, already trusted HTML);
  // after hydration, DOMPurify runs in the browser and replaces with sanitized HTML.
  const [sanitizedContent, setSanitizedContent] = useState<string>(post.content);

  useEffect(() => {
    let cancelled = false;
    import("dompurify").then((mod) => {
      if (cancelled) return;
      const DOMPurify = mod.default;
      setSanitizedContent(DOMPurify.sanitize(post.content));
    });
    return () => {
      cancelled = true;
    };
  }, [post.content]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("הקישור הועתק!");
    } catch {
      toast.error("לא ניתן להעתיק");
    }
  };

  const handleWhatsAppShare = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(
      `${post.title}\n${shareUrl}`
    )}`;
    window.open(url, "_blank");
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Cover Image Hero — falls back to generated OG card when coverImage is null */}
      <div className="relative w-full h-[40vh] md:h-[50vh]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={post.coverImage || `/api/blog/og/${post.slug}`}
          alt={post.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
      </div>

      <article className="py-16 md:py-24 px-6">
        <div className="max-w-3xl mx-auto">
          {/* Category + Date */}
          <ScrollReveal>
            <div className="flex flex-wrap items-center gap-3 mb-6 text-sm">
              {post.category && (
                <span className="bg-cyan/10 text-cyan px-3 py-1 rounded-full font-medium">
                  {post.category}
                </span>
              )}
              {post.publishedAt && (
                <span className="text-gray-600">
                  {new Date(post.publishedAt).toLocaleDateString("he-IL", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              )}
              <span className="text-gray-600">{post.author.name}</span>
            </div>
          </ScrollReveal>

          {/* Title */}
          <ScrollReveal delay={0.1}>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold mb-8 leading-tight">
              <span className="text-pink">{post.title.charAt(0)}</span>
              {post.title.slice(1)}
            </h1>
          </ScrollReveal>

          {/* Article Content */}
          <ScrollReveal delay={0.2}>
            <div
              className="prose prose prose-lg max-w-none
                prose-headings:font-bold prose-headings:text-black
                prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4
                prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
                prose-p:text-gray-700 prose-p:leading-relaxed
                prose-a:text-cyan prose-a:no-underline hover:prose-a:underline
                prose-strong:text-black
                prose-ul:text-gray-700 prose-ol:text-gray-700
                prose-blockquote:border-pink prose-blockquote:text-gray-700
                prose-code:text-pink prose-code:bg-gray-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
                prose-pre:bg-gray-50 prose-pre:border prose-pre:border-gray-300
                prose-img:rounded-xl"
              dir="rtl"
              dangerouslySetInnerHTML={{ __html: sanitizedContent }}
            />
          </ScrollReveal>

          {/* Tags */}
          {post.tags.length > 0 && (
            <ScrollReveal delay={0.3}>
              <div className="flex flex-wrap gap-2 mt-12 pt-8 border-t border-gray-200">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-gray-100 text-gray-700 text-xs px-3 py-1.5 rounded-full"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </ScrollReveal>
          )}

          {/* Share Buttons */}
          <ScrollReveal delay={0.3}>
            <div className="flex items-center gap-3 mt-8 pt-8 border-t border-gray-200">
              <span className="text-sm text-gray-600">שתף:</span>
              <button
                onClick={handleWhatsAppShare}
                className="bg-green-900/30 hover:bg-green-900/50 text-green-400 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              >
                WhatsApp
              </button>
              <button
                onClick={handleCopyLink}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              >
                העתק קישור
              </button>
            </div>
          </ScrollReveal>

          {/* Previous / Next */}
          {(prevPost || nextPost) && (
            <ScrollReveal delay={0.4}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-12 pt-8 border-t border-gray-200">
                {prevPost ? (
                  <Link
                    href={`/blog/${prevPost.slug}`}
                    className="group bg-gray-50 border border-gray-200 rounded-xl p-5 transition-all hover:border-gray-400 hover:-translate-y-0.5"
                  >
                    <span className="text-xs text-gray-600 block mb-1">
                      מאמר קודם
                    </span>
                    <span className="text-sm font-medium text-black group-hover:text-pink transition-colors">
                      {prevPost.title}
                    </span>
                  </Link>
                ) : (
                  <div />
                )}
                {nextPost ? (
                  <Link
                    href={`/blog/${nextPost.slug}`}
                    className="group bg-gray-50 border border-gray-200 rounded-xl p-5 transition-all hover:border-gray-400 hover:-translate-y-0.5 text-left"
                  >
                    <span className="text-xs text-gray-600 block mb-1">
                      מאמר הבא
                    </span>
                    <span className="text-sm font-medium text-black group-hover:text-pink transition-colors">
                      {nextPost.title}
                    </span>
                  </Link>
                ) : (
                  <div />
                )}
              </div>
            </ScrollReveal>
          )}

          {/* Back to blog */}
          <div className="text-center mt-12">
            <Link
              href="/blog"
              className="text-gray-600 hover:text-black text-sm transition-colors"
            >
              &larr; חזרה לבלוג
            </Link>
          </div>
        </div>
      </article>
    </div>
  );
}
