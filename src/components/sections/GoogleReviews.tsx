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
  const [index, setIndex] = useState(0);

  useEffect(() => {
    fetch("/api/reviews")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => setData(json))
      .catch(() => setData(null));
  }, []);

  const reviews = data?.reviews ?? [];

  // Auto-advance the carousel every 5s (pauses implicitly on manual dot click
  // by resetting the timer via `index` dependency).
  useEffect(() => {
    if (reviews.length <= 1) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % reviews.length), 5000);
    return () => clearTimeout(t);
  }, [index, reviews.length]);

  if (!data?.available || !data.rating || !data.count) return null;

  return (
    // Hugs the client-logos strip above (both are social proof, so they read
    // as one block) with a normal gap below — avoids the doubled py-32 band.
    <section className="relative bg-white pt-2 pb-14 md:pt-4 md:pb-20 px-6">
      <div className="max-w-6xl mx-auto">
        <ScrollReveal>
          <div className="text-center mb-10">
            <h2
              className="chromatic-hover chromatic-always text-[clamp(2rem,6vw,4.5rem)] font-extrabold text-center text-black w-full mb-4"
              data-text="לקוחות ממליצים"
            >
              לקוחות ממליצים
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

        {reviews.length > 0 && (
          <div className="mb-10">
            {/* Carousel: one card in view, sliding. dir=ltr keeps the transform
                math predictable; the centred card text stays legible either way. */}
            <div className="overflow-hidden max-w-2xl mx-auto" dir="ltr">
              <div
                className="flex transition-transform duration-500 ease-out"
                style={{ transform: `translateX(-${index * 100}%)` }}
              >
                {reviews.map((r, i) => (
                  <div key={`${r.author}-${i}`} className="w-full shrink-0 px-2">
                    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 md:p-8 text-center">
                      <div className="flex justify-center mb-3">
                        <Stars value={r.rating} className="w-5 h-5" />
                      </div>
                      <p className="text-gray-800 text-base md:text-lg leading-relaxed whitespace-pre-wrap mb-5">
                        “{r.text}”
                      </p>
                      <div className="flex items-center justify-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-pink/10 text-pink flex items-center justify-center font-bold text-sm">
                          {r.author.slice(0, 1)}
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-black text-sm">{r.author}</p>
                          {r.relativeTime ? (
                            <p className="text-xs text-gray-500">{r.relativeTime}</p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {reviews.length > 1 && (
              <div className="flex items-center justify-center gap-2 mt-5">
                {reviews.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setIndex(i)}
                    aria-label={`ביקורת ${i + 1}`}
                    className={`h-2 rounded-full transition-all ${
                      i === index ? "w-6 bg-pink" : "w-2 bg-gray-300 hover:bg-gray-400"
                    }`}
                  />
                ))}
              </div>
            )}
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
