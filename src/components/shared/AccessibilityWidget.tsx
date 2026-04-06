"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function AccessibilityWidget() {
  const [open, setOpen] = useState(false);
  const [fontSize, setFontSize] = useState(100);
  const [highContrast, setHighContrast] = useState(false);
  const [grayscale, setGrayscale] = useState(false);

  const applyFontSize = (size: number) => {
    setFontSize(size);
    document.documentElement.style.fontSize = `${size}%`;
  };

  const toggleContrast = () => {
    setHighContrast(!highContrast);
    document.documentElement.classList.toggle("high-contrast");
  };

  const toggleGrayscale = () => {
    setGrayscale(!grayscale);
    document.documentElement.classList.toggle("grayscale-mode");
  };

  const reset = () => {
    applyFontSize(100);
    setHighContrast(false);
    setGrayscale(false);
    document.documentElement.classList.remove("high-contrast", "grayscale-mode");
    document.documentElement.style.fontSize = "";
  };

  return (
    <>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(!open)}
        className="absolute bottom-6 right-6 z-[20] w-11 h-11 bg-black border border-white/30 rounded-full flex items-center justify-center hover:border-white/70 hover:bg-white/5 hover:shadow-[0_0_20px_rgba(229,3,162,0.3)] transition-all duration-300 group"
        aria-label="תפריט נגישות"
        aria-pressed={open}
        aria-expanded={open}
        data-cursor="pointer"
      >
        <svg
          viewBox="0 0 24 24"
          className="w-5 h-5 fill-none stroke-white/60 group-hover:stroke-white transition-colors duration-300"
          strokeWidth="1.5"
        >
          <circle cx="12" cy="4.5" r="2" />
          <path d="M7 8.5h10M12 8.5v5m0 0l-3 5.5m3-5.5l3 5.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="absolute bottom-20 right-6 z-[25] w-48 sm:w-56 bg-black border border-white/20 rounded-2xl p-5 flex flex-col gap-4"
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <span className="text-white text-sm font-bold font-meruba">נגישות</span>

            {/* Font size */}
            <div className="flex items-center justify-between">
              <span className="text-white/50 text-xs">גודל טקסט</span>
              <div className="flex gap-2">
                <button
                  onClick={() => applyFontSize(Math.max(80, fontSize - 10))}
                  className="w-9 h-9 border border-white/20 rounded-full text-white text-xs hover:border-white/50 transition-colors"
                >
                  א-
                </button>
                <button
                  onClick={() => applyFontSize(Math.min(140, fontSize + 10))}
                  className="w-9 h-9 border border-white/20 rounded-full text-white text-xs hover:border-white/50 transition-colors"
                >
                  א+
                </button>
              </div>
            </div>

            {/* High contrast */}
            <button
              onClick={toggleContrast}
              className={`text-right text-xs px-3 py-2 rounded-lg border transition-all ${
                highContrast
                  ? "border-white text-white bg-white/10"
                  : "border-white/15 text-white/50 hover:border-white/30"
              }`}
            >
              ניגודיות גבוהה
            </button>

            {/* Grayscale */}
            <button
              onClick={toggleGrayscale}
              className={`text-right text-xs px-3 py-2 rounded-lg border transition-all ${
                grayscale
                  ? "border-white text-white bg-white/10"
                  : "border-white/15 text-white/50 hover:border-white/30"
              }`}
            >
              גווני אפור
            </button>

            {/* Reset */}
            <button
              onClick={reset}
              className="text-right text-xs text-white/30 hover:text-white/60 transition-colors"
            >
              איפוס
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
