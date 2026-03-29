"use client";

import { motion } from "framer-motion";
import { useInView } from "@/hooks/useInView";
import type { ReactNode } from "react";

interface ScrollRevealProps {
  children: ReactNode;
  delay?: number;
  duration?: number;
  className?: string;
  direction?: "up" | "down" | "left" | "right";
}

export default function ScrollReveal({
  children,
  delay = 0,
  duration = 0.6,
  className,
  direction = "up",
}: ScrollRevealProps) {
  const { ref, isInView } = useInView({ threshold: 0.1 });

  const directionOffset = {
    up: { y: 40, x: 0 },
    down: { y: -40, x: 0 },
    left: { y: 0, x: 40 },
    right: { y: 0, x: -40 },
  };

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{
        opacity: 0,
        y: directionOffset[direction].y,
        x: directionOffset[direction].x,
        scale: 0.95,
      }}
      animate={
        isInView
          ? { opacity: 1, y: 0, x: 0, scale: 1 }
          : {}
      }
      transition={{
        duration,
        delay,
        ease: [0.25, 0.1, 0.25, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
