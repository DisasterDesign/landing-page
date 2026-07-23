"use client";

import { useRef, useState } from "react";
import toast from "react-hot-toast";

import Modal from "@/components/ui/Modal";
import type { LeadCapabilities } from "@/lib/leads/projection";
import { leadContactActionState } from "@/lib/leads/ui-state";

function phoneHref(phone: string) {
  return `tel:${phone.replace(/[^+\d]/g, "")}`;
}

function whatsappHref(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const international = digits.startsWith("0")
    ? `972${digits.slice(1)}`
    : digits;
  return `https://wa.me/${international}`;
}

export default function LeadContactActions({
  phone,
  website,
  mapUrl,
  doNotContactAt,
  capabilities,
  onScheduleFollowUp,
}: {
  phone: string | null;
  website: string | null;
  mapUrl: string | null;
  doNotContactAt: string | null;
  capabilities: LeadCapabilities;
  onScheduleFollowUp?: () => void;
}) {
  const fallbackInputRef = useRef<HTMLInputElement>(null);
  const [copyFallbackOpen, setCopyFallbackOpen] = useState(false);
  const actions = leadContactActionState({
    phone,
    website,
    mapUrl,
    doNotContactAt,
    capabilities,
  });

  function copyPhone() {
    if (!phone) return;
    void navigator.clipboard
      .writeText(phone)
      .then(() => toast.success("הועתק"))
      .catch(() => {
        setCopyFallbackOpen(true);
        requestAnimationFrame(() => fallbackInputRef.current?.select());
      });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {actions.blocked && (
          <span className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-300">
            חסימת פניות פעילה
          </span>
        )}

        {actions.canCall && phone && (
          <a
            href={phoneHref(phone)}
            className="rounded-xl bg-green-500 px-4 py-2 text-sm font-bold text-gray-950 transition hover:bg-green-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-300"
          >
            התקשר · <bdi dir="ltr">{phone}</bdi>
          </a>
        )}

        {actions.canCopyPhone && (
          <button
            type="button"
            onClick={copyPhone}
            className="rounded-xl bg-cyan/20 px-3 py-2 text-sm font-bold text-cyan transition hover:bg-cyan/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
          >
            העתק טלפון
          </button>
        )}

        {actions.canWhatsApp && phone && (
          <a
            href={whatsappHref(phone)}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm font-bold text-green-300 transition hover:bg-green-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-300"
          >
            WhatsApp
          </a>
        )}

        {actions.canOpenWebsite && website && (
          <a
            href={website}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm font-bold text-cyan transition hover:border-cyan/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
          >
            פתח אתר ישן ↗
          </a>
        )}

        {actions.canOpenMap && mapUrl && (
          <a
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm font-bold text-cyan transition hover:border-cyan/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan"
          >
            Google Maps ↗
          </a>
        )}

        {actions.canScheduleFollowUp && onScheduleFollowUp && (
          <button
            type="button"
            onClick={onScheduleFollowUp}
            className="rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm font-bold text-gray-200 transition hover:border-pink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink"
          >
            קבע פולואפ
          </button>
        )}

        {!actions.blocked && !phone && (
          <span className="rounded-xl border border-gray-700 px-3 py-2 text-sm text-gray-400">
            אין מספר מאומת
          </span>
        )}
      </div>

      <Modal
        isOpen={copyFallbackOpen}
        onClose={() => setCopyFallbackOpen(false)}
        title="העתקת מספר הטלפון"
      >
        <p className="mb-3 text-sm text-gray-400">
          ההעתקה האוטומטית נחסמה. סמנו והעתיקו את המספר:
        </p>
        <input
          ref={fallbackInputRef}
          value={phone ?? ""}
          readOnly
          dir="ltr"
          onFocus={(event) => event.currentTarget.select()}
          className="w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-3 text-white outline-none focus:border-pink"
        />
      </Modal>
    </>
  );
}

