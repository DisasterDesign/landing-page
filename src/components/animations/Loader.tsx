"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

type Phase = "reveal" | "chromatic-in" | "chromatic-out" | "fly" | "fadeout" | "done";

export default function Loader() {
  const [show, setShow] = useState(false);
  const [phase, setPhase] = useState<Phase>("reveal");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("fuzion-loaded")) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      sessionStorage.setItem("fuzion-loaded", "true");
      return;
    }
    setShow(true);
  }, []);

  const nextPhase = useCallback(() => {
    setPhase((p) => {
      switch (p) {
        case "reveal": return "chromatic-in";
        case "chromatic-in": return "chromatic-out";
        case "chromatic-out": return "fly";
        case "fly": return "fadeout";
        case "fadeout":
          sessionStorage.setItem("fuzion-loaded", "true");
          return "done";
        default: return p;
      }
    });
  }, []);

  useEffect(() => {
    if (phase === "done") setShow(false);
  }, [phase]);

  if (!show) return null;

  const isChromaticIn = phase === "chromatic-in";
  const isFlying = phase === "fly" || phase === "fadeout" || phase === "done";
  const isFading = phase === "fadeout" || phase === "done";

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[9999] bg-black flex items-center justify-center"
          animate={{ opacity: isFading ? 0 : 1 }}
          transition={{ duration: 0.4 }}
          onAnimationComplete={() => {
            if (phase === "fadeout") nextPhase();
          }}
        >
          <motion.div
            className="relative w-[200px] h-[200px] md:w-[280px] md:h-[280px]"
            animate={
              isFlying
                ? { scale: 0.12, x: "30vw", y: "-38vh" }
                : { scale: 1, x: 0, y: 0 }
            }
            transition={{ duration: 0.8, ease: [0.76, 0, 0.24, 1] }}
            onAnimationComplete={() => {
              if (phase === "fly") nextPhase();
            }}
          >
            {/* Pink chromatic layer */}
            <motion.img
              src="/logo-white.svg"
              alt=""
              className="absolute inset-0 w-full h-full object-contain"
              style={{
                filter: "brightness(0) saturate(100%) invert(15%) sepia(95%) saturate(6000%) hue-rotate(310deg) brightness(95%) contrast(105%)",
              }}
              animate={{
                opacity: isChromaticIn ? 0.7 : 0,
                x: isChromaticIn ? -4 : 0,
                y: isChromaticIn ? 2 : 0,
              }}
              transition={{ duration: 0.3 }}
              aria-hidden="true"
            />

            {/* Cyan chromatic layer */}
            <motion.img
              src="/logo-white.svg"
              alt=""
              className="absolute inset-0 w-full h-full object-contain"
              style={{
                filter: "brightness(0) saturate(100%) invert(80%) sepia(60%) saturate(5000%) hue-rotate(140deg) brightness(105%) contrast(105%)",
              }}
              animate={{
                opacity: isChromaticIn ? 0.7 : 0,
                x: isChromaticIn ? 4 : 0,
                y: isChromaticIn ? -2 : 0,
              }}
              transition={{ duration: 0.3 }}
              onAnimationComplete={() => {
                if (phase === "chromatic-in") {
                  setTimeout(() => nextPhase(), 300);
                } else if (phase === "chromatic-out") {
                  nextPhase();
                }
              }}
              aria-hidden="true"
            />

            {/* Main logo — clip-path wipe reveal */}
            <motion.img
              src="/logo-white.svg"
              alt="Fuzion Webz"
              className="absolute inset-0 w-full h-full object-contain"
              initial={{ clipPath: "inset(0 100% 0 0)" }}
              animate={{ clipPath: "inset(0 0% 0 0)" }}
              transition={{ duration: 1.2, ease: [0.25, 0.1, 0.25, 1] }}
              onAnimationComplete={() => {
                if (phase === "reveal") nextPhase();
              }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
