"use client";

import { useEffect, useRef, useState } from "react";
import ScrollReveal from "@/components/animations/ScrollReveal";
import {
  HERO_PROJECTS as HEROES,
  WORK_PROJECTS as WORKS,
  type GalleryProject as Project,
} from "@/lib/portfolio-data";

/**
 * Works gallery — a calm, uniform landscape grid so every project reads at
 * the same weight and the visitor can actually browse. Two big hero cards
 * lead (the priority clients), then one consistent 16:10 grid for the rest.
 * No portrait/tall tiles — those broke the rhythm and made scanning hard.
 * Videos cost 0 bytes at load (preload=none / mount-on-hover).
 */

/* ---------- Data lives in src/lib/portfolio-data.ts (shared with /portfolio) ---------- */

/* ---------- Shared media helpers ---------- */

/**
 * Hero autoplay coordinator. Each hero reports whether it wants to play
 * (>=35% visible); reconcile() then plays up to the cap and — crucially —
 * PROMOTES a waiting hero whenever a slot frees. Without this, a hero denied
 * at its threshold crossing would stay frozen forever (IO only fires on
 * crossings, not when capacity opens).
 */
const heroWants = new Map<HTMLVideoElement, boolean>();
const playingHeroes = new Set<HTMLVideoElement>();
function heroCap(): number {
  return window.matchMedia("(pointer: coarse)").matches ? 1 : 2;
}
function reconcileHeroes() {
  const cap = heroCap();
  for (const [v, wants] of heroWants) {
    if (!wants && playingHeroes.has(v)) {
      playingHeroes.delete(v);
      v.pause();
    }
  }
  for (const [v, wants] of heroWants) {
    if (wants && !playingHeroes.has(v) && playingHeroes.size < cap) {
      playingHeroes.add(v);
      v.play().catch(() => {});
    }
  }
}

function useHoverCapable(): boolean {
  const [capable, setCapable] = useState(false);
  useEffect(() => {
    setCapable(window.matchMedia("(hover: hover) and (pointer: fine)").matches);
  }, []);
  return capable;
}

/** SSR-safe reduced-motion: false on server AND first client render (no
 *  hydration mismatch), flips after mount if the user prefers reduced. */
function useReducedMotionSafe(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);
  return reduced;
}

/** Hero media: poster + in-view autoplay video (capped, zero bytes at load). */
function HeroMedia({ project, allowVideo }: { project: Project; allowVideo: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !allowVideo) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          heroWants.set(v, entry.isIntersecting && entry.intersectionRatio >= 0.3);
        }
        reconcileHeroes();
      },
      { threshold: [0, 0.35] }
    );
    io.observe(v);
    return () => {
      heroWants.delete(v);
      playingHeroes.delete(v);
      io.disconnect();
      reconcileHeroes();
    };
  }, [allowVideo]);

  return (
    <>
      {project.poster && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={project.poster}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
        />
      )}
      {project.video && allowVideo && (
        <video
          ref={videoRef}
          src={project.video}
          poster={project.poster}
          muted
          loop
          playsInline
          preload="none"
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
    </>
  );
}

/** Grid media: poster; video mounts on first hover (desktop only). */
function HoverMedia({ project, hoverCapable }: { project: Project; hoverCapable: boolean }) {
  const [wanted, setWanted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  return (
    <div
      className="absolute inset-0"
      onMouseEnter={() => {
        if (!hoverCapable || !project.video) return;
        setWanted(true);
        videoRef.current?.play().catch(() => {});
      }}
      onMouseLeave={() => {
        const v = videoRef.current;
        if (!v) {
          // Fast swipe: leave fired before the video committed — cancel the
          // mount request or an invisible video would loop forever.
          setWanted(false);
          return;
        }
        v.pause();
        v.currentTime = 0;
      }}
    >
      {project.poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={project.poster}
          alt=""
          loading="lazy"
          decoding="async"
          className={`absolute inset-0 w-full h-full transition-transform duration-500 group-hover:scale-[1.04] ${
            project.contain ? "object-contain p-8" : "object-cover"
          }`}
        />
      ) : (
        // No media → the name fills the gradient so the tile never looks empty.
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <span className="text-white/90 text-xl font-extrabold text-center">{project.name}</span>
        </div>
      )}
      {project.video && wanted && (
        <video
          ref={videoRef}
          src={project.video}
          poster={project.poster}
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        />
      )}
    </div>
  );
}

/* ---------- Cards ---------- */

/** Chromatic brand layers that slide out behind the card on hover. */
function ChromaticHalo({ radius }: { radius: string }) {
  return (
    <>
      <div
        aria-hidden="true"
        className={`absolute inset-0 ${radius} bg-cyan/70 transition-transform duration-300 group-hover:translate-x-[7px] group-hover:-translate-y-[7px] pointer-events-none`}
      />
      <div
        aria-hidden="true"
        className={`absolute inset-0 ${radius} bg-pink/70 transition-transform duration-300 group-hover:-translate-x-[7px] group-hover:translate-y-[7px] pointer-events-none`}
      />
    </>
  );
}

