"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface Props {
  onRefresh: () => void | Promise<void>;
  children: ReactNode;
  /** Disable on desktop / pointer:fine devices (default: true). */
  touchOnly?: boolean;
}

const TRIGGER = 80;       // px pull distance to trigger refresh
const MAX_PULL = 140;     // visual cap
const RESISTANCE = 0.45;  // pull damping factor

export default function PullToRefresh({ onRefresh, children, touchOnly = true }: Props) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const isTouch = useRef(false);

  useEffect(() => {
    if (!touchOnly) {
      isTouch.current = true;
      return;
    }
    const mq = window.matchMedia("(pointer: coarse)");
    const update = () => {
      isTouch.current = mq.matches;
    };
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [touchOnly]);

  const onTouchStart = (e: React.TouchEvent) => {
    if (!isTouch.current || refreshing) return;
    if (window.scrollY > 0) return;
    startY.current = e.touches[0].clientY;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current === null || refreshing) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta <= 0) {
      setPull(0);
      return;
    }
    if (window.scrollY > 0) {
      // user started pulling but is no longer at the top — abort
      startY.current = null;
      setPull(0);
      return;
    }
    const damped = Math.min(delta * RESISTANCE, MAX_PULL);
    setPull(damped);
  };

  const onTouchEnd = async () => {
    if (startY.current === null) return;
    startY.current = null;
    if (pull >= TRIGGER && !refreshing) {
      setRefreshing(true);
      setPull(TRIGGER);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPull(0);
      }
    } else {
      setPull(0);
    }
  };

  const indicatorOpacity = Math.min(pull / TRIGGER, 1);
  const spinning = refreshing || pull >= TRIGGER;

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <div
        className="relative"
        style={{
          transform: pull > 0 ? `translateY(${pull}px)` : undefined,
          transition: refreshing || pull === 0 ? "transform 0.25s ease" : "none",
        }}
      >
        {/* Pull indicator */}
        <div
          className="absolute inset-x-0 -top-12 flex items-center justify-center pointer-events-none"
          style={{ opacity: indicatorOpacity }}
        >
          <div
            className={`w-8 h-8 rounded-full border-2 border-pink/40 border-t-pink ${
              spinning ? "animate-spin" : ""
            }`}
            style={{
              transform: spinning ? undefined : `rotate(${pull * 4}deg)`,
              transition: spinning ? undefined : "transform 0.05s linear",
            }}
            aria-hidden
          />
        </div>

        {children}
      </div>
    </div>
  );
}
