"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  dangerous?: boolean;
}

type Resolver = (value: boolean) => void;

interface PendingConfirm {
  id: number;
  options: ConfirmOptions;
  resolve: Resolver;
}

let pushPending: ((p: PendingConfirm) => void) | null = null;
let nextId = 0;

/**
 * Imperative confirm helper. Returns true if the user confirms, false otherwise.
 * Requires <ConfirmSheetHost /> to be mounted somewhere in the tree.
 */
export function confirmDanger(options: ConfirmOptions): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    if (!pushPending) {
      // Fallback for SSR or before host mounts
      const ok = typeof window !== "undefined" && window.confirm(`${options.title}\n\n${options.message ?? ""}`);
      resolve(ok);
      return;
    }
    pushPending({ id: ++nextId, options, resolve });
  });
}

const DRAG_DISMISS = 100;

export function ConfirmSheetHost() {
  const [queue, setQueue] = useState<PendingConfirm[]>([]);
  const current = queue[0] ?? null;
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    pushPending = (p) => setQueue((prev) => [...prev, p]);
    return () => {
      pushPending = null;
    };
  }, []);

  useEffect(() => {
    if (!current) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [current]);

  useEffect(() => {
    if (!current) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish(false);
      if (e.key === "Enter") finish(true);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  const finish = (value: boolean) => {
    if (!current) return;
    current.resolve(value);
    setQueue((prev) => prev.slice(1));
  };

  const o = current?.options;
  const dangerous = o?.dangerous ?? true;

  return (
    <AnimatePresence>
      {current && o && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/70 z-[200]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => finish(false)}
          />

          {isMobile ? (
            <motion.div
              key={current.id}
              className="fixed inset-x-0 bottom-0 z-[201] flex justify-center"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 350 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.6 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > DRAG_DISMISS || info.velocity.y > 600) finish(false);
              }}
            >
              <div
                className="bg-gray-900 w-full max-w-sm rounded-t-3xl border-t border-gray-800 safe-pb shadow-2xl"
                onClick={(e) => e.stopPropagation()}
                role="alertdialog"
                aria-modal="true"
                aria-label={o.title}
              >
                <div className="pt-3 pb-2 flex items-center justify-center cursor-grab active:cursor-grabbing">
                  <div className="w-12 h-1.5 rounded-full bg-gray-600" aria-hidden />
                </div>

                <div className="px-5 pt-2 pb-5 text-white">
                  <h2 className="text-lg font-bold mb-2">{o.title}</h2>
                  {o.message && (
                    <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line mb-5">
                      {o.message}
                    </p>
                  )}
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => finish(true)}
                      autoFocus
                      className={`min-h-12 rounded-2xl font-bold text-white transition-colors ${
                        dangerous ? "bg-red-500 hover:bg-red-600" : "bg-pink hover:bg-pink-light"
                      }`}
                    >
                      {o.confirmLabel ?? (dangerous ? "מחק" : "אישור")}
                    </button>
                    <button
                      onClick={() => finish(false)}
                      className="min-h-12 rounded-2xl bg-gray-800 hover:bg-gray-700 text-gray-200 font-medium transition-colors"
                    >
                      {o.cancelLabel ?? "ביטול"}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            // Desktop: centered alert dialog
            <motion.div
              key={current.id}
              className="fixed inset-0 z-[201] flex items-center justify-center p-4"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.18 }}
            >
              <div
                className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl text-white"
                onClick={(e) => e.stopPropagation()}
                role="alertdialog"
                aria-modal="true"
                aria-label={o.title}
              >
                <h2 className="text-lg font-bold mb-2">{o.title}</h2>
                {o.message && (
                  <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line mb-5">
                    {o.message}
                  </p>
                )}
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => finish(false)}
                    className="px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-medium transition-colors"
                  >
                    {o.cancelLabel ?? "ביטול"}
                  </button>
                  <button
                    onClick={() => finish(true)}
                    autoFocus
                    className={`px-4 py-2.5 rounded-xl text-white text-sm font-bold transition-colors ${
                      dangerous ? "bg-red-500 hover:bg-red-600" : "bg-pink hover:bg-pink-light"
                    }`}
                  >
                    {o.confirmLabel ?? (dangerous ? "מחק" : "אישור")}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  );
}
