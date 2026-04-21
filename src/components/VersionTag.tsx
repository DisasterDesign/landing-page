"use client";

import { useState } from "react";
import toast from "react-hot-toast";

interface Props {
  variant?: "admin" | "public";
}

const CLIENT_SHA = process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev";

async function clearCachesAndUnregisterSW() {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch {
    /* ignore */
  }
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* ignore */
  }
}

export default function VersionTag({ variant = "admin" }: Props) {
  const [checking, setChecking] = useState(false);

  const handleRefresh = async () => {
    if (checking) return;
    setChecking(true);
    try {
      const res = await fetch("/api/version", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { sha: string };

      if (data.sha === CLIENT_SHA) {
        toast.success("המערכת מעודכנת", { duration: 1500, style: { fontSize: "13px" } });
        setChecking(false);
        return;
      }

      toast.loading("גרסה חדשה זמינה, מרענן…", { duration: 2000, style: { fontSize: "13px" } });
      await clearCachesAndUnregisterSW();
      window.location.reload();
    } catch {
      toast.error("שגיאה בבדיקת גרסה");
      setChecking(false);
    }
  };

  const baseClasses =
    "inline-flex items-center gap-1.5 font-mono text-[10px] select-none";
  const variantClasses =
    variant === "admin"
      ? "text-gray-500 hover:text-gray-300"
      : "text-gray-600 hover:text-gray-400";

  return (
    <div className={`${baseClasses} ${variantClasses}`} dir="ltr">
      <span>v {CLIENT_SHA}</span>
      <button
        type="button"
        onClick={handleRefresh}
        disabled={checking}
        aria-label="בדוק עדכוני גרסה"
        title="בדוק עדכוני גרסה"
        className={`p-1 rounded hover:bg-white/10 transition-colors ${
          checking ? "opacity-50 cursor-wait" : "cursor-pointer"
        }`}
      >
        <svg
          className={`w-3 h-3 ${checking ? "animate-spin" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v6h6M20 20v-6h-6M5 14a8 8 0 0014 4M19 10A8 8 0 005 6" />
        </svg>
      </button>
    </div>
  );
}
