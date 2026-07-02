"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

export default function CustomCursor() {
  const [cursorVariant, setCursorVariant] = useState<"default" | "pointer" | "view" | "drag">("default");
  const [isTouch] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia("(pointer: coarse)").matches
  );

  const cursorX = useMotionValue(0);
  const cursorY = useMotionValue(0);
  const springX = useSpring(cursorX, { damping: 25, stiffness: 300 });
  const springY = useSpring(cursorY, { damping: 25, stiffness: 300 });

  // Opt-in body class so globals.css only hides the system cursor when our
  // custom cursor is actually active. If this component fails to mount the
  // class is never added and the native cursor stays visible.
  useEffect(() => {
    if (isTouch) return;
    document.body.classList.add("js-custom-cursor");
    return () => {
      document.body.classList.remove("js-custom-cursor");
    };
  }, [isTouch]);

  useEffect(() => {
    if (isTouch) return;

    const handleMouseMove = (e: MouseEvent) => {
      cursorX.set(e.clientX);
      cursorY.set(e.clientY);
    };

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const cursorType = target.closest("[data-cursor]")?.getAttribute("data-cursor");
      // Explicit data-cursor wins over the generic a/button fallback — otherwise
      // data-cursor="view" on <a> cards silently resolves to the pointer dot.
      if (cursorType === "view") {
        setCursorVariant("view");
      } else if (cursorType === "drag") {
        setCursorVariant("drag");
      } else if (cursorType === "pointer" || target.closest("a, button")) {
        setCursorVariant("pointer");
      } else {
        setCursorVariant("default");
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseover", handleMouseOver);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseover", handleMouseOver);
    };
  }, [isTouch, cursorX, cursorY]);

  if (isTouch) return null;

  const sizes = {
    default: 14,
    pointer: 48,
    view: 64,
    drag: 48,
  };

  const size = sizes[cursorVariant];

  return (
    <motion.div
      className="fixed top-0 left-0 z-[9999] pointer-events-none flex items-center justify-center"
      style={{
        x: springX,
        y: springY,
        width: size,
        height: size,
        translateX: "-50%",
        translateY: "-50%",
      }}
      animate={{
        width: size,
        height: size,
      }}
      transition={{ type: "spring", damping: 20, stiffness: 300 }}
    >
      <div
        className="rounded-full bg-black shadow-[0_0_0_1.5px_rgba(255,255,255,0.85),0_2px_10px_rgba(0,0,0,0.25)]"
        style={{
          width: cursorVariant === "default" ? 14 : "100%",
          height: cursorVariant === "default" ? 14 : "100%",
          transition: "width 0.2s, height 0.2s",
        }}
      />
      {cursorVariant === "view" && (
        <span className="absolute text-white text-xs font-bold">View</span>
      )}
      {cursorVariant === "drag" && (
        <span className="absolute text-white text-xs font-bold">⟷</span>
      )}
    </motion.div>
  );
}
