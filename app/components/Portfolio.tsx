"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";

interface Project {
  id: string;
  name: string;
  description?: string;
  gradient: string;
  url: string;
  video?: string;
}

const projects: Project[] = [
  {
    id: "innercosmos",
    name: "Inner Cosmos",
    description: "AI-powered meditation app",
    gradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    url: "https://innercosmos.ai/",
    video: "/c-video/compressed/INNERCOSMOS.mp4",
  },
  {
    id: "aquatis",
    name: "Aquatis",
    description: "Water management platform",
    gradient: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
    url: "https://aquatis.ai/",
    video: "/c-video/compressed/Aquatis.mp4",
  },
  {
    id: "titans",
    name: "Titans",
    description: "Global investment platform",
    gradient: "linear-gradient(135deg, #F37021 0%, #ff6b6b 100%)",
    url: "https://titans.global/",
    video: "/c-video/compressed/Titans.mp4",
  },
  {
    id: "thirdeye",
    name: "Third Eye",
    description: "Analytics dashboard",
    gradient: "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    url: "https://3i.titans.global/",
    video: "/c-video/compressed/3i.mp4",
  },
  {
    id: "dentalcare",
    name: "Dental Care",
    description: "Dental clinic website",
    gradient: "linear-gradient(135deg, #74ebd5 0%, #ACB6E5 100%)",
    url: "#",
    video: "/c-video/compressed/dental care.mp4",
  },
];

// Style for center card - white glow shadow
const centerCardStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: "20px",
  boxShadow: `
    0 0 40px rgba(255, 255, 255, 0.25),
    0 0 80px rgba(255, 255, 255, 0.15),
    0 8px 32px rgba(0, 0, 0, 0.2)
  `,
  overflow: "hidden",
};

// Style for side cards - white glow effect
const getSideCardStyle = (): React.CSSProperties => ({
  background: "linear-gradient(135deg, rgba(20,20,35,0.9) 0%, rgba(15,15,25,0.95) 100%)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: "16px",
  boxShadow: `
    0 0 30px rgba(255, 255, 255, 0.2),
    0 0 60px rgba(255, 255, 255, 0.1),
    0 8px 24px rgba(0, 0, 0, 0.2)
  `,
  overflow: "hidden",
});

// Glass style for navigation buttons - white glow
const glassStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)",
  backdropFilter: "blur(10px)",
  WebkitBackdropFilter: "blur(10px)",
  border: "1px solid rgba(255,255,255,0.2)",
  borderRadius: "50%",
  boxShadow: "0 0 20px rgba(255, 255, 255, 0.2), 0 0 40px rgba(255, 255, 255, 0.1)",
};

