"use client";

import { useState } from "react";

/**
 * The way back to Cardcom for a signed-but-unpaid agreement.
 *
 * POST /api/agreements/sign/[token]/payment reuses a still-open payment page
 * or mints a fresh one (an abandoned Cardcom page cannot be reopened), then we
 * redirect. The server's error strings are developer/Cardcom text and never
 * shown; the customer gets one localized line.
 */
export default function ResumePaymentButton({ token, en }: { token: string; en: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/agreements/sign/${token}/payment`, { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string; vendor?: string };
      if (!res.ok || !json.url) {
        console.error("resume payment failed:", json.error ?? res.status, json.vendor ?? "");
        setError(en ? "Could not open the payment page. Please try again or contact us." : "לא הצלחנו לפתוח את דף התשלום. נסו שוב או צרו קשר.");
        setBusy(false);
        return;
      }
      window.location.href = json.url;
    } catch {
      setError(en ? "Could not open the payment page. Please try again." : "לא הצלחנו לפתוח את דף התשלום. נסו שוב.");
      setBusy(false);
    }
  };

  return (
    <div className="mb-6">
      <p className="text-gray-300 mb-4">
        {en ? "One step left: complete the first payment." : "נותר שלב אחד: להשלים את התשלום הראשון."}
      </p>
      <button
        type="button"
        onClick={go}
        disabled={busy}
        className="inline-flex items-center gap-2 bg-gradient-to-r from-pink to-cyan text-black font-bold px-6 py-3 rounded-full hover:shadow-[0_0_30px_rgba(229,3,162,0.4)] transition-shadow disabled:opacity-60"
      >
        {busy ? (en ? "Opening payment…" : "פותח תשלום…") : en ? "Go to payment" : "מעבר לתשלום"}
        <span>→</span>
      </button>
      {error && <p className="text-sm text-red-400 mt-3">{error}</p>}
    </div>
  );
}
