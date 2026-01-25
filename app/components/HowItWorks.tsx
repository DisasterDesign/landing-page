"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";

// Wireframe element definitions with actual SVG sizes
interface WireframeElement {
  id: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  hasShadow?: boolean;
}

// Final positions for all elements (navbar items scaled to 70%, evenly spaced with 30px gaps)
const elements: WireframeElement[] = [
  // Navbar items - scaled to 70% with even 30px spacing
  { id: "about", src: "/section 2/About.svg", x: 436, y: 32, width: 39, height: 11 },
  { id: "projects", src: "/section 2/Projects.svg", x: 505, y: 32, width: 52, height: 12 },
  { id: "members", src: "/section 2/Our Members.svg", x: 587, y: 32, width: 87, height: 11 },
  { id: "contact", src: "/section 2/Contact.svg", x: 704, y: 32, width: 50, height: 11 },
  // CTA button - right side (75% of 164x50 = 123x38) with shadow
  { id: "letsTalk", src: "/section 2/cta.svg", x: 1047, y: 20, width: 123, height: 38, hasShadow: true },

  // Main title - "Where ideas become" (50% of 724x256 = 362x128) - vertically centered
  { id: "titleMain", src: "/section 2/Where ideas become.svg", x: 80, y: 267, width: 362, height: 128 },
  // "reality" in dark color (50% size) - with spacing
  { id: "titleReality", src: "/section 2/reality.svg", x: 80, y: 437, width: 193, height: 62 },

  // CTA button - centered horizontally, lower position
  { id: "makeIt", src: "/section 2/make it.svg", x: 499, y: 600, width: 192, height: 62, hasShadow: true },
];

// Animation timing (30% faster)
const BORDER_ANIMATION_DURATION = 560; // ms
const CURSOR_MOVE_DURATION = 280; // ms for cursor to move
const DRAG_DURATION = 375; // ms for dragging element to final position
const PAUSE_BETWEEN_ELEMENTS = 95; // ms pause between elements

// Order of elements to animate
// letsTalk → projects → about → members → contact → titleMain → titleReality → makeIt
const ANIMATION_ORDER = [4, 1, 0, 2, 3, 5, 6, 7];

// Frame dimensions
const FRAME_WIDTH = 1190;
const FRAME_HEIGHT = 765;

// Scattered position type
interface ScatteredPosition {
  x: number;
  y: number;
  rotation: number;
}

// Generate random scattered positions within the frame
function generateScatteredPositions(): ScatteredPosition[] {
  const padding = 80;
  return elements.map((el) => ({
    x: padding + Math.random() * (FRAME_WIDTH - el.width - padding * 2),
    y: padding + Math.random() * (FRAME_HEIGHT - el.height - padding * 2),
    rotation: (Math.random() - 0.5) * 30, // -15 to +15 degrees
  }));
}

// Cursor SVG Component
function CursorSVG() {
  return (
    <svg width="24" height="32" viewBox="0 0 24 32" fill="none">
      <path
        d="M5.65685 0L24 18.3431L14.1421 18.3431L18.3137 27.3137L13.6569 29.6569L9.48528 20.6863L5.65685 24.5147L5.65685 0Z"
        fill="#1F1F1F"
        stroke="white"
        strokeWidth="1.5"
      />
    </svg>
  );
}

