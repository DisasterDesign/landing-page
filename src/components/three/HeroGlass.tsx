"use client";

import { useEffect, useRef } from "react";

export default function HeroGlass() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    import("./scene").then(({ initScene, destroyScene }) => {
      initScene(container);
      cleanupRef.current = destroyScene;
    });

    return () => {
      const el = container as HTMLElement & { _cleanup?: () => void };
      el._cleanup?.();
      cleanupRef.current?.();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden z-[2] pointer-events-none"
      aria-hidden="true"
    />
  );
}
