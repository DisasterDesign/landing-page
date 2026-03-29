"use client";

import { useEffect, useState, useCallback } from "react";
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("fuzion-loaded")) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      sessionStorage.setItem("fuzion-loaded", "true");
      return;
    }
    setShow(true);
  }, []);

  useEffect(() => {
    if (!show) return;

    const totalDrawTime = (DRAW_DURATION + STAGGER * (PATHS.length - 1)) * 1000;

    if (phase === "draw") {
      const timer = setTimeout(() => setPhase("chromatic"), totalDrawTime);
      return () => clearTimeout(timer);
    }
    if (phase === "chromatic") {
      const timer = setTimeout(() => setPhase("fly"), CHROMATIC_DURATION * 1000);
      return () => clearTimeout(timer);
    }
    if (phase === "fly") {
      const timer = setTimeout(() => setPhase("fadeout"), FLY_DURATION * 1000);
      return () => clearTimeout(timer);
    }
    if (phase === "fadeout") {
      const timer = setTimeout(() => {
        sessionStorage.setItem("fuzion-loaded", "true");
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
            className="relative w-[400px] h-[400px] md:w-[560px] md:h-[560px]"
            animate={
              isFlying
                ? { scale: 0.1, x: "40vw", y: "-42vh" }
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
                <svg viewBox="0 0 1080 1080" className="w-full h-full" style={{ filter: "brightness(0) saturate(100%) invert(15%) sepia(95%) saturate(6000%) hue-rotate(310deg) brightness(95%) contrast(105%)" }}>
                  <defs>
                    <clipPath id="loaderClipPink">
                      <rect width="700" height="226" fill="white" transform="translate(211 427)" />
                    </clipPath>
                  </defs>
                  <g clipPath="url(#loaderClipPink)">
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
                <svg viewBox="0 0 1080 1080" className="w-full h-full" style={{ filter: "brightness(0) saturate(100%) invert(80%) sepia(60%) saturate(5000%) hue-rotate(140deg) brightness(105%) contrast(105%)" }}>
                  <defs>
                    <clipPath id="loaderClipCyan">
                      <rect width="700" height="226" fill="white" transform="translate(211 427)" />
                    </clipPath>
                  </defs>
                  <g clipPath="url(#loaderClipCyan)">
                    {PATHS.map((p, i) => (
                      <path key={i} d={p.d} fill={p.fill} />
                    ))}
                  </g>
                </svg>
              </motion.div>
            )}

            {/* Main logo - draw animation then filled */}
            <svg
              viewBox="0 0 1080 1080"
              xmlns="http://www.w3.org/2000/svg"
              className="absolute inset-0 w-full h-full"
            >
              <defs>
                <clipPath id="loaderClip0">
                  <rect width="700" height="226" fill="white" transform="translate(211 427)" />
                </clipPath>
              </defs>
              <g clipPath="url(#loaderClip0)">
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
                        : `drawPath ${DRAW_DURATION}s ease forwards`,
                      animationDelay: drawComplete ? "0s" : `${i * STAGGER}s`,
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
