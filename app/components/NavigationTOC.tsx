"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";

// Section configuration with SVG paths and dimensions
const sections = [
  { id: "hero", label: "בית", numeral: "I", svg: "/הבית.svg", width: 169, height: 48 },
  { id: "how-it-works", label: "איך זה עובד?", numeral: "II", svg: "/איך זה עובד.svg", width: 456, height: 67 },
  { id: "about-us", label: "מי אנחנו?", numeral: "III", svg: "/מי אנחנו%3F המקום להשוויץ.svg", width: 876, height: 68 },
  { id: "services", label: "השירותים", numeral: "IV", svg: "/השירותים -בניית אתרים יעני.svg", width: 960, height: 51 },
  { id: "portfolio", label: "העבודות שלנו", numeral: "V", svg: "/העבודות שלנו.svg", width: 466, height: 56 },
  { id: "contact", label: "צור קשר", numeral: "VI", svg: "/צור קשר סקשן.svg", width: 289, height: 62 },
];

// Scale factor for menu items - smaller for cleaner look
const MENU_SCALE = 0.2;

// Minimum content width based on largest SVG (השירותים: 960px * 0.26 ≈ 250px)
// + numeral (~25px) + gap (~12px) = ~287px, rounded up to 290px
const MIN_CONTENT_WIDTH = 290;

