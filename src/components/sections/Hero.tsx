"use client";

import { motion } from "framer-motion";
import MagneticButton from "@/components/animations/MagneticButton";
import ParallaxLayer from "@/components/animations/ParallaxLayer";

const letterVariants = {
  hidden: { opacity: 0, y: 80, rotateX: 90 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    rotateX: 0,
    transition: {
      delay: 0.3 + i * 0.05,
      duration: 0.8,
      ease: [0.25, 0.1, 0.25, 1] as [number, number, number, number],
    },
  }),
};

export default function Hero() {
  const title = "FUZION WEBZ";

  return (
    <section className="relative h-screen flex items-center justify-center overflow-hidden bg-transparent">
      {/* Floating decorations */}
      <ParallaxLayer speed={0.3} className="absolute top-20 right-20 opacity-30">
        <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
          <circle cx="60" cy="60" r="50" stroke="#E503A2" strokeWidth="2" />
          <circle cx="60" cy="60" r="30" stroke="#01FFFF" strokeWidth="1" />
        </svg>
      </ParallaxLayer>

      <ParallaxLayer speed={0.6} className="absolute bottom-32 left-16 opacity-20">
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
          <rect x="10" y="10" width="60" height="60" stroke="#01FFFF" strokeWidth="2" transform="rotate(45 40 40)" />
        </svg>
      </ParallaxLayer>

      <ParallaxLayer speed={0.4} className="absolute top-40 left-1/4 opacity-15">
        <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
          <polygon points="30,5 55,50 5,50" stroke="#E503A2" strokeWidth="2" />
        </svg>
      </ParallaxLayer>

      {/* Content */}
      <div className="relative z-10 text-center px-6">
        <motion.h1
          className="chromatic-hover chromatic-always text-6xl sm:text-7xl md:text-8xl lg:text-[120px] font-extrabold leading-none tracking-tighter"
          data-text={title}
          style={{ perspective: "600px" }}
          initial="hidden"
          animate="visible"
        >
          {title.split("").map((char, i) => (
            <motion.span
              key={i}
              className="inline-block"
              custom={i}
              variants={letterVariants}
              style={{ display: char === " " ? "inline" : undefined }}
            >
              {char === " " ? "\u00A0" : char}
            </motion.span>
          ))}
        </motion.h1>

        <motion.p
          className="mt-6 text-lg md:text-xl text-gray-300 max-w-lg mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.6 }}
        >
          בניית אתרים מתקדמים שממירים מבקרים ללקוחות
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5, duration: 0.6 }}
          className="mt-10"
        >
          <MagneticButton>
            <a
              href="#contact"
              className="inline-block bg-pink text-white px-10 py-4 rounded-full text-lg font-bold hover:bg-pink-light hover:shadow-[0_0_40px_rgba(229,3,162,0.5)] transition-all duration-300"
            >
              בואו נדבר
            </a>
          </MagneticButton>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2"
          className="opacity-50"
        >
          <path d="M12 5v14M5 12l7 7 7-7" />
        </svg>
      </motion.div>
    </section>
  );
}
