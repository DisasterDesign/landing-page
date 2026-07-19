"use client";

import { useRouter } from "next/navigation";

/**
 * Header back button — one tap to leave a page entered by mistake.
 *
 * A cold open (PWA icon, pushed notification link) has no history behind it,
 * so falling back to the dashboard beats a button that silently does nothing.
 */
export default function BackButton() {
  const router = useRouter();

  const goBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/admin");
    }
  };

  return (
    <button
      onClick={goBack}
      aria-label="חזרה לדף הקודם"
      title="חזרה לדף הקודם"
      className="flex items-center gap-1.5 p-2 -mr-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 active:bg-gray-700 transition-colors"
    >
      {/* RTL — back points right */}
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
      </svg>
      <span className="hidden md:inline text-sm font-medium">חזור</span>
    </button>
  );
}