export default function NavigationTOC() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("hero");
  const [isLoaded, setIsLoaded] = useState(false);
  const [showText, setShowText] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Entrance animation timing
  useEffect(() => {
    // Small delay to ensure component is mounted
    const loadTimer = setTimeout(() => {
      setIsLoaded(true);
    }, 100);

    // Show text after border animation (1.2s)
    const textTimer = setTimeout(() => {
      setShowText(true);
    }, 1300);

    return () => {
      clearTimeout(loadTimer);
      clearTimeout(textTimer);
    };
  }, []);

  // Get nav dimensions for SVG
  useEffect(() => {
    if (navRef.current) {
      const updateDimensions = () => {
        if (navRef.current) {
          setDimensions({
            width: Math.max(navRef.current.offsetWidth, MIN_CONTENT_WIDTH + 32), // +32 for p-4 padding
            height: navRef.current.offsetHeight,
          });
        }
      };

      // Delayed initial update to allow SVGs to load
      const timer = setTimeout(updateDimensions, 100);
      updateDimensions();

      window.addEventListener("resize", updateDimensions);
      return () => {
        window.removeEventListener("resize", updateDimensions);
        clearTimeout(timer);
      };
    }
  }, [showText]);

  // Scroll-based position change - detect when past hero section
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let lastScrolled: boolean | null = null;

    const handleScroll = () => {
      // Get hero height (approximately 100vh for the sticky part)
      const scrollThreshold = window.innerHeight * 0.8;
      const newScrolled = window.scrollY > scrollThreshold;

      // Only trigger transition if state actually changes
      if (lastScrolled === newScrolled) return;
      lastScrolled = newScrolled;

      // Clear any pending timeout
      clearTimeout(timeoutId);

      // Start fade out
      setIsTransitioning(true);

      // Change position and fade back in
      timeoutId = setTimeout(() => {
        setIsScrolled(newScrolled);
        setIsTransitioning(false);
      }, 300);
    };

    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      clearTimeout(timeoutId);
    };
  }, []);

  // Active section observer - highlight current section
  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    sections.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setActiveSection(id);
          }
        },
        { threshold: 0.3 }
      );

      observer.observe(el);
      observers.push(observer);
    });

    return () => observers.forEach((o) => o.disconnect());
  }, []);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  // Border visibility: show after load, hide on scroll
  const showBorder = isLoaded && !isScrolled;

  return (
    <nav
      ref={navRef}
      className={`fixed z-[9999] transition-all duration-500 ease-out p-4 backdrop-blur-sm text-base ${
        isScrolled
          ? "right-8 bottom-8"
          : "left-1/2 -translate-x-1/2 top-[15%]"
      }`}
    >
      {/* Animated SVG Border - 4 separate edges */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ overflow: "visible" }}
      >
        {/* Top edge */}
        <line
          x1="0"
          y1="0.5"
          x2={dimensions.width || "100%"}
          y2="0.5"
          stroke="rgba(31,31,31,0.3)"
          strokeWidth="1"
          style={{
            strokeDasharray: dimensions.width || 200,
            strokeDashoffset: showBorder ? 0 : dimensions.width || 200,
            transition: `stroke-dashoffset ${isScrolled ? '0.5s' : '1.2s'} ease-out`,
          }}
        />
        {/* Right edge */}
        <line
          x1={dimensions.width ? dimensions.width - 0.5 : "100%"}
          y1="0"
          x2={dimensions.width ? dimensions.width - 0.5 : "100%"}
          y2={dimensions.height || "100%"}
          stroke="rgba(31,31,31,0.3)"
          strokeWidth="1"
          style={{
            strokeDasharray: dimensions.height || 300,
            strokeDashoffset: showBorder ? 0 : dimensions.height || 300,
            transition: `stroke-dashoffset ${isScrolled ? '0.5s' : '1.2s'} ease-out`,
          }}
        />
        {/* Bottom edge */}
        <line
          x1={dimensions.width || "100%"}
          y1={dimensions.height ? dimensions.height - 0.5 : "100%"}
          x2="0"
          y2={dimensions.height ? dimensions.height - 0.5 : "100%"}
          stroke="rgba(31,31,31,0.3)"
          strokeWidth="1"
          style={{
            strokeDasharray: dimensions.width || 200,
            strokeDashoffset: showBorder ? 0 : dimensions.width || 200,
            transition: `stroke-dashoffset ${isScrolled ? '0.5s' : '1.2s'} ease-out`,
          }}
        />
        {/* Left edge */}
        <line
          x1="0.5"
          y1={dimensions.height || "100%"}
          x2="0.5"
          y2="0"
          stroke="rgba(31,31,31,0.3)"
          strokeWidth="1"
          style={{
            strokeDasharray: dimensions.height || 300,
            strokeDashoffset: showBorder ? 0 : dimensions.height || 300,
            transition: `stroke-dashoffset ${isScrolled ? '0.5s' : '1.2s'} ease-out`,
          }}
        />
      </svg>

      {/* Content */}
      <ul className="flex flex-col gap-3 relative min-w-[290px]">
        {sections.map(({ id, label, numeral, svg, width, height }, index) => {
          const isVisible = showText && !isTransitioning;
          const isActive = activeSection === id;
          const scale = isActive ? MENU_SCALE * 1.3 : MENU_SCALE;

          return (
            <li
              key={id}
              className={`transition-all duration-300 origin-right ${
                isVisible
                  ? "opacity-100 translate-y-0 scale-100"
                  : "opacity-0 translate-y-2 scale-95"
              }`}
              style={{
                transitionDelay: isTransitioning
                  ? `${(sections.length - 1 - index) * 50}ms` // Reverse order for fade out
                  : `${index * 80}ms`, // Normal order for fade in
              }}
            >
              <button
                onClick={() => scrollToSection(id)}
                dir="ltr"
                className={`flex items-center justify-between w-full transition-all duration-300 ${
                  isActive
                    ? "opacity-100"
                    : "opacity-50 hover:opacity-80"
                }`}
              >
                <span className={`font-light text-[#1F1F1F] ${isActive ? "text-sm" : "text-xs"}`}>
                  {numeral}
                </span>
                {svg ? (
                  <Image
                    src={svg}
                    alt={label}
                    width={Math.round(width * scale)}
                    height={Math.round(height * scale)}
                    className="transition-all duration-300"
                    style={{
                      width: Math.round(width * scale),
                      height: "auto",
                    }}
                  />
                ) : (
                  <span
                    className="text-right text-[#1F1F1F]"
                    style={{ fontSize: isActive ? "1.5rem" : "1rem" }}
                  >
                    {label}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
