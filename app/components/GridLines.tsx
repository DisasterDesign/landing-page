"use client";

import { useEffect, useState, useRef } from "react";

export default function GridLines() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [exitPhase, setExitPhase] = useState<"none" | "multiply" | "multiplyDrawn" | "fadeOut">("none");
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Base line counts
  const baseHorizontalLines = 3;
  const baseVerticalLines = 4;

  // Multiplied counts for exit transition (x2)
  const horizontalLines = exitPhase !== "none" ? baseHorizontalLines * 2 : baseHorizontalLines;
  const verticalLines = exitPhase !== "none" ? baseVerticalLines * 2 : baseVerticalLines;

  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);

    // Start animation
    setTimeout(() => setIsLoaded(true), 100);

    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  // Scroll-based exit animation
  useEffect(() => {
    const handleScroll = () => {
      const scrollThreshold = window.innerHeight * 0.8;
      const shouldExit = window.scrollY > scrollThreshold;

      if (shouldExit && !isExiting) {
        setIsExiting(true);
        // Phase 1: Multiply lines (start hidden)
        setExitPhase("multiply");
        // Phase 2: Animate lines in (after a tick for DOM to render)
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setExitPhase("multiplyDrawn");
          });
        });
        // Phase 3: Fade out all lines together after draw-in animation completes
        setTimeout(() => setExitPhase("fadeOut"), 800);
      } else if (!shouldExit && isExiting) {
        setIsExiting(false);
        setExitPhase("none");
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isExiting]);

  return (
    <svg
      ref={svgRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-[1]"
      style={{ opacity: 0.15 }}
    >
      {/* Horizontal lines */}
      {Array.from({ length: horizontalLines }, (_, i) => ((i + 1) * 100) / (horizontalLines + 1)).map((percent, i) => {
        const width = dimensions.width || 2000;
        let offset = width; // initial state - hidden
        if (isLoaded && exitPhase === "none") offset = 0; // visible
        if (exitPhase === "multiply") offset = width; // start hidden
        if (exitPhase === "multiplyDrawn") offset = 0; // animate in
        if (exitPhase === "fadeOut") offset = -width; // all exit together

        return (
          <line
            key={`h-${i}-${horizontalLines}`}
            x1="0"
            y1={`${percent}%`}
            x2="100%"
            y2={`${percent}%`}
            stroke="#1F1F1F"
            strokeWidth="1"
            style={{
              strokeDasharray: width,
              strokeDashoffset: offset,
              transition: exitPhase === "fadeOut"
                ? 'stroke-dashoffset 0.6s ease-out' // All exit together, no delay
                : `stroke-dashoffset 0.6s ease-out ${i * 0.05}s`,
            }}
          />
        );
      })}

      {/* Vertical lines */}
      {Array.from({ length: verticalLines }, (_, i) => ((i + 1) * 100) / (verticalLines + 1)).map((percent, i) => {
        const height = dimensions.height || 2000;
        let offset = height; // initial state - hidden
        if (isLoaded && exitPhase === "none") offset = 0; // visible
        if (exitPhase === "multiply") offset = height; // start hidden
        if (exitPhase === "multiplyDrawn") offset = 0; // animate in
        if (exitPhase === "fadeOut") offset = -height; // all exit together

        return (
          <line
            key={`v-${i}-${verticalLines}`}
            x1={`${percent}%`}
            y1="0"
            x2={`${percent}%`}
            y2="100%"
            stroke="#1F1F1F"
            strokeWidth="1"
            style={{
              strokeDasharray: height,
              strokeDashoffset: offset,
              transition: exitPhase === "fadeOut"
                ? 'stroke-dashoffset 0.6s ease-out' // All exit together, no delay
                : `stroke-dashoffset 0.6s ease-out ${i * 0.05}s`,
            }}
          />
        );
      })}

      {/* Diagonal lines (X) - only during exit */}
      {exitPhase !== "none" && (
        <>
          {/* Top-right to bottom-left */}
          <line
            x1="100%"
            y1="0"
            x2="0"
            y2="100%"
            stroke="#1F1F1F"
            strokeWidth="1"
            style={{
              strokeDasharray: Math.sqrt(dimensions.width ** 2 + dimensions.height ** 2) || 3000,
              strokeDashoffset: exitPhase === "fadeOut"
                ? -(Math.sqrt(dimensions.width ** 2 + dimensions.height ** 2) || 3000)
                : exitPhase === "multiply"
                  ? (Math.sqrt(dimensions.width ** 2 + dimensions.height ** 2) || 3000)
                  : 0,
              transition: exitPhase === "fadeOut"
                ? 'stroke-dashoffset 0.6s ease-out'
                : 'stroke-dashoffset 0.6s ease-out',
            }}
          />
          {/* Top-left to bottom-right */}
          <line
            x1="0"
            y1="0"
            x2="100%"
            y2="100%"
            stroke="#1F1F1F"
            strokeWidth="1"
            style={{
              strokeDasharray: Math.sqrt(dimensions.width ** 2 + dimensions.height ** 2) || 3000,
              strokeDashoffset: exitPhase === "fadeOut"
                ? -(Math.sqrt(dimensions.width ** 2 + dimensions.height ** 2) || 3000)
                : exitPhase === "multiply"
                  ? (Math.sqrt(dimensions.width ** 2 + dimensions.height ** 2) || 3000)
                  : 0,
              transition: exitPhase === "fadeOut"
                ? 'stroke-dashoffset 0.6s ease-out'
                : 'stroke-dashoffset 0.6s ease-out 0.1s',
            }}
          />
        </>
      )}
    </svg>
  );
}
