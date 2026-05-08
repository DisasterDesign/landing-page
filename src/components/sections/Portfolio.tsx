"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import ScrollReveal from "@/components/animations/ScrollReveal";

interface Project {
  id: string;
  name: string;
  description: string;
  gradient: string;
  url: string;
  video?: string;
  poster?: string;
}

const projects: Project[] = [
  // 12 video projects, alternating original showcase work and new screencaptures
  { id: "titans", name: "Titans Global", description: "Global investment platform", gradient: "linear-gradient(135deg, #F37021, #ff6b6b)", url: "https://titans.global/", video: "/c-video/compressed/Titans.mp4", poster: "/c-video/posters/Titans.webp" },
  { id: "olamhamamtakim", name: "עולם הממתקים", description: "רשת חנויות ממתקים", gradient: "linear-gradient(135deg, #ff9a9e, #fecfef)", url: "https://olamhamamtakim.co.il/", video: "/c-video/compressed/olamhamamtakim.mp4", poster: "/c-video/posters/olamhamamtakim.webp" },
  { id: "aquatis", name: "Aquatis", description: "Water management platform", gradient: "linear-gradient(135deg, #11998e, #38ef7d)", url: "https://aquatis.ai/", video: "/c-video/compressed/Aquatis.mp4", poster: "/c-video/posters/Aquatis.webp" },
  { id: "fixtickets", name: "פיקס טיקטס", description: "שירותי תיקון ושירות", gradient: "linear-gradient(135deg, #a18cd1, #fbc2eb)", url: "https://fixtickets.co.il/", video: "/c-video/compressed/fixtickets.mp4", poster: "/c-video/posters/fixtickets.webp" },
  { id: "innercosmos", name: "Inner Cosmos", description: "AI-powered meditation", gradient: "linear-gradient(135deg, #667eea, #764ba2)", url: "https://innercosmos.ai/", video: "/c-video/compressed/INNERCOSMOS.mp4", poster: "/c-video/posters/INNERCOSMOS.webp" },
  { id: "roza", name: "רוזה", description: "מסעדה ברחובות", gradient: "linear-gradient(135deg, #2d4a22, #5a7a42)", url: "https://roza-rehovot-website.pages.dev/", video: "/c-video/compressed/roza.mp4", poster: "/c-video/posters/roza.webp" },
  { id: "thirdeye", name: "Third Eye", description: "Analytics dashboard", gradient: "linear-gradient(135deg, #4facfe, #00f2fe)", url: "https://3i.titans.global/", video: "/c-video/compressed/3i.mp4", poster: "/c-video/posters/3i.webp" },
  { id: "baguette", name: "באגט התרנגול", description: "מסעדה", gradient: "linear-gradient(135deg, #3a2a1a, #6b4c30)", url: "https://baguette-hatarnegol.pages.dev/", video: "/c-video/compressed/baguette.mp4", poster: "/c-video/posters/baguette.webp" },
  { id: "dentalcare", name: "Dental Care", description: "Dental clinic website", gradient: "linear-gradient(135deg, #74ebd5, #ACB6E5)", url: "https://dental-care-d5g.pages.dev/", video: "/c-video/compressed/dental-care.mp4", poster: "/c-video/posters/dental-care.webp" },
  { id: "helena", name: "הלן המתקשרת", description: "תיקשור וקלפי טארוט", gradient: "linear-gradient(135deg, #1a1033, #3d2266)", url: "https://maalen-landing.pages.dev/", video: "/c-video/compressed/helena.mp4", poster: "/c-video/posters/helena.webp" },
  { id: "ams-law", name: "AMS Law", description: "משרד עורכי דין", gradient: "linear-gradient(135deg, #1a1a2e, #16213e)", url: "https://ams-law.com/", video: "/c-video/compressed/ams-law.mp4", poster: "/c-video/posters/ams-law.webp" },
  { id: "emek-ayalon", name: "עמק איילון", description: "ניהול תשתיות ופרויקטים", gradient: "linear-gradient(135deg, #c5a55a, #e8d5a0)", url: "https://www.emek-ayalon.com/", video: "/c-video/compressed/emek-ayalon.mp4", poster: "/c-video/posters/emek-ayalon.webp" },
];

const HOVER_DELAY = 380; // ms before lift triggers
const LIFT_MS = 200;     // duration tile floats before swapping into selected slot

