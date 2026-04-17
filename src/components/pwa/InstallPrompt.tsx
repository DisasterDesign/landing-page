"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "fw-install-dismissed-at";
const DISMISS_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type Platform = "ios" | "android" | "other";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

function wasRecentlyDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

export default function InstallPrompt() {
  const [platform, setPlatform] = useState<Platform>("other");
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone()) return;
    if (wasRecentlyDismissed()) return;

    const p = detectPlatform();
    setPlatform(p);

    if (p === "ios") {
      setVisible(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
    setVisible(false);
    setShowIosGuide(false);
  };

  const handleAndroidInstall = async () => {
    if (!event) return;
    await event.prompt();
    const choice = await event.userChoice;
    if (choice.outcome === "accepted") {
      setVisible(false);
      setEvent(null);
    }
  };

  if (!visible) return null;

  // iOS — show install banner with instructions modal
  if (platform === "ios") {
    return (
      <>
        <div
          role="dialog"
          aria-label="התקנת אפליקציה"
          className="fixed bottom-20 md:bottom-4 inset-x-4 md:right-auto md:left-4 md:max-w-sm z-50 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-4 flex items-center gap-3"
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">התקן את האפליקציה</p>
            <p className="text-xs text-gray-400 mt-0.5">גישה מהירה ישר ממסך הבית</p>
          </div>
          <button
            onClick={() => setShowIosGuide(true)}
            className="bg-pink hover:bg-pink-light text-white text-sm font-bold px-4 py-2 rounded-full transition-colors whitespace-nowrap"
          >
            איך?
          </button>
          <button
            onClick={dismiss}
            aria-label="סגור"
            className="text-gray-500 hover:text-white text-lg leading-none px-1"
          >
            ✕
          </button>
        </div>

        {showIosGuide && (
          <div className="fixed inset-0 z-[100] bg-black/80 flex items-end justify-center md:items-center p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-full max-w-md text-white">
              <div className="flex items-start justify-between mb-4">
                <h2 className="text-xl font-bold">הוסף למסך הבית</h2>
                <button
                  onClick={() => setShowIosGuide(false)}
                  aria-label="סגור"
                  className="text-gray-500 hover:text-white text-2xl leading-none"
                >
                  ✕
                </button>
              </div>
              <ol className="space-y-4 text-sm leading-relaxed text-gray-200">
                <li className="flex gap-3">
                  <span className="shrink-0 w-7 h-7 rounded-full bg-pink/20 text-pink flex items-center justify-center font-bold">
                    1
                  </span>
                  <span>
                    לחץ על כפתור <strong>השיתוף</strong> בסרגל התחתון של Safari
                    <span className="inline-block mx-1 px-1.5 py-0.5 bg-gray-800 rounded text-cyan font-bold">
                      ⬆️
                    </span>
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="shrink-0 w-7 h-7 rounded-full bg-pink/20 text-pink flex items-center justify-center font-bold">
                    2
                  </span>
                  <span>
                    גלול ובחר <strong>&quot;הוסף למסך הבית&quot;</strong>{" "}
                    <span className="text-gray-500">(Add to Home Screen)</span>
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="shrink-0 w-7 h-7 rounded-full bg-pink/20 text-pink flex items-center justify-center font-bold">
                    3
                  </span>
                  <span>
                    לחץ <strong>&quot;הוסף&quot;</strong> בפינה הימנית-עליונה. האפליקציה
                    תופיע במסך הבית!
                  </span>
                </li>
              </ol>
              <p className="mt-5 text-xs text-gray-500 text-center">
                חייבים להשתמש ב-Safari (לא Chrome) כדי להוסיף למסך הבית ב-iPhone.
              </p>
              <button
                onClick={() => setShowIosGuide(false)}
                className="mt-5 w-full bg-pink hover:bg-pink-light text-white font-bold py-2.5 rounded-xl transition-colors"
              >
                הבנתי
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Android / supported browser — native install prompt
  return (
    <div
      role="dialog"
      aria-label="התקנת אפליקציה"
      className="fixed bottom-20 md:bottom-4 inset-x-4 md:right-auto md:left-4 md:max-w-sm z-50 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-4 flex items-center gap-3"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white">התקן את האפליקציה</p>
        <p className="text-xs text-gray-400 mt-0.5">גישה מהירה ישר מהבית</p>
      </div>
      <button
        onClick={handleAndroidInstall}
        className="bg-pink hover:bg-pink-light text-white text-sm font-bold px-4 py-2 rounded-full transition-colors"
      >
        התקן
      </button>
      <button
        onClick={dismiss}
        aria-label="סגור"
        className="text-gray-500 hover:text-white text-lg leading-none px-1"
      >
        ✕
      </button>
    </div>
  );
}
