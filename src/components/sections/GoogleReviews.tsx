"use client";

import { useEffect, useState } from "react";
import ScrollReveal from "@/components/animations/ScrollReveal";

interface Review {
  author: string;
  authorPhoto: string | null;
  rating: number;
  text: string;
  relativeTime: string;
}

interface ReviewsPayload {
  available: boolean;
  rating?: number;
  count?: number;
  reviews?: Review[];
  writeReviewUrl?: string;
  allReviewsUrl?: string;
}

function Stars({ value, className = "w-5 h-5" }: { value: number; className?: string }) {
  return (
    <div className="flex gap-0.5" aria-label={`${value} מתוך 5 כוכבים`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          viewBox="0 0 24 24"
          className={`${className} ${i <= Math.round(value) ? "fill-amber-400" : "fill-gray-200"}`}
        >
          <path d="M12 2l2.955 6.354 6.955.874-5.116 4.79 1.318 6.882L12 17.53 5.888 20.9l1.318-6.882-5.116-4.79 6.955-.874L12 2z" />
        </svg>
      ))}
    </div>
  );
}

/**
 * Live social proof from the Google Business Profile — rating, count and a
 * few real reviews, pulled through /api/reviews (server-cached). Renders
 * NOTHING until the API key is configured and data flows, so shipping this
 * ahead of the key is safe.
 */
export default function GoogleReviews() {
  const [data, setData] = useState<ReviewsPayload | null>(null);

  useEffect(() => {
    fetch("/api/reviews")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => setData(json))
      .catch(() => setData(null));
  }, []);

  if (!data?.available || !data.rating || !data.count) return null;

  const shown = (data.reviews ?? []).slice(0, 3);

  return (
    // Hugs the client-logos strip above (both are social proof, so they read
    // as one block) with a normal gap below — avoids the doubled py-32 band.
    <section className="relative bg-white pt-4 pb-20 md:pt-6 md:pb-28 px-6">
      <div className="max-w-6xl mx-auto">
        <ScrollReveal>
          <div className="text-center mb-10">
            <h2 className="text-4xl md:text-6xl font-extrabold mb-4">
              לקוחות <span className="text-pink">ממליצים</span>
            </h2>
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <span className="text-5xl font-extrabold text-black">{data.rating.toFixed(1)}</span>
              <div className="text-right">
                <Stars value={data.rating} />
                <a
                  href={data.allReviewsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-gray-500 hover:text-pink transition-colors"
                >
                  {data.count} ביקורות בגוגל
                </a>
              </div>
            </div>
          </div>
        </ScrollReveal>

        {shown.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            {shown.map((r, i) => (
              <ScrollReveal key={`${r.author}-${i}`} delay={i * 0.1}>
                <div className="h-full bg-gray-50 border border-gray-200 rounded-2xl p-6 flex flex-col">
                  <div className="flex items-center gap-3 mb-3">
                    {r.authorPhoto ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.authorPhoto}
                        alt=""
                        width={40}
                        height={40}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-pink/10 text-pink flex items-center justify-center font-bold">
                        {r.author.slice(0, 1)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-black text-sm truncate">{r.author}</p>
                      <p className="text-xs text-gray-500">{r.relativeTime}</p>
                    </div>
                  </div>
                  <Stars value={r.rating} className="w-4 h-4" />
                  <p className="text-gray-700 text-sm mt-3 line-clamp-5 whitespace-pre-wrap">
                    {r.text}
                  </p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        )}

        <ScrollReveal delay={0.2}>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <a
              href={data.writeReviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-pink text-white rounded-full font-bold hover:bg-pink/85 transition-colors"
            >
              עבדנו יחד? כתבו לנו ביקורת
            </a>
            <a
              href={data.allReviewsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 border border-gray-300 text-gray-700 rounded-full font-bold hover:border-black hover:text-black transition-colors"
            >
              לכל הביקורות בגוגל
            </a>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
