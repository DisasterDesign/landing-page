"use client";

import { useRef, useState } from "react";

/**
 * Showcase carousel for Fuzion's past work.
 *
 * ▸ TO ADD REAL EXAMPLES: drop files into /public/ormat/showcase/ and add an
 *   entry below. `src` plays an inline <video>; items without `src` render as
 *   an elegant "coming soon" placeholder. CSP is media-src 'self', so videos
 *   must be served from /public (same origin), not an external CDN.
 */
export interface ShowcaseItem {
  title: string;
  src?: string; // e.g. "/ormat/showcase/reel-1.mp4"
  poster?: string; // e.g. "/ormat/showcase/reel-1.jpg"
}

const SHOWCASE: ShowcaseItem[] = [
  { title: "דוגמה 1 — נוסיף בקרוב" },
  { title: "דוגמה 2 — נוסיף בקרוב" },
  { title: "דוגמה 3 — נוסיף בקרוב" },
];

export default function VideoCarousel() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const go = (dir: number) => {
    const next = Math.max(0, Math.min(SHOWCASE.length - 1, active + dir));
    setActive(next);
    const slide = trackRef.current?.children[next] as HTMLElement | undefined;
    slide?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };

  return (
    <div className="relative">
      <div
        ref={trackRef}
        className="flex gap-5 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-none"
        style={{ scrollbarWidth: "none" }}
      >
        {SHOWCASE.map((item, i) => (
          <div
            key={i}
            className="snap-center shrink-0 w-[80%] sm:w-[460px] aspect-video rounded-2xl overflow-hidden border border-black/[0.06] bg-white/70 shadow-sm"
          >
            {item.src ? (
              <video
                src={item.src}
                poster={item.poster}
                controls
                playsInline
                preload="metadata"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-pink/5 via-transparent to-cyan/10">
                <div className="w-14 h-14 rounded-full border border-black/10 flex items-center justify-center text-gray-400">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
                <span className="text-sm text-gray-500">{item.title}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mt-5">
        <div className="flex gap-1.5">
          {SHOWCASE.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === active ? "w-6 bg-gradient-to-r from-pink to-cyan-dark" : "w-1.5 bg-black/15"
              }`}
            />
          ))}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={active === 0}
            aria-label="הקודם"
            className="w-10 h-10 rounded-full border border-black/10 bg-white/70 flex items-center justify-center hover:border-pink disabled:opacity-30 transition-colors"
          >
            <span aria-hidden>→</span>
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            disabled={active === SHOWCASE.length - 1}
            aria-label="הבא"
            className="w-10 h-10 rounded-full border border-black/10 bg-white/70 flex items-center justify-center hover:border-cyan-dark disabled:opacity-30 transition-colors"
          >
            <span aria-hidden>←</span>
          </button>
        </div>
      </div>
    </div>
  );
}
