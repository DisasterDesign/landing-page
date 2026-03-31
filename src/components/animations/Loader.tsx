"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PATHS } from "./LogoSVG";

type Phase = "draw" | "chromatic" | "fly" | "fadeout" | "done";

const DRAW_DURATION = 2;
const STAGGER = 0.05;
const CHROMATIC_DURATION = 0.5;
const FLY_DURATION = 0.8;
const FADE_DURATION = 0.5;

export default function Loader() {
  const [show, setShow] = useState(false);
  const [phase, setPhase] = useState<Phase>("draw");
  const [flyTarget, setFlyTarget] = useState({ x: 0, y: 0, scale: 0.1 });
  const logoContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("fuzion-loaded")) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      sessionStorage.setItem("fuzion-loaded", "true");
      return;
    }
    setShow(true);
    // Hide navbar logo while loader is active
    document.documentElement.classList.add("loader-active");
  }, []);

  useEffect(() => {
    if (!show) return;

    const totalDrawTime = (DRAW_DURATION + STAGGER * (PATHS.length - 1)) * 1000;

    if (phase === "draw") {
      const timer = setTimeout(() => setPhase("chromatic"), totalDrawTime);
      return () => clearTimeout(timer);
    }
    if (phase === "chromatic") {
      const timer = setTimeout(() => {
        // Calculate exact navbar logo position before flying
        const navLogo = document.getElementById("navbar-logo");
        const loaderLogo = logoContainerRef.current;
        if (navLogo && loaderLogo) {
          const navRect = navLogo.getBoundingClientRect();
          const loaderRect = loaderLogo.getBoundingClientRect();

          const navCenterX = navRect.left + navRect.width / 2;
          const navCenterY = navRect.top + navRect.height / 2;
          const loaderCenterX = loaderRect.left + loaderRect.width / 2;
          const loaderCenterY = loaderRect.top + loaderRect.height / 2;

          const targetScale = navRect.height / loaderRect.height;

          setFlyTarget({
            x: navCenterX - loaderCenterX,
            y: navCenterY - loaderCenterY,
            scale: targetScale,
          });
        }
        setPhase("fly");
      }, CHROMATIC_DURATION * 1000);
      return () => clearTimeout(timer);
    }
    if (phase === "fly") {
      const timer = setTimeout(() => setPhase("fadeout"), FLY_DURATION * 1000);
      return () => clearTimeout(timer);
    }
    if (phase === "fadeout") {
      const timer = setTimeout(() => {
        sessionStorage.setItem("fuzion-loaded", "true");
        document.documentElement.classList.remove("loader-active");
        setPhase("done");
      }, FADE_DURATION * 1000);
      return () => clearTimeout(timer);
    }
    if (phase === "done") {
      setShow(false);
    }
  }, [show, phase]);

  const handleAnimationComplete = useCallback(() => {
    // Phase transitions handled by timers
  }, []);

  if (!show) return null;

  const isDrawing = phase === "draw";
  const isChromatic = phase === "chromatic";
  const isFlying = phase === "fly" || phase === "fadeout" || phase === "done";
  const isFading = phase === "fadeout" || phase === "done";
  const drawComplete = !isDrawing;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[9999] bg-black flex items-center justify-center"
          animate={{ opacity: isFading ? 0 : 1 }}
          transition={{ duration: FADE_DURATION }}
          onAnimationComplete={handleAnimationComplete}
        >
          <motion.div
            ref={logoContainerRef}
            className="relative w-[80vw] max-w-[700px] aspect-[700/226]"
            animate={
              isFlying
                ? { scale: flyTarget.scale, x: flyTarget.x, y: flyTarget.y }
                : { scale: 1, x: 0, y: 0 }
            }
            transition={{ duration: FLY_DURATION, ease: [0.76, 0, 0.24, 1] }}
          >
            {/* Chromatic pink layer */}
            {isChromatic && (
              <motion.div
                className="absolute inset-0"
                initial={{ opacity: 0, x: -4, y: 2 }}
                animate={{ opacity: [0, 0.7, 0], x: [-4, -4, 0], y: [2, 2, 0] }}
                transition={{ duration: CHROMATIC_DURATION, ease: "easeInOut" }}
              >
                <svg viewBox="0 0 700 226" className="w-full h-full" style={{ filter: "brightness(0) saturate(100%) invert(15%) sepia(95%) saturate(6000%) hue-rotate(310deg) brightness(95%) contrast(105%)" }}>
                  <g>
                    {PATHS.map((p, i) => (
                      <path key={i} d={p.d} fill={p.fill} />
                    ))}
                  </g>
                </svg>
              </motion.div>
            )}

            {/* Chromatic cyan layer */}
            {isChromatic && (
              <motion.div
                className="absolute inset-0"
                initial={{ opacity: 0, x: 4, y: -2 }}
                animate={{ opacity: [0, 0.7, 0], x: [4, 4, 0], y: [-2, -2, 0] }}
                transition={{ duration: CHROMATIC_DURATION, ease: "easeInOut" }}
              >
                <svg viewBox="0 0 700 226" className="w-full h-full" style={{ filter: "brightness(0) saturate(100%) invert(80%) sepia(60%) saturate(5000%) hue-rotate(140deg) brightness(105%) contrast(105%)" }}>
                  <g>
                    {PATHS.map((p, i) => (
                      <path key={i} d={p.d} fill={p.fill} />
                    ))}
                  </g>
                </svg>
              </motion.div>
            )}

            {/* Main logo - draw animation then filled */}
            <svg
              viewBox="0 0 700 226"
              xmlns="http://www.w3.org/2000/svg"
              className="absolute inset-0 w-full h-full"
            >
              <g>
                {PATHS.map((p, i) => (
                  <path
                    key={i}
                    d={p.d}
                    className="loader-path"
                    style={{
                      ["--path-fill" as string]: p.fill,
                      fill: drawComplete ? p.fill : "transparent",
                      stroke: drawComplete ? "none" : "white",
                      strokeWidth: drawComplete ? 0 : 2,
                      strokeDasharray: drawComplete ? "none" : 3000,
                      strokeDashoffset: drawComplete ? 0 : 3000,
                      animation: drawComplete
                        ? "none"
                        : `drawPath ${DRAW_DURATION}s ease ${i * STAGGER}s forwards`,
                    }}
                  />
                ))}
              </g>
            </svg>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
