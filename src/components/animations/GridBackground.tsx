"use client";

import { motion, useScroll, useTransform } from "framer-motion";

export default function GridBackground() {
  const { scrollYProgress } = useScroll();
  const opacity = useTransform(scrollYProgress, [0, 0.1, 0.9, 1], [0, 0.15, 0.15, 0]);

  return (
    <motion.div
      className="fixed inset-[5px] md:inset-[10px] rounded-[12px] md:rounded-[20px] pointer-events-none z-[2]"
      style={{
        opacity,
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
        `,
        backgroundSize: "60px 60px",
      }}
    />
  );
}
