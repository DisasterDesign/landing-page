"use client";

import { useEffect, useRef, useCallback, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
}

const DRAG_DISMISS_THRESHOLD = 120; // px to release-and-close

export default function Modal({ isOpen, onClose, children, title }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => {
      const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable && focusable.length > 0) {
        focusable[0].focus();
      }
    });
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleKeyDown]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/80 z-[100]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {isMobile ? (
            // ---------- iOS-style bottom sheet (mobile) ----------
            <motion.div
              className="fixed inset-x-0 bottom-0 z-[101] flex justify-center"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 350 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > DRAG_DISMISS_THRESHOLD || info.velocity.y > 600) {
                  onClose();
                }
              }}
            >
              <div
                ref={modalRef}
                className="bg-gray-900 w-full max-w-lg rounded-t-3xl border-t border-gray-800 max-h-[90vh] overflow-y-auto safe-pb shadow-2xl"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label={title}
              >
                {/* Drag handle (iOS pill) */}
                <div className="sticky top-0 bg-gray-900 pt-3 pb-2 flex items-center justify-center cursor-grab active:cursor-grabbing">
                  <div className="w-12 h-1.5 rounded-full bg-gray-600" aria-hidden="true" />
                </div>

                <div className="px-5 pb-5">
                  {title && (
                    <div className="flex items-center justify-between mb-4 mt-1">
                      <h2 className="text-xl font-bold">{title}</h2>
                      <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors w-11 h-11 -mr-2 flex items-center justify-center"
                        aria-label="סגור"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                  {children}
                </div>
              </div>
            </motion.div>
          ) : (
            // ---------- Desktop centered dialog ----------
            <motion.div
              className="fixed inset-0 z-[101] flex items-center justify-center p-4"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <div
                ref={modalRef}
                className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-label={title}
              >
                {title && (
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold">{title}</h2>
                    <button
                      onClick={onClose}
                      className="text-gray-400 hover:text-white transition-colors w-9 h-9 -mr-2 flex items-center justify-center"
                      aria-label="סגור"
                    >
                      ✕
                    </button>
                  </div>
                )}
                {children}
              </div>
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  );
}
