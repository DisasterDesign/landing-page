"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";

// Dynamic import for TearCanvas to avoid SSR issues
const TearCanvas = dynamic(() => import("./TearCanvas"), {
  ssr: false,
  loading: () => null,
});

interface TearTransitionProps {
  onProgressChange?: (progress: number) => void;
  heroCanvas?: HTMLCanvasElement | null;
}

// Check WebGL support
function checkWebGLSupport(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch (e) {
    return false;
  }
}

// CSS fallback component
function TearFallback({ progress }: { progress: number }) {
  const radius = progress * 100;
  return (
    <div
      className="fixed inset-0 z-[4] pointer-events-none"
      style={{
        background: `radial-gradient(circle at center, transparent ${radius}%, #FDF4EB ${radius + 5}%)`,
      }}
    />
  );
}

export default function TearTransition({ onProgressChange, heroCanvas }: TearTransitionProps) {
  const [tearProgress, setTearProgress] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [webglSupported, setWebglSupported] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const scrollTicking = useRef(false);

  // Notify parent of progress changes
  useEffect(() => {
    onProgressChange?.(tearProgress);
  }, [tearProgress, onProgressChange]);

  // Check for WebGL support and reduced motion preference
  useEffect(() => {
    setWebglSupported(checkWebGLSupport());
    setPrefersReducedMotion(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }, []);

  // Handle resize for mobile detection
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Scroll handler to calculate tear progress
  const handleScroll = useCallback(() => {
    if (scrollTicking.current) return;

    scrollTicking.current = true;
    requestAnimationFrame(() => {
      const heroSection = document.getElementById("hero");
      if (!heroSection) {
        scrollTicking.current = false;
        return;
      }

      const rect = heroSection.getBoundingClientRect();
      const heroHeight = heroSection.offsetHeight;
      const windowHeight = window.innerHeight;

      // Calculate hero scroll progress (0-1)
      const heroProgress = Math.min(
        Math.max(-rect.top / (heroHeight - windowHeight), 0),
        1
      );

      // Map hero progress 0.2-1.0 to tear progress 0-1
      // Tear starts at 20% hero scroll and completes at 100%
      const rawTearProgress = Math.max(0, (heroProgress - 0.2) / 0.8);
      const clampedProgress = Math.min(1, rawTearProgress);

      setTearProgress(clampedProgress);

      // Active when hero progress is between 0.15 and 1.05 (with buffer)
      setIsActive(heroProgress > 0.15 && heroProgress < 1.05);

      scrollTicking.current = false;
    });
  }, []);

  // Set up scroll listener
  useEffect(() => {
    window.addEventListener("scroll", handleScroll, { passive: true });
    // Initial check
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // Don't render if not active or progress is 0
  if (!isActive || tearProgress === 0) {
    return null;
  }

  // Use simple fade for reduced motion preference
  if (prefersReducedMotion) {
    return (
      <div
        className="fixed inset-0 z-[4] pointer-events-none transition-opacity duration-500"
        style={{
          backgroundColor: "#FDF4EB",
          opacity: 1 - tearProgress,
        }}
      />
    );
  }

  // Use CSS fallback if WebGL not supported
  if (!webglSupported) {
    return <TearFallback progress={tearProgress} />;
  }

  return (
    <div className="fixed inset-0 z-[4] pointer-events-none">
      <TearCanvas progress={tearProgress} isMobile={isMobile} heroCanvas={heroCanvas} />
    </div>
  );
}