export default function Portfolio() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [dragStart, setDragStart] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);

  // Scroll-based visibility
  useEffect(() => {
    const handleScroll = () => {
      if (!sectionRef.current) return;
      const rect = sectionRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;
      setIsVisible(rect.top < windowHeight * 0.75);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        setActiveIndex((prev) => (prev === 0 ? projects.length - 1 : prev - 1));
      }
      if (e.key === "ArrowRight") {
        setActiveIndex((prev) => (prev + 1) % projects.length);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const getCardStyle = (index: number) => {
    const total = projects.length;
    let diff = index - activeIndex;

    // Handle infinite loop
    if (diff > total / 2) diff -= total;
    if (diff < -total / 2) diff += total;

    const absD = Math.abs(diff);

    if (absD === 0) {
      // Center card - large and flat
      return {
        x: 0,
        rotateY: 0,
        scale: 1.6,
        opacity: 1,
        zIndex: 10,
        isSide: false,
        isLeft: false,
      };
    } else if (absD === 1) {
      // Side cards - rotated with 3D effect
      return {
        x: diff * 420,
        rotateY: diff * -35,
        scale: 0.55,
        opacity: 1,
        zIndex: 5,
        isSide: true,
        isLeft: diff < 0,
      };
    } else {
      // Hidden cards
      return {
        x: diff * 300,
        rotateY: diff * -40,
        scale: 0.6,
        opacity: 0,
        zIndex: 0,
        isSide: false,
        isLeft: false,
      };
    }
  };

  const handleDragStart = (e: React.TouchEvent) => {
    setDragStart(e.touches[0].clientX);
  };

  const handleDragEnd = (e: React.TouchEvent) => {
    const diff = e.changedTouches[0].clientX - dragStart;
    if (diff > 50) {
      setActiveIndex((prev) => (prev === 0 ? projects.length - 1 : prev - 1));
    } else if (diff < -50) {
      setActiveIndex((prev) => (prev + 1) % projects.length);
    }
  };

  return (
    <section
      ref={sectionRef}
      id="portfolio"
      className="min-h-[80vh] relative overflow-hidden py-20"
    >
      {/* Section Title */}
      <div
        className="flex justify-center mb-28 px-4 transition-all duration-700"
        style={{
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? "translateY(0)" : "translateY(-30px)",
        }}
      >
        <Image
          src="/העבודות שלנו.svg"
          alt="העבודות שלנו"
          width={400}
          height={60}
          className="w-auto h-auto max-w-[90vw] md:max-w-[500px]"
          style={{ filter: "brightness(0) invert(1)" }}
          unoptimized
        />
      </div>

      {/* Desktop Carousel */}
      <div
        className="hidden md:block relative h-[550px]"
        style={{ perspective: "1000px", perspectiveOrigin: "center center" }}
      >
        <div
          className="relative h-full flex items-center justify-center transition-all duration-700"
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? "translateY(0)" : "translateY(30px)",
            transitionDelay: "200ms",
          }}
        >
          <AnimatePresence mode="popLayout">
            {projects.map((project, index) => {
              const style = getCardStyle(index);
              const cardStyle = style.isSide
                ? getSideCardStyle()
                : centerCardStyle;

              return (
                <motion.a
                  key={project.id}
                  href={project.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{
                    x: style.x,
                    rotateY: style.rotateY,
                    scale: style.scale,
                    opacity: style.opacity,
                    zIndex: style.zIndex,
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="absolute w-[380px] cursor-pointer"
                  style={{ ...cardStyle, transformStyle: "preserve-3d" }}
                >
                  {/* Video or Placeholder */}
                  <div
                    className="aspect-video relative overflow-hidden"
                    style={{
                      background: project.gradient,
                      borderTopLeftRadius: style.isSide ? "14px" : "18px",
                      borderTopRightRadius: style.isSide ? "14px" : "18px",
                    }}
                  >
                    {project.video ? (
                      <video
                        src={project.video}
                        autoPlay
                        muted
                        loop
                        playsInline
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-white/30 text-6xl font-bold">
                          {project.name.charAt(0)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-5 text-center">
                    <h3 className="text-white text-xl font-medium mb-1">
                      {project.name}
                    </h3>
                    {project.description && (
                      <p className="text-white/50 text-sm">{project.description}</p>
                    )}
                  </div>
                </motion.a>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Navigation Arrows */}
        <button
          onClick={() =>
            setActiveIndex((prev) => (prev === 0 ? projects.length - 1 : prev - 1))
          }
          className="absolute left-8 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110"
          style={glassStyle}
        >
          <span className="text-white text-2xl">&#8592;</span>
        </button>
        <button
          onClick={() => setActiveIndex((prev) => (prev + 1) % projects.length)}
          className="absolute right-8 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110"
          style={glassStyle}
        >
          <span className="text-white text-2xl">&#8594;</span>
        </button>
      </div>

      {/* Mobile Carousel */}
      <div
        className="md:hidden px-4 transition-all duration-700"
        style={{
          opacity: isVisible ? 1 : 0,
          transform: isVisible ? "translateY(0)" : "translateY(30px)",
          transitionDelay: "200ms",
        }}
        onTouchStart={handleDragStart}
        onTouchEnd={handleDragEnd}
      >
        <motion.div
          key={activeIndex}
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 0.3 }}
        >
          <a
            href={projects[activeIndex].url}
            target="_blank"
            rel="noopener noreferrer"
            className="block max-w-[350px] mx-auto"
            style={centerCardStyle}
          >
            {/* Video or Placeholder */}
            <div
              className="aspect-video relative overflow-hidden"
              style={{
                background: projects[activeIndex].gradient,
                borderTopLeftRadius: "20px",
                borderTopRightRadius: "20px",
              }}
            >
              {projects[activeIndex].video ? (
                <video
                  src={projects[activeIndex].video}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white/30 text-6xl font-bold">
                    {projects[activeIndex].name.charAt(0)}
                  </span>
                </div>
              )}
            </div>

            {/* Info */}
            <div className="p-5 text-center">
              <h3 className="text-white text-xl font-medium mb-1">
                {projects[activeIndex].name}
              </h3>
              {projects[activeIndex].description && (
                <p className="text-white/50 text-sm">
                  {projects[activeIndex].description}
                </p>
              )}
            </div>
          </a>
        </motion.div>

        {/* Swipe hint */}
        <p className="text-center text-white/30 text-sm mt-4">
          &#8592; החלק &#8594;
        </p>
      </div>

      {/* Dots Navigation */}
      <div
        className="flex justify-center gap-3 mt-8 transition-all duration-700"
        style={{
          opacity: isVisible ? 1 : 0,
          transitionDelay: "400ms",
        }}
      >
        {projects.map((_, i) => (
          <button
            key={i}
            onClick={() => setActiveIndex(i)}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === activeIndex
                ? "bg-white w-8"
                : "bg-white/30 w-2 hover:bg-white/50"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
