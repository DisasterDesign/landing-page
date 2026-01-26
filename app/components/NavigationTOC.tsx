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

export default function NavigationTOC() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("hero");
  const [showText, setShowText] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  // Always white text - all sections are dark
  const navRef = useRef<HTMLDivElement>(null);

  // Entrance animation timing
  useEffect(() => {
    // Show text after Big Bang entrance animation completes
    // Animation: 300ms delay + 2500ms circle + 300ms lines + 800ms explosion = ~3500ms
    const textTimer = setTimeout(() => {
      setShowText(true);
    }, 3600);

    return () => {
      clearTimeout(textTimer);
    };
  }, []);



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

  // Always white text - all sections are dark
  const textColor = "#ffffff";
  const svgFilter = "brightness(0) invert(1)";

  return (
    <nav
      ref={navRef}
      className={`fixed z-[9999] transition-all duration-500 ease-out p-4 backdrop-blur-sm text-base ${
        isScrolled
          ? "right-8 bottom-8"
          : "left-1/2 -translate-x-1/2 top-[15%]"
      }`}
    >
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
                className={`flex items-center justify-between w-full transition-all duration-500 ${
                  isActive
                    ? "opacity-100"
                    : "opacity-50 hover:opacity-80"
                }`}
              >
                <span
                  className={`font-light transition-colors duration-500 ${isActive ? "text-sm" : "text-xs"}`}
                  style={{ color: textColor }}
                >
                  {numeral}
                </span>
                {svg ? (
                  <Image
                    src={svg}
                    alt={label}
                    width={Math.round(width * scale)}
                    height={Math.round(height * scale)}
                    className="transition-all duration-500"
                    style={{
                      width: Math.round(width * scale),
                      height: "auto",
                      filter: svgFilter,
                    }}
                  />
                ) : (
                  <span
                    className="text-right transition-colors duration-500"
                    style={{ fontSize: isActive ? "1.5rem" : "1rem", color: textColor }}
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
