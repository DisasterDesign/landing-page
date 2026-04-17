"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "fw-install-dismissed";

export default function InstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;

    const handler = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!event) return;
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === "accepted") {
      setVisible(false);
      setEvent(null);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="התקנת אפליקציה"
      className="fixed bottom-20 md:bottom-4 inset-x-4 md:right-auto md:left-4 md:max-w-sm z-50 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-4 flex items-center gap-3"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white">התקן את האפליקציה</p>
        <p className="text-xs text-gray-400 mt-0.5">
          גישה מהירה ישר מהבית
        </p>
      </div>
      <button
        onClick={handleInstall}
        className="bg-pink hover:bg-pink-light text-white text-sm font-bold px-4 py-2 rounded-full transition-colors"
      >
        התקן
      </button>
      <button
        onClick={handleDismiss}
        aria-label="סגור"
        className="text-gray-500 hover:text-white text-lg leading-none px-1"
      >
        ✕
      </button>
    </div>
  );
}