// Main Component
export default function HowItWorks() {
  const [borderComplete, setBorderComplete] = useState(false);
  const [visibleElements, setVisibleElements] = useState<Set<number>>(new Set());
  const [isVisible, setIsVisible] = useState(false);
  const [scatteredPositions, setScatteredPositions] = useState<ScatteredPosition[]>([]);
  const [cursorPosition, setCursorPosition] = useState({ x: FRAME_WIDTH + 50, y: FRAME_HEIGHT / 2 });
  const [showCursor, setShowCursor] = useState(false);
  const [placedElements, setPlacedElements] = useState<Set<number>>(new Set());
  const [isDragging, setIsDragging] = useState(false);
  const [currentAnimationIndex, setCurrentAnimationIndex] = useState(-1); // -1 = not started
  const [scale, setScale] = useState(1);
  const [titleProgress, setTitleProgress] = useState(0);
  const [bottomTextProgress, setBottomTextProgress] = useState(0);
  const [isTearActive, setIsTearActive] = useState(false); // For positioning during Hero tear
  const containerRef = useRef<HTMLDivElement>(null);
  const outerContainerRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);

  // Track Hero tear state based on scroll
  useEffect(() => {
    const heroSection = document.getElementById("hero");
    if (!heroSection) return;

    const handleScroll = () => {
      const rect = heroSection.getBoundingClientRect();
      const heroHeight = heroSection.offsetHeight;
      const windowHeight = window.innerHeight;

      // Hero scroll progress (0-1)
      const heroProgress = Math.min(
        Math.max(-rect.top / (heroHeight - windowHeight), 0),
        1
      );

      // Tear is active when Hero is between 20-100% scrolled
      setIsTearActive(heroProgress > 0.15 && heroProgress < 1);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll(); // Initial check
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Scroll-based animations for title and bottom text
  useEffect(() => {
    const handleScroll = () => {
      if (!sectionRef.current) return;

      const rect = sectionRef.current.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      let titleProg = 0;
      let bottomProg = 0;

      // Section is in viewport
      if (rect.top < windowHeight && rect.bottom > 0) {
        // === Title animation ===
        const titleEntryStart = windowHeight * 0.6;
        const titleEntryEnd = windowHeight * 0.3;
        const titleEntry = rect.top < titleEntryStart
          ? Math.min(1, (titleEntryStart - rect.top) / (titleEntryStart - titleEntryEnd))
          : 0;

        const titleExitStart = windowHeight * 0.5;
        const titleExitEnd = windowHeight * 0.1;
        const titleExit = rect.bottom > titleExitEnd
          ? rect.bottom < titleExitStart
            ? (rect.bottom - titleExitEnd) / (titleExitStart - titleExitEnd)
            : 1
          : 0;

        titleProg = Math.min(titleEntry, titleExit);

        // === Bottom text animation ===
        const entryStart = windowHeight * 0.5;
        const entryEnd = windowHeight * 0.2;
        const entryProgress = rect.top < entryStart
          ? Math.min(1, (entryStart - rect.top) / (entryStart - entryEnd))
          : 0;

        const exitStart = windowHeight * 0.6;
        const exitEnd = windowHeight * 0.2;
        const exitProgress = rect.bottom > exitStart
          ? 1
          : rect.bottom < exitEnd
            ? 0
            : (rect.bottom - exitEnd) / (exitStart - exitEnd);

        bottomProg = Math.min(entryProgress, exitProgress);
      }

      setTitleProgress(titleProg);
      setBottomTextProgress(bottomProg);
    };

    window.addEventListener("scroll", handleScroll);
    handleScroll(); // Initial call

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Initialize scattered positions on mount
  useEffect(() => {
    setScatteredPositions(generateScatteredPositions());
  }, []);

  // Calculate scale based on container width
  useEffect(() => {
    const calculateScale = () => {
      if (!outerContainerRef.current) return;
      const containerWidth = outerContainerRef.current.offsetWidth;
      const newScale = Math.min(containerWidth / FRAME_WIDTH, 1);
      setScale(newScale);
    };

    calculateScale();
    window.addEventListener("resize", calculateScale);
    return () => window.removeEventListener("resize", calculateScale);
  }, []);

  // Intersection Observer - start/reset animation when section enters/exits
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Section entered - start animation
          setIsVisible(true);
        } else if (isVisible) {
          // Section left - reset all animation states
          setIsVisible(false);
          setBorderComplete(false);
          setVisibleElements(new Set());
          setShowCursor(false);
          setPlacedElements(new Set());
          setIsDragging(false);
          setCurrentAnimationIndex(-1);
          // Generate new scattered positions for next time
          setScatteredPositions(generateScatteredPositions());
        }
      },
      { threshold: 0.2 }
    );

    const section = document.getElementById("how-it-works");
    if (section) observer.observe(section);

    return () => observer.disconnect();
  }, [isVisible]);

  // Border animation complete - show elements and start cursor animation
  useEffect(() => {
    if (isVisible && scatteredPositions.length > 0) {
      // Border complete
      const borderTimer = setTimeout(() => {
        setBorderComplete(true);
      }, BORDER_ANIMATION_DURATION);

      // Show all elements at once after border completes
      const showElementsTimer = setTimeout(() => {
        setVisibleElements(new Set(elements.map((_, i) => i)));
      }, BORDER_ANIMATION_DURATION);

      // Show cursor and start first animation
      const cursorTimer = setTimeout(() => {
        setShowCursor(true);
        setCurrentAnimationIndex(0);
      }, BORDER_ANIMATION_DURATION + 200);

      return () => {
        clearTimeout(borderTimer);
        clearTimeout(showElementsTimer);
        clearTimeout(cursorTimer);
      };
    }
  }, [isVisible, scatteredPositions]);

  // Sequential animation for each element
  useEffect(() => {
    if (currentAnimationIndex < 0 || currentAnimationIndex >= ANIMATION_ORDER.length) return;
    if (scatteredPositions.length === 0) return;

    const elementIndex = ANIMATION_ORDER[currentAnimationIndex];
    const element = elements[elementIndex];
    const scattered = scatteredPositions[elementIndex];

    if (!scattered) return;

    // Step 1: Move cursor to scattered position
    setIsDragging(false);
    setCursorPosition({ x: scattered.x, y: scattered.y });

    // Step 2: After reaching element, drag to final position
    const dragTimer = setTimeout(() => {
      setIsDragging(true);
      setCursorPosition({ x: element.x, y: element.y });
      setPlacedElements((prev) => new Set([...Array.from(prev), elementIndex]));
    }, CURSOR_MOVE_DURATION + PAUSE_BETWEEN_ELEMENTS);

    // Step 3: Move to next element
    const nextTimer = setTimeout(() => {
      setCurrentAnimationIndex((prev) => prev + 1);
    }, CURSOR_MOVE_DURATION + PAUSE_BETWEEN_ELEMENTS + DRAG_DURATION + PAUSE_BETWEEN_ELEMENTS);

    return () => {
      clearTimeout(dragTimer);
      clearTimeout(nextTimer);
    };
  }, [currentAnimationIndex, scatteredPositions]);

  // Frame perimeter for SVG path animation
  const perimeter = 2 * (FRAME_WIDTH + FRAME_HEIGHT);

  return (
    <section
      ref={sectionRef}
      id="how-it-works"
      className="min-h-screen relative overflow-hidden py-20"
      style={{
        backgroundColor: "#FDF4EB",
        // During tear: fixed position behind Hero so visible through tear hole
        ...(isTearActive
          ? {
              position: "fixed" as const,
              top: 0,
              left: 0,
              width: "100%",
              height: "100vh",
              zIndex: 1, // Behind Canvas (z-index: 2)
            }
          : {}),
      }}
    >
      {/* Section Title */}
      <div
        className="flex justify-center mb-16 relative z-10"
        style={{
          opacity: titleProgress,
          transform: `translateY(${(1 - titleProgress) * -30}px)`,
          transition: "transform 0.1s ease-out",
        }}
      >
        <Image
          src="/איך זה עובד.svg"
          alt="איך זה עובד"
          width={456}
          height={67}
          style={{
            width: "clamp(280px, 30vw, 456px)",
            height: "auto",
          }}
          priority
        />
      </div>

      {/* Outer Container - responsive width, scaled height */}
      <div
        ref={outerContainerRef}
        className="relative mx-auto z-10"
        style={{
          width: "min(81vw, 1190px)",
          height: FRAME_HEIGHT * scale,
        }}
      >
        {/* Inner Container - fixed size, scaled down, centered */}
        <div
          ref={containerRef}
          className="absolute left-1/2"
          style={{
            width: FRAME_WIDTH,
            height: FRAME_HEIGHT,
            transform: `translateX(-50%) scale(${scale})`,
            transformOrigin: "top center",
            backgroundColor: "#FDF4EB",
            boxShadow: borderComplete ? "0 8px 25px rgba(31, 31, 31, 0.15)" : "none",
            transition: "box-shadow 0.8s ease-out",
          }}
        >
          {/* Animated Border SVG */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ overflow: "visible" }}
          >
            <rect
              x="0.5"
              y="0.5"
              width={FRAME_WIDTH - 1}
              height={FRAME_HEIGHT - 1}
              fill="none"
              stroke="rgba(31, 31, 31, 0.2)"
              strokeWidth="1"
              style={{
                strokeDasharray: perimeter,
                strokeDashoffset: isVisible ? 0 : perimeter,
                transition: `stroke-dashoffset ${BORDER_ANIMATION_DURATION}ms ease-out`,
              }}
            />
          </svg>

          {/* Elements */}
          {elements.map((el, index) => {
            const isElementVisible = visibleElements.has(index);
            const isPlaced = placedElements.has(index);
            const scattered = scatteredPositions[index];

            // Use final position if placed, otherwise scattered position
            const posX = isPlaced ? el.x : (scattered?.x ?? el.x);
            const posY = isPlaced ? el.y : (scattered?.y ?? el.y);
            const rotation = isPlaced ? 0 : (scattered?.rotation ?? 0);

            return (
              <div
                key={el.id}
                className="absolute"
                style={{
                  left: posX,
                  top: posY,
                  width: el.width,
                  height: el.height,
                  opacity: isElementVisible ? 1 : 0,
                  transform: `rotate(${rotation}deg)`,
                  transition: `opacity 0.6s ease-out, left ${DRAG_DURATION}ms ease-out, top ${DRAG_DURATION}ms ease-out, transform ${DRAG_DURATION}ms ease-out`,
                  filter: el.hasShadow && isElementVisible
                    ? "drop-shadow(0 2px 2px rgba(31, 31, 31, 0.15))"
                    : "none",
                }}
              >
                <Image
                  src={el.src}
                  alt={el.id}
                  width={el.width}
                  height={el.height}
                  className="pointer-events-none"
                  priority
                  unoptimized
                />
              </div>
            );
          })}

          {/* Cursor */}
          {showCursor && (
            <div
              className="absolute pointer-events-none z-50"
              style={{
                left: cursorPosition.x,
                top: cursorPosition.y,
                transition: `left ${isDragging ? DRAG_DURATION : CURSOR_MOVE_DURATION}ms ease-out, top ${isDragging ? DRAG_DURATION : CURSOR_MOVE_DURATION}ms ease-out`,
              }}
            >
              <CursorSVG />
            </div>
          )}
        </div>
      </div>

      {/* Description text */}
      <div
        className="flex justify-center mt-12 px-4 relative z-10"
        style={{
          opacity: bottomTextProgress,
          transform: `translateY(${(1 - bottomTextProgress) * 30}px)`,
          transition: "transform 0.1s ease-out",
        }}
      >
        <Image
          src="/שיחה אחת. אתר שלם!.svg"
          alt="שיחה אחת. אתר שלם!"
          width={311}
          height={23}
          style={{
            width: "clamp(220px, 28vw, 311px)",
            height: "auto",
          }}
        />
      </div>
    </section>
  );
}
