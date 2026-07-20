"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import MagneticButton from "@/components/animations/MagneticButton";
import HeroGlass from "@/components/three/HeroGlass";

const letterVariants = {
  hidden: { opacity: 0, y: 50 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: 0.3 + i * 0.04,
      duration: 0.7,
      ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number],
    },
  }),
};

export default function Hero() {
  // Don't animate until loader is done
  const [ready, setReady] = useState(false);
  const [showChromatic, setShowChromatic] = useState(false);

  useEffect(() => {
    // If loader already done (revisit), start immediately
    if (sessionStorage.getItem("fuzion-loaded")) {
      setReady(true);
      return;
    }
    // Otherwise wait for loader to finish + small delay for fade-out
    const interval = setInterval(() => {
      if (sessionStorage.getItem("fuzion-loaded")) {
        clearInterval(interval);
        setTimeout(() => setReady(true), 400);
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Show chromatic effect after letters finish animating
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => setShowChromatic(true), 1500);
    return () => clearTimeout(timer);
  }, [ready]);

  return (
    <section className="relative h-screen min-h-[700px] overflow-hidden bg-transparent flex flex-col">

      {/* ===== TOP: FUZION WEBZ centered, big ===== */}
      <div className="pt-20 md:pt-24 px-6">
        <motion.h1
          dir="ltr"
          className="text-center font-extrabold leading-[0.85] tracking-[-0.04em]"
          initial="hidden"
          animate={ready ? "visible" : "hidden"}
        >
          <span
            className={`block text-[clamp(3rem,13vw,15rem)] ${showChromatic ? "chromatic-hover chromatic-always" : ""}`}
            data-text="FUZION WEBZ"
            style={{ visibility: ready ? "visible" : "hidden" }}
          >
            {"FUZION".split("").map((char, i) => (
              <motion.span key={i} className="inline-block" custom={i} variants={letterVariants}>
                {char}
              </motion.span>
            ))}
            <motion.span className="inline-block" custom={6} variants={letterVariants}>
              &nbsp;
            </motion.span>
            {"WEBZ".split("").map((char, i) => (
              <motion.span key={`w${i}`} className="inline-block text-black" custom={i + 7} variants={letterVariants}>
                {char}
              </motion.span>
            ))}
          </span>
        </motion.h1>

        {/* Tagline under title */}
        <motion.p
          className="text-center text-[10px] sm:text-[11px] md:text-[13px] tracking-[0.35em] uppercase text-gray-500 mt-5"
          initial={{ opacity: 0 }}
          animate={ready ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: 0.8, duration: 0.6 }}
        >
          Digital Design Studio — Israel
        </motion.p>
      </div>

      {/* ===== MIDDLE: grid — RTL means col1=right, col2=left ===== */}
      <div className="flex-1 flex items-center">
        <div className="w-full max-w-[1400px] mx-auto px-6 md:px-10 grid grid-cols-1 lg:grid-cols-2 gap-4 items-center">

          {/* Col 1 — 3D (shows on RIGHT in RTL) */}
          <div className="relative h-[250px] sm:h-[300px] md:h-[400px] lg:h-[550px]">
            <HeroGlass />
          </div>

          {/* Col 2 — Text (shows on LEFT in RTL) */}
          <div className="relative z-10 flex flex-col text-center lg:text-right">

            <motion.div
              className="w-16 h-[1px] bg-gradient-to-r from-pink to-cyan mb-6 lg:mr-0 lg:ml-auto mx-auto"
              initial={{ scaleX: 0 }}
              animate={ready ? { scaleX: 1 } : { scaleX: 0 }}
              transition={{ delay: 1.0, duration: 0.5 }}
              style={{ originX: 1 }}
            />

            <motion.p
              className="text-lg md:text-xl lg:text-2xl text-gray-700 max-w-md leading-relaxed lg:mr-0 lg:ml-auto mx-auto"
              initial={{ opacity: 0, y: 10 }}
              animate={ready ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
              transition={{ delay: 1.1, duration: 0.5 }}
            >
              סטודיו בוטיק לעיצוב ובניית אתרים מתקדמים שממירים מבקרים ללקוחות
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={ready ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
              transition={{ delay: 1.3, duration: 0.5 }}
              className="mt-8 lg:mr-0 lg:ml-auto mx-auto"
            >
              <MagneticButton>
                <a
                  href="#contact"
                  className="group inline-flex items-center gap-3 border border-black/30 text-black/80 px-8 py-3.5 rounded-full text-base hover:border-black hover:text-black hover:shadow-[0_0_30px_rgba(229,3,162,0.3)] transition-all duration-300"
                >
                  בואו נדבר
                  <span className="inline-block transition-transform duration-300 group-hover:-translate-x-1 text-pink">←</span>
                </a>
              </MagneticButton>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Mobile 3D behind content */}
      <div className="absolute inset-0 lg:hidden z-0 opacity-15">
        <HeroGlass />
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-2"
        initial={{ opacity: 0 }}
        animate={ready ? { opacity: 1 } : { opacity: 0 }}
        transition={{ delay: 1.8, duration: 0.6 }}
      >
        <span className="text-[9px] tracking-[0.2em] uppercase text-gray-500">Scroll</span>
        <motion.div
          className="w-[1px] h-6 bg-gradient-to-b from-gray-700 to-transparent"
          animate={{ scaleY: [1, 0.4, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          style={{ originY: 0 }}
        />
      </motion.div>
    </section>
  );
}
