"use client";

import Link from "next/link";
import toast from "react-hot-toast";
import DOMPurify from "isomorphic-dompurify";
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
    <div className="min-h-screen bg-black">
      {/* Cover Image Hero */}
      {post.coverImage && (
        <div className="relative w-full h-[40vh] md:h-[50vh]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.coverImage}
            alt={post.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />
        </div>
      )}

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
                <span className="text-gray-500">
                  {new Date(post.publishedAt).toLocaleDateString("he-IL", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
              )}
              <span className="text-gray-500">{post.author.name}</span>
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
              className="prose prose-invert prose-lg max-w-none
                prose-headings:font-bold prose-headings:text-white
                prose-h2:text-2xl prose-h2:mt-10 prose-h2:mb-4
                prose-h3:text-xl prose-h3:mt-8 prose-h3:mb-3
                prose-p:text-gray-300 prose-p:leading-relaxed
                prose-a:text-cyan prose-a:no-underline hover:prose-a:underline
                prose-strong:text-white
                prose-ul:text-gray-300 prose-ol:text-gray-300
                prose-blockquote:border-pink prose-blockquote:text-gray-400
                prose-code:text-pink prose-code:bg-gray-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded
                prose-pre:bg-gray-900 prose-pre:border prose-pre:border-gray-700
                prose-img:rounded-xl"
              dir="rtl"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(post.content) }}
            />
          </ScrollReveal>

          {/* Tags */}
          {post.tags.length > 0 && (
            <ScrollReveal delay={0.3}>
              <div className="flex flex-wrap gap-2 mt-12 pt-8 border-t border-gray-800">
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-gray-800 text-gray-400 text-xs px-3 py-1.5 rounded-full"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </ScrollReveal>
          )}

          {/* Share Buttons */}
          <ScrollReveal delay={0.3}>
            <div className="flex items-center gap-3 mt-8 pt-8 border-t border-gray-800">
              <span className="text-sm text-gray-500">שתף:</span>
              <button
                onClick={handleWhatsAppShare}
                className="bg-green-900/30 hover:bg-green-900/50 text-green-400 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              >
                WhatsApp
              </button>
              <button
                onClick={handleCopyLink}
                className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              >
                העתק קישור
              </button>
            </div>
          </ScrollReveal>

          {/* Previous / Next */}
          {(prevPost || nextPost) && (
            <ScrollReveal delay={0.4}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-12 pt-8 border-t border-gray-800">
                {prevPost ? (
                  <Link
                    href={`/blog/${prevPost.slug}`}
                    className="group bg-gray-900 border border-gray-800 rounded-xl p-5 transition-all hover:border-gray-600 hover:-translate-y-0.5"
                  >
                    <span className="text-xs text-gray-500 block mb-1">
                      מאמר קודם
                    </span>
                    <span className="text-sm font-medium text-white group-hover:text-pink transition-colors">
                      {prevPost.title}
                    </span>
                  </Link>
                ) : (
                  <div />
                )}
                {nextPost ? (
                  <Link
                    href={`/blog/${nextPost.slug}`}
                    className="group bg-gray-900 border border-gray-800 rounded-xl p-5 transition-all hover:border-gray-600 hover:-translate-y-0.5 text-left"
                  >
                    <span className="text-xs text-gray-500 block mb-1">
                      מאמר הבא
                    </span>
                    <span className="text-sm font-medium text-white group-hover:text-pink transition-colors">
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
              className="text-gray-500 hover:text-white text-sm transition-colors"
            >
              &larr; חזרה לבלוג
            </Link>
          </div>
        </div>
      </article>
    </div>
  );
}
