"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ScrollReveal from "@/components/animations/ScrollReveal";

interface Project {
  id: string;
  name: string;
  url: string;
  video: string;
  poster: string;
}

const projects: Project[] = [
  { id: "innercosmos", name: "Inner Cosmos", url: "https://innercosmos.ai/", video: "/c-video/compressed/INNERCOSMOS.mp4", poster: "/c-video/posters/INNERCOSMOS.webp" },
  { id: "aquatis", name: "Aquatis", url: "https://aquatis.ai/", video: "/c-video/compressed/Aquatis.mp4", poster: "/c-video/posters/Aquatis.webp" },
  { id: "titans", name: "Titans", url: "https://titans.global/", video: "/c-video/compressed/Titans.mp4", poster: "/c-video/posters/Titans.webp" },
  { id: "thirdeye", name: "Third Eye", url: "https://3i.titans.global/", video: "/c-video/compressed/3i.mp4", poster: "/c-video/posters/3i.webp" },
  { id: "dentalcare", name: "Dental Care", url: "https://dental-care-d5g.pages.dev/", video: "/c-video/compressed/dental-care.mp4", poster: "/c-video/posters/dental-care.webp" },
  { id: "ams-law", name: "AMS Law", url: "https://ams-law.com/", video: "/c-video/compressed/ams-law.mp4", poster: "/c-video/posters/ams-law.webp" },
];

function VideoCard({ project, isActive }: { project: Project; isActive: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hovered, setHovered] = useState(false);

  const handleEnter = useCallback(() => {
    setHovered(true);
    videoRef.current?.play();
  }, []);

  const handleLeave = useCallback(() => {
    setHovered(false);
    if (videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = 0; }
  }, []);

  return (
    <a
      href={project.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block group"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      aria-label={`צפייה בפרויקט ${project.name}`}
      data-cursor="view"
    >
      <div className="relative">
        {/* Chromatic layers */}
        <motion.div
          className="absolute inset-0 rounded-[18px] bg-[#00D0CE]"
          animate={{ x: hovered ? 0 : 4, y: hovered ? 0 : -4, opacity: hovered ? 0 : 1 }}
          transition={{ duration: 0.4 }}
        />
        <motion.div
          className="absolute inset-0 rounded-[18px] bg-[#C80084]"
          animate={{ x: hovered ? 0 : -4, y: hovered ? 0 : 4, opacity: hovered ? 0 : 1 }}
          transition={{ duration: 0.4 }}
        />

        {/* Main card */}
        <motion.div
          className="relative rounded-[18px] overflow-hidden"
          animate={{ borderColor: hovered ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0)" }}
          style={{ borderWidth: "1px", borderStyle: "solid" }}
        >
          <div className="aspect-video relative bg-gray-900">
            <video
              ref={videoRef}
              src={project.video}
              poster={project.poster}
              muted
              loop
              playsInline
              preload="none"
              className="w-full h-full object-cover"
            />

            {/* Overlay gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

            {/* Project name */}
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <h3 className="text-white text-lg font-bold">{project.name}</h3>
              <motion.span
                className="text-gray-400 text-sm block"
                animate={{ opacity: hovered ? 1 : 0, y: hovered ? 0 : 5 }}
                transition={{ duration: 0.3 }}
              >
                לצפייה בפרויקט →
              </motion.span>
            </div>
          </div>
        </motion.div>
      </div>
    </a>
  );
}

export default function Portfolio() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [dragStart, setDragStart] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const prev = () => setActiveIndex((i) => (i === 0 ? projects.length - 1 : i - 1));
  const next = () => setActiveIndex((i) => (i + 1) % projects.length);

  // Auto-rotate (pauses on hover)
  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [activeIndex, isPaused]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const section = document.getElementById("portfolio");
      if (!section?.contains(document.activeElement)) return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        prev();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const getCardTransform = (index: number) => {
    const total = projects.length;
    let diff = index - activeIndex;
    if (diff > total / 2) diff -= total;
    if (diff < -total / 2) diff += total;
    const absD = Math.abs(diff);

    if (absD === 0) return { x: 0, scale: 1, opacity: 1, zIndex: 10 };
    if (absD === 1) return { x: diff * 420, scale: 0.75, opacity: 0.7, zIndex: 5 };
    return { x: diff * 300, scale: 0.6, opacity: 0, zIndex: 0 };
  };

  return (
    <section id="portfolio" className="relative bg-black py-24 md:py-32" aria-roledescription="carousel" aria-label="תיק עבודות">
      <div className="max-w-6xl mx-auto px-6">
        <ScrollReveal>
          <h2 className="chromatic-hover text-4xl md:text-5xl lg:text-6xl font-extrabold text-center mb-20" data-text="העבודות שלנו">
            העבודות שלנו
          </h2>
        </ScrollReveal>
      </div>

      {/* Desktop Carousel */}
      <div
        className="hidden md:block relative h-[520px] overflow-hidden"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
      >
        <div className="relative h-full flex items-center justify-center">
          {projects.map((project, index) => {
            const t = getCardTransform(index);
            return (
              <motion.div
                key={project.id}
                className="absolute w-[620px]"
                animate={{ x: t.x, scale: t.scale, opacity: t.opacity, zIndex: t.zIndex }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                aria-hidden={index !== activeIndex}
              >
                <VideoCard project={project} isActive={index === activeIndex} />
              </motion.div>
            );
          })}
        </div>

      </div>

      {/* Mobile */}
      <div
        className="md:hidden px-6"
        onTouchStart={(e) => setDragStart(e.touches[0].clientX)}
        onTouchEnd={(e) => {
          const diff = e.changedTouches[0].clientX - dragStart;
          if (diff > 50) prev();
          else if (diff < -50) next();
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeIndex}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
          >
            <VideoCard project={projects[activeIndex]} isActive />
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dots + Arrows — forced LTR so left arrow is visually left */}
      <div dir="ltr" className="flex items-center justify-center gap-4 mt-10">
        <button
          onClick={prev}
          className="w-11 h-11 border border-white/20 rounded-full flex items-center justify-center hover:border-white/50 transition-all"
          aria-label="פרויקט קודם"
          data-cursor="pointer"
        >
          <span className="text-white text-sm">←</span>
        </button>
        <div className="flex gap-3" role="tablist" aria-label="בחירת פרויקט">
          {projects.map((p, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === activeIndex ? "bg-white w-8" : "bg-white/20 w-2 hover:bg-white/40"
              }`}
              role="tab"
              aria-selected={i === activeIndex}
              aria-label={`${p.name} (${i + 1} מתוך ${projects.length})`}
              data-cursor="pointer"
            />
          ))}
        </div>
        <button
          onClick={next}
          className="w-11 h-11 border border-white/20 rounded-full flex items-center justify-center hover:border-white/50 transition-all"
          aria-label="פרויקט הבא"
          data-cursor="pointer"
        >
          <span className="text-white text-sm">→</span>
        </button>
      </div>
    </section>
  );
}
