"use client";

import { useEffect, useRef } from "react";

// Pink + cyan alternating hex strokes
const HEX_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='17.321' height='30'><path d='M8.66 0 17.321 5 17.321 15 8.66 20 0 15 0 5Z' fill='none' stroke='rgba(229,3,162,1)' stroke-width='0.4'/><path d='M0 15 8.66 20 8.66 30 0 35 -8.66 30 -8.66 20Z' fill='none' stroke='rgba(1,255,255,1)' stroke-width='0.4'/><path d='M17.321 15 25.981 20 25.981 30 17.321 35 8.66 30 8.66 20Z' fill='none' stroke='rgba(229,3,162,1)' stroke-width='0.4'/></svg>`;

const hexBg = `url("data:image/svg+xml,${encodeURIComponent(HEX_SVG)}")`;

export default function GridBackground() {
  const topRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const cursorGridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.innerWidth < 768) return;

    const scrollContainer = document.getElementById("smooth-content");
    if (!scrollContainer) return;

    let currentPixel = 0;

    // === Scroll pattern (Buzzworthy-style) ===
    let targetTopY = -100;
    let targetBottomY = 100;
    let currentTopY = -100;
    let currentBottomY = 100;

    const bgAnim = () => {
      const newPixel = scrollContainer.scrollTop;
      const diff = newPixel - currentPixel;
      const speed = Math.abs(Math.round(diff * 5) / 100);
      const speedMax = Math.min(Math.max(speed, 0), 1);

      if (Math.abs(diff) > 0.5) {
        if (diff > 0) {
          // Scrolling DOWN → bottom slides in (from +100% toward 0%)
          targetTopY = -100;
          targetBottomY = 100 - speedMax * 200;
        } else {
          // Scrolling UP → top slides in (from -100% toward 0%)
          targetTopY = -100 + speedMax * 200;
          targetBottomY = 100;
        }
      } else {
        // Not scrolling → slide back out
        targetTopY = -100;
        targetBottomY = 100;
      }

      // Lerp for smooth in/out
      currentTopY += (targetTopY - currentTopY) * 0.12;
      currentBottomY += (targetBottomY - currentBottomY) * 0.12;

      if (topRef.current) topRef.current.style.transform = `translateY(${currentTopY}%)`;
      if (bottomRef.current) bottomRef.current.style.transform = `translateY(${currentBottomY}%)`;

      currentPixel = newPixel;
      requestAnimationFrame(bgAnim);
    };
    bgAnim();

    // === Mouse cursor reveal ===
    const grid = cursorGridRef.current;
    if (!grid) return;

    const onMouseMove = (e: MouseEvent) => {
      const rect = scrollContainer.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      grid.style.maskImage = `radial-gradient(circle 150px at ${x}px ${y}px, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.12) 50%, transparent 100%)`;
      grid.style.webkitMaskImage = `radial-gradient(circle 150px at ${x}px ${y}px, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.12) 50%, transparent 100%)`;
      grid.style.opacity = "1";
    };

    const onMouseLeave = () => {
      if (grid) grid.style.opacity = "0";
    };

    scrollContainer.addEventListener("mousemove", onMouseMove);
    scrollContainer.addEventListener("mouseleave", onMouseLeave);

    return () => {
      scrollContainer.removeEventListener("mousemove", onMouseMove);
      scrollContainer.removeEventListener("mouseleave", onMouseLeave);
    };
  }, []);

  const patternStyle: React.CSSProperties = {
    backgroundImage: hexBg,
    backgroundSize: "17.321px 30px",
    backgroundRepeat: "repeat",
  };

  return (
    <>
      {/* Scroll-reactive pattern from TOP — slides down on scroll up */}
      <div
        ref={topRef}
        className="absolute top-0 left-0 right-0 h-full pointer-events-none z-[2] opacity-25 hidden md:block"
        style={{ ...patternStyle, transform: "translateY(-100%)", willChange: "transform" }}
      />

      {/* Scroll-reactive pattern from BOTTOM — slides up on scroll down */}
      <div
        ref={bottomRef}
        className="absolute bottom-0 left-0 right-0 h-full pointer-events-none z-[2] opacity-25 hidden md:block"
        style={{ ...patternStyle, transform: "translateY(100%)", willChange: "transform" }}
      />

      {/* Mouse cursor reveal grid */}
      <div
        ref={cursorGridRef}
        className="absolute inset-0 pointer-events-none z-[2] opacity-0 transition-opacity duration-300 hidden md:block"
        style={patternStyle}
      />
    </>
  );
}
