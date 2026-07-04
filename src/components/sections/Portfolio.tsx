"use client";

import { useEffect, useRef, useState } from "react";
import ScrollReveal from "@/components/animations/ScrollReveal";

/**
 * Works gallery — a calm, uniform landscape grid so every project reads at
 * the same weight and the visitor can actually browse. Two big hero cards
 * lead (the priority clients), then one consistent 16:10 grid for the rest.
 * No portrait/tall tiles — those broke the rhythm and made scanning hard.
 * Videos cost 0 bytes at load (preload=none / mount-on-hover).
 */

interface Project {
  id: string;
  name: string;
  description: string;
  gradient: string;
  url: string;
  video?: string;
  poster?: string;
  /** object-contain on the gradient (logo/text marks, not photos). */
  contain?: boolean;
}

/* ---------- Data — priority order (DOM order = mobile order) ---------- */

// Hero pair — the two lead clients, big autoplay cards.
const HEROES: Project[] = [
  { id: "innercosmos", name: "Inner Cosmos", description: "מדיטציה בהתאמה אישית מבוססת AI", gradient: "linear-gradient(135deg, #667eea, #764ba2)", url: "https://innercosmos.ai/", video: "/c-video/compressed/INNERCOSMOS.mp4", poster: "/c-video/posters/INNERCOSMOS.webp" },
  { id: "tisar", name: "טיסאר", description: "מערכת תחזוקה חזויה למכונות · מקורות", gradient: "linear-gradient(135deg, #241a52, #3b2d7a)", url: "https://www.tisar.com/", poster: "/images/portfolio-tiles/tisar.png" },
];