export default function Portfolio() {
  const [selectedId, setSelectedId] = useState(projects[0].id);
  const [liftId, setLiftId] = useState<string | null>(null);
  const [isTouch, setIsTouch] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setIsTouch(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  const cancelHover = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  const promoteTo = (id: string) => {
    if (id === selectedId) return;
    cancelHover();
    if (liftTimerRef.current) clearTimeout(liftTimerRef.current);
    setLiftId(id);
    liftTimerRef.current = setTimeout(() => {
      setSelectedId(id);
      setLiftId(null);
    }, LIFT_MS);
  };

  const handleEnter = (id: string) => {
    if (isTouch || id === selectedId) return;
    cancelHover();
    hoverTimerRef.current = setTimeout(() => promoteTo(id), HOVER_DELAY);
  };

  const handleLeave = () => cancelHover();

  const handleClick = (id: string, url: string) => {
    if (id === selectedId) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      promoteTo(id);
    }
  };

  return (
    <section id="portfolio" className="relative bg-white py-24 md:py-32 px-6">
      <div className="max-w-[1400px] mx-auto">
        <ScrollReveal>
          <div className="text-center mb-10">
            <span dir="ltr" className="block text-xs uppercase tracking-[0.25em] text-gray-500 mb-3">
              {projects.length} projects
            </span>
            <h2
              className="chromatic-hover chromatic-always text-[clamp(2rem,6vw,4.5rem)] font-extrabold text-black w-full"
              data-text="העבודות שלנו"
            >
              העבודות שלנו
            </h2>
          </div>
        </ScrollReveal>

        <div
          className="portfolio-grid"
          style={{
            display: "grid",
            gap: "6px",
            gridAutoFlow: "dense",
            perspective: "1200px",
            transformStyle: "preserve-3d",
          }}
        >
          {projects.map((p) => {
            const isSelected = p.id === selectedId;
            const isLifting = p.id === liftId;
            const isDimmed = liftId !== null && !isSelected && !isLifting;
            return (
              <motion.button
                key={p.id}
                layout
                onMouseEnter={() => handleEnter(p.id)}
                onMouseLeave={handleLeave}
                onClick={() => handleClick(p.id, p.url)}
                animate={{
                  scale: isLifting ? 1.15 : isDimmed ? 0.97 : 1,
                  z: isLifting ? 30 : 0,
                  opacity: isDimmed ? 0.7 : 1,
                }}
                transition={{
                  layout: { duration: 0.45, ease: [0.4, 0, 0.2, 1] },
                  scale: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
                  z: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
                  opacity: { duration: 0.2 },
                }}
                style={{
                  gridColumn: isSelected ? "span 2" : "span 1",
                  gridRow: isSelected ? "span 2" : "span 1",
                  borderRadius: isSelected ? 12 : 8,
                  position: "relative",
                  overflow: "hidden",
                  cursor: "pointer",
                  background: p.gradient,
                  zIndex: isLifting ? 30 : isSelected ? 5 : 1,
                  willChange: "transform, opacity",
                  aspectRatio: "1 / 1",
                  border: "none",
                  padding: 0,
                  boxShadow: isLifting
                    ? "0 24px 60px rgba(0,0,0,0.32)"
                    : isSelected
                      ? "0 10px 28px rgba(0,0,0,0.14)"
                      : "0 2px 8px rgba(0,0,0,0.08)",
                }}
                aria-label={
                  isSelected
                    ? `${p.name} — open project`
                    : `${p.name} — expand`
                }
                data-cursor="pointer"
              >
                {isSelected ? <SelectedTile project={p} /> : <SmallTile project={p} />}
              </motion.button>
            );
          })}
        </div>
      </div>

      <style jsx>{`
        .portfolio-grid {
          grid-template-columns: repeat(3, 1fr);
        }
        @media (min-width: 768px) {
          .portfolio-grid {
            grid-template-columns: repeat(4, 1fr);
          }
        }
        @media (min-width: 1024px) {
          .portfolio-grid {
            grid-template-columns: repeat(5, 1fr);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .portfolio-grid :global(button) {
            transition: none !important;
          }
        }
      `}</style>
    </section>
  );
}

function SelectedTile({ project }: { project: Project }) {
  return (
    <div className="absolute inset-0 group/sel">
      {project.video ? (
        <video
          src={project.video}
          poster={project.poster}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : project.poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={project.poster}
          alt={project.name}
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0" style={{ background: project.gradient }} />
      )}

      {/* Bottom gradient for text legibility */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/75 via-black/15 to-transparent" />

      {/* Content */}
      <div className="absolute inset-0 flex flex-col justify-end p-5 md:p-7 text-white text-right pointer-events-none">
        <h3 className="text-lg md:text-2xl font-extrabold mb-1">{project.name}</h3>
        <p className="text-xs md:text-sm text-white/85 mb-3">{project.description}</p>
        <span
          dir="ltr"
          className="text-[11px] md:text-xs font-bold tracking-[0.2em] uppercase inline-flex items-center gap-2 group-hover/sel:gap-3 transition-all w-fit"
        >
          VISIT SITE <span aria-hidden="true">→</span>
        </span>
      </div>

      {/* Play button for video */}
      {project.video && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-white/15 backdrop-blur-md border border-white/30 flex items-center justify-center group-hover/sel:bg-white/25 transition-colors">
            <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5 md:w-6 md:h-6" style={{ marginLeft: 4 }}>
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}

function SmallTile({ project }: { project: Project }) {
  return (
    <div
      className="absolute inset-0 group/sm"
      style={{ background: project.gradient }}
    >
      {project.poster && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={project.poster}
          alt={project.name}
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
        />
      )}
      {project.video && (
        <div className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/30 backdrop-blur-sm border border-white/40 flex items-center justify-center pointer-events-none">
          <svg viewBox="0 0 24 24" fill="white" className="w-3 h-3" style={{ marginLeft: 1 }}>
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      )}
      {/* Name on hover (RTL bottom strip) */}
      <div className="absolute inset-x-0 bottom-0 p-2 text-white text-[10px] md:text-[11px] font-bold opacity-0 group-hover/sm:opacity-100 transition-opacity duration-200 bg-gradient-to-t from-black/65 to-transparent text-right pointer-events-none">
        {project.name}
      </div>
    </div>
  );
}