function VisitPill() {
  return (
    <span
      dir="ltr"
      className="absolute top-3 left-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-white/90 backdrop-blur px-3 py-1.5 text-[11px] font-bold text-black opacity-0 -translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:translate-y-0 transition-all duration-300"
    >
      VISIT SITE <span aria-hidden="true">↗</span>
    </span>
  );
}

function HeroCard({ project, allowVideo }: { project: Project; allowVideo: boolean }) {
  return (
    <div className="relative group h-full">
      <ChromaticHalo radius="rounded-3xl" />
      <a
        href={project.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${project.name} — ${project.description} (נפתח בכרטיסייה חדשה)`}
        data-cursor="view"
        className="relative block h-full overflow-hidden rounded-3xl transition-transform duration-300 group-hover:-translate-y-1.5 focus-visible:outline-2 focus-visible:outline-pink focus-visible:outline-offset-4 aspect-[16/10]"
        style={{ background: project.gradient }}
      >
        <HeroMedia project={project} allowVideo={allowVideo} />
        <VisitPill />
        {/* Overlay caption */}
        <div className="absolute inset-x-0 bottom-0 h-[45%] bg-gradient-to-t from-black/60 via-black/20 to-transparent pointer-events-none" />
        <div className="absolute inset-x-0 bottom-0 p-5 md:p-7 text-right pointer-events-none">
          <h3 className="text-2xl md:text-4xl font-extrabold text-white">{project.name}</h3>
          <p className="text-white/70 text-sm md:text-base mt-1">{project.description}</p>
        </div>
      </a>
    </div>
  );
}

function WorkCard({ project, hoverCapable }: { project: Project; hoverCapable: boolean }) {
  return (
    <div className="relative group h-full">
      <ChromaticHalo radius="rounded-2xl" />
      <a
        href={project.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${project.name} — ${project.description} (נפתח בכרטיסייה חדשה)`}
        data-cursor="view"
        className="relative flex flex-col h-full overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 transition-transform duration-300 group-hover:-translate-y-1.5 focus-visible:outline-2 focus-visible:outline-pink focus-visible:outline-offset-4"
      >
        <div className="relative aspect-[16/10] overflow-hidden" style={{ background: project.gradient }}>
          <HoverMedia project={project} hoverCapable={hoverCapable} />
          <VisitPill />
        </div>
        <div className="px-5 py-4 text-right">
          <h3 className="text-base md:text-lg font-extrabold text-black transition-colors group-hover:text-pink">
            {project.name}
          </h3>
          <p className="text-gray-600 text-sm mt-0.5 line-clamp-1">{project.description}</p>
        </div>
      </a>
    </div>
  );
}

/** Stable module-level reveal wrapper — defining this inline inside Portfolio
 *  would give it a new identity per render and remount every card. */
function Reveal({
  reduced,
  children,
  delay,
  className,
}: {
  reduced: boolean;
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <ScrollReveal delay={delay} className={className}>
      {children}
    </ScrollReveal>
  );
}

/* ---------- Section ---------- */

export default function Portfolio() {
  const reduced = useReducedMotionSafe();
  const hoverCapable = useHoverCapable();
  const allowVideo = !reduced;

  return (
    <section id="portfolio" className="relative bg-white py-24 md:py-32 px-4 md:px-6">
      <div className="max-w-[1400px] mx-auto">
        <Reveal reduced={reduced}>
          <div className="text-center mb-14 md:mb-20">
            <h2
              className="chromatic-hover chromatic-always text-[clamp(2rem,6vw,4.5rem)] font-extrabold text-black w-full"
              data-text="העבודות שלנו"
            >
              העבודות שלנו
            </h2>
            <p className="text-gray-600 text-base md:text-lg mt-4 max-w-xl mx-auto">
              אתרים חיים שאנחנו בונים ומלווים — לחצו על כל עבודה לביקור באתר
            </p>
          </div>
        </Reveal>

        {/* Hero pair — the two lead clients */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          {HEROES.map((p, i) => (
            <Reveal reduced={reduced} key={p.id} delay={i * 0.1}>
              <HeroCard project={p} allowVideo={allowVideo} />
            </Reveal>
          ))}
        </div>

        {/* Uniform landscape grid — every other work at equal weight */}
        <div className="mt-6 md:mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
          {WORKS.map((p, i) => (
            <Reveal reduced={reduced} key={p.id} delay={(i % 3) * 0.07}>
              <WorkCard project={p} hoverCapable={hoverCapable && !reduced} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
