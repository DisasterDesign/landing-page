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
  const [page, setPage] = useState(0);
  const [perView, setPerView] = useState(3); // 3 cards on desktop, 1 on mobile

  useEffect(() => {
    // no-store so admin edits to the featured reviews appear immediately —
    // the heavy Places call is already cached server-side in KeyValue, so this
    // fetch is cheap and needn't be HTTP-cached.
    fetch("/api/reviews", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => setData(json))
      .catch(() => setData(null));
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => setPerView(mq.matches ? 3 : 1);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const reviews = data?.reviews ?? [];
  const pageCount = Math.max(1, Math.ceil(reviews.length / perView));
  // Keep the page valid when perView flips (desktop↔mobile) or data loads.
  useEffect(() => {
    setPage((p) => Math.min(p, pageCount - 1));
  }, [pageCount]);

  // Auto-advance a page every 6s when there is more than one page.
  useEffect(() => {
    if (pageCount <= 1) return;
    const t = setTimeout(() => setPage((p) => (p + 1) % pageCount), 6000);
    return () => clearTimeout(t);
  }, [page, pageCount]);

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
            {/* Carousel: perView cards per page (3 desktop / 1 mobile). The
                last page's start index is clamped to (length - perView) so a
                remainder page (e.g. 4 reviews over pages of 3) still shows a
                FULL window of cards instead of one lonely card. dir=ltr keeps
                the transform math predictable; card text stays centred. */}
            <div className="overflow-hidden" dir="ltr">
              <div
                className="flex transition-transform duration-500 ease-out"
                style={{
                  transform: `translateX(-${
                    Math.min(page * perView, Math.max(0, reviews.length - perView)) * (100 / perView)
                  }%)`,
                }}
              >
                {reviews.map((r, i) => (
                  <div
                    key={`${r.author}-${i}`}
                    className="shrink-0 px-2"
                    style={{ flex: `0 0 ${100 / perView}%`, maxWidth: `${100 / perView}%` }}
                  >
                    <div className="h-full bg-gray-50 border border-gray-200 rounded-2xl p-6 md:p-7 text-center flex flex-col">
                      <div className="flex justify-center mb-3">
                        <Stars value={r.rating} className="w-5 h-5" />
                      </div>
                      <p className="text-gray-800 text-sm md:text-base leading-relaxed whitespace-pre-wrap mb-5 flex-1">
                        “{r.text}”
                      </p>
                      <div className="flex items-center justify-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-pink/10 text-pink flex items-center justify-center font-bold text-sm shrink-0">
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

            {pageCount > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                {Array.from({ length: pageCount }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setPage(i)}
                    aria-label={`עמוד ${i + 1}`}
                    className={`h-2 rounded-full transition-all ${
                      i === page ? "w-6 bg-pink" : "w-2 bg-gray-300 hover:bg-gray-400"
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
