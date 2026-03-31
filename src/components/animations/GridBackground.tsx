"use client";

import { useEffect, useRef } from "react";

// Smaller hex: side=10px, tile=17.32×30
const HEX_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='17.321' height='30'><path d='M8.66 0 17.321 5 17.321 15 8.66 20 0 15 0 5Z' fill='none' stroke='rgba(255,255,255,0.15)' stroke-width='0.4'/><path d='M0 15 8.66 20 8.66 30 0 35 -8.66 30 -8.66 20Z' fill='none' stroke='rgba(255,255,255,0.15)' stroke-width='0.4'/><path d='M17.321 15 25.981 20 25.981 30 17.321 35 8.66 30 8.66 20Z' fill='none' stroke='rgba(255,255,255,0.15)' stroke-width='0.4'/></svg>`;

export default function GridBackground() {
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.innerWidth < 768) return;

    const grid = gridRef.current;
    if (!grid) return;

    const onMouseMove = (e: MouseEvent) => {
      const scrollContainer = document.getElementById("smooth-content");
      if (!scrollContainer) return;
      const rect = scrollContainer.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      grid.style.maskImage = `radial-gradient(circle 120px at ${x}px ${y}px, black 0%, transparent 100%)`;
      grid.style.webkitMaskImage = `radial-gradient(circle 120px at ${x}px ${y}px, black 0%, transparent 100%)`;
      grid.style.opacity = "1";
    };

    const onMouseLeave = () => {
      grid.style.opacity = "0";
    };

    const scrollContainer = document.getElementById("smooth-content");
    scrollContainer?.addEventListener("mousemove", onMouseMove);
    scrollContainer?.addEventListener("mouseleave", onMouseLeave);

    return () => {
      scrollContainer?.removeEventListener("mousemove", onMouseMove);
      scrollContainer?.removeEventListener("mouseleave", onMouseLeave);
    };
  }, []);

  return (
    <div
      ref={gridRef}
      className="absolute inset-0 pointer-events-none z-[2] opacity-0 transition-opacity duration-300 hidden md:block"
      style={{
        backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(HEX_SVG)}")`,
        backgroundSize: "17.321px 30px",
        backgroundRepeat: "repeat",
      }}
    />
  );
}