// Uniform grid — the five remaining priority clients first, then the rest.
const WORKS: Project[] = [
  // priority 3–7
  { id: "of-jerusalem", name: "עוף ירושלים", description: "מהדרין מאז 2001 — מהלול עד הצלחת", gradient: "linear-gradient(135deg, #7a1f1f, #c0392b)", url: "https://ofjerusalem.com/", poster: "/images/portfolio-tiles/of-jerusalem.jpg" },
  { id: "olamhamamtakim", name: "עולם הממתקים", description: "רשת חנויות ממתקים", gradient: "linear-gradient(135deg, #ff9a9e, #fecfef)", url: "https://olamhamamtakim.co.il/", video: "/c-video/compressed/olamhamamtakim.mp4", poster: "/c-video/posters/olamhamamtakim.webp" },
  { id: "dentalcare", name: "Dental Care", description: "אתר מרפאת שיניים", gradient: "linear-gradient(135deg, #74ebd5, #ACB6E5)", url: "https://dental-care-d5g.pages.dev/", video: "/c-video/compressed/dental-care.mp4", poster: "/c-video/posters/dental-care.webp" },
  { id: "higold", name: "HIGOLD ישראל", description: "ריהוט חוץ יוקרתי", gradient: "linear-gradient(135deg, #8a6d1e, #d4af37)", url: "https://higold-israel.com/", poster: "/images/portfolio-tiles/higold.jpg" },
  { id: "naotplus", name: "נאות", description: "עכשיו הכל מתחבר", gradient: "linear-gradient(135deg, #1f3a2d, #3f7a55)", url: "https://naotplus.com/", poster: "/images/portfolio-tiles/naotplus.jpg" },
  // the rest
  { id: "titans", name: "Titans Global", description: "Global investment platform", gradient: "linear-gradient(135deg, #F37021, #ff6b6b)", url: "https://titans.global/", video: "/c-video/compressed/Titans.mp4", poster: "/c-video/posters/Titans.webp" },
  { id: "aquatis", name: "Aquatis", description: "Water management platform", gradient: "linear-gradient(135deg, #11998e, #38ef7d)", url: "https://aquatis.ai/", video: "/c-video/compressed/Aquatis.mp4", poster: "/c-video/posters/Aquatis.webp" },
  { id: "emek-ayalon", name: "עמק איילון", description: "ניהול תשתיות ופרויקטים", gradient: "linear-gradient(135deg, #c5a55a, #e8d5a0)", url: "https://www.emek-ayalon.com/", video: "/c-video/compressed/emek-ayalon.mp4", poster: "/c-video/posters/emek-ayalon.webp" },
  { id: "ams-law", name: "AMS Law", description: "משרד עורכי דין", gradient: "linear-gradient(135deg, #1a1a2e, #16213e)", url: "https://ams-law.com/", video: "/c-video/compressed/ams-law.mp4", poster: "/c-video/posters/ams-law.webp" },
  { id: "peony-lion", name: "Peony Lion Group", description: "קבוצת השקעות בינלאומית", gradient: "linear-gradient(135deg, #5c1a33, #a34d6d)", url: "https://peony-lion.pages.dev/", poster: "/images/portfolio-tiles/peony-lion.jpg" },
  { id: "fixtickets", name: "פיקס טיקטס", description: "שירותי תיקון ושירות", gradient: "linear-gradient(135deg, #a18cd1, #fbc2eb)", url: "https://fixtickets.co.il/", video: "/c-video/compressed/fixtickets.mp4", poster: "/c-video/posters/fixtickets.webp" },
  { id: "thirdeye", name: "Third Eye", description: "Analytics dashboard", gradient: "linear-gradient(135deg, #4facfe, #00f2fe)", url: "https://3i.titans.global/", video: "/c-video/compressed/3i.mp4", poster: "/c-video/posters/3i.webp" },
  { id: "natansart", name: "Natan's Art", description: "טפטים מעוצבים בהשראת אומנות", gradient: "linear-gradient(135deg, #2c3e50, #8e44ad)", url: "https://natansart.com/", poster: "/images/portfolio-tiles/natansart.jpg" },
  { id: "alto-mare", name: "Alto Mare", description: "Luxury sea-view residences", gradient: "linear-gradient(135deg, #0f3057, #4a7fa5)", url: "https://alto-mare.pages.dev/", poster: "/images/portfolio-tiles/alto-mare.jpg" },
  { id: "jumarie", name: "Jumarie", description: "אופנת נשים פרימיום", gradient: "linear-gradient(135deg, #d5a6bd, #f5e0e8)", url: "https://jumarie.co/en", poster: "/images/portfolio-tiles/jumarie.svg", contain: true },
  { id: "roza", name: "רוזה", description: "מסעדה ברחובות", gradient: "linear-gradient(135deg, #2d4a22, #5a7a42)", url: "https://roza-rehovot-website.pages.dev/", video: "/c-video/compressed/roza.mp4", poster: "/c-video/posters/roza.webp" },
  { id: "baguette", name: "באגט התרנגול", description: "מסעדה", gradient: "linear-gradient(135deg, #3a2a1a, #6b4c30)", url: "https://baguette-hatarnegol.pages.dev/", video: "/c-video/compressed/baguette.mp4", poster: "/c-video/posters/baguette.webp" },
  { id: "helena", name: "הלן המתקשרת", description: "תיקשור וקלפי טארוט", gradient: "linear-gradient(135deg, #1a1033, #3d2266)", url: "https://maalen-landing.pages.dev/", video: "/c-video/compressed/helena.mp4", poster: "/c-video/posters/helena.webp" },
  { id: "juju", name: "JUJU Asian Kitchen", description: "מטבח אסייתי בממילא ירושלים", gradient: "linear-gradient(135deg, #1b4332, #d90429)", url: "https://juju-asian-kitchen.pages.dev/", poster: "/images/portfolio-tiles/juju.jpg" },
  { id: "light4u", name: "יהלום תאורה", description: "חנות תאורה מעוצבת", gradient: "linear-gradient(135deg, #3d3106, #b39220)", url: "https://www.light4u.co.il/", poster: "/images/portfolio-tiles/light4u.jpg" },
  { id: "shai-haim", name: "שי פרויקטים", description: "עבודות גמר ובנייה", gradient: "linear-gradient(135deg, #37474f, #78909c)", url: "https://shai-projects-web.davidalelad.workers.dev/", poster: "/images/portfolio-tiles/shai-haim.jpg" },
  { id: "asu", name: "ASU Clinics", description: "אסתטיקה רפואית בהתאמה אישית", gradient: "linear-gradient(135deg, #4a6572, #a7c5cf)", url: "https://asu-clinics.pages.dev/", poster: "/images/portfolio-tiles/asu.jpg" },
  { id: "yes-we-can", name: "Yes we CAN", description: "אריזה ומכירה בדרך חדשה", gradient: "linear-gradient(135deg, #0077b6, #90e0ef)", url: "https://yes-we-can.pages.dev/", poster: "/images/portfolio-tiles/yes-we-can.jpg" },
  { id: "yoni-shawarma", name: "יוני 71", description: "שווארמה כשרה ברמת השרון", gradient: "linear-gradient(135deg, #6a3805, #c8781a)", url: "https://yoni71.davidalelad.workers.dev/", poster: "/images/portfolio-tiles/yoni-shawarma.jpg" },
  { id: "burger-yoni", name: "בורגר יוני 71", description: "המבורגרים כשרים ברמת השרון", gradient: "linear-gradient(135deg, #4a1a05, #a3541a)", url: "https://burger-yoni-71.pages.dev/" },
];

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
