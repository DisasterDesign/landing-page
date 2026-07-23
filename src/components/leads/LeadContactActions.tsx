"use client";

import { useRef, useState } from "react";
import toast from "react-hot-toast";

import Modal from "@/components/ui/Modal";
import type {
  LeadCapabilities,
  LeadDetail,
} from "@/lib/leads/projection";
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

function phoneOriginLabel(
  phoneSource: "CRM" | "GOOGLE" | "NONE",
  phoneProvenance: LeadDetail["phoneProvenance"],
): string | null {
  if (phoneSource === "GOOGLE") return "Google · מספר ציבורי חי";
  if (phoneSource !== "CRM") return null;

  switch (phoneProvenance) {
    case "FIRST_PARTY_FORM":
      return "CRM · נמסר בטופס";
    case "SELLER_CONFIRMED":
      return "CRM · אומת על ידי איש מכירות";
    case "ADMIN_CONFIRMED":
      return "CRM · אומת על ידי אדמין";
    case "MIGRATED":
      return "CRM · הועבר מהמערכת הקודמת";
    default:
      return "CRM · מקור לא מתועד";
  }
}

export default function LeadContactActions({
  phone,
  phoneSource,
  phoneProvenance,
  website,
  mapUrl,
  doNotContactAt,
  capabilities,
  onScheduleFollowUp,
}: {
  phone: string | null;
  phoneSource: "CRM" | "GOOGLE" | "NONE";
  phoneProvenance: LeadDetail["phoneProvenance"];
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
    phoneSource,
    website,
    mapUrl,
    doNotContactAt,
    capabilities,
  });
  const originLabel = phoneOriginLabel(phoneSource, phoneProvenance);

  function copyPhone() {
    if (!phone) return;
    const clipboard = navigator.clipboard;
    if (!clipboard?.writeText) {
      setCopyFallbackOpen(true);
      requestAnimationFrame(() => fallbackInputRef.current?.select());
      return;
    }
    void clipboard
      .writeText(phone)
      .then(() => toast.success("הועתק"))
      .catch(() => {
        setCopyFallbackOpen(true);
        requestAnimationFrame(() => fallbackInputRef.current?.select());
      });
  }

  return (
    <>
      <div className="space-y-2">
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

        {originLabel && (
          <p className="text-xs text-gray-500">
            מקור הטלפון:{" "}
            <span
              className={
                phoneSource === "GOOGLE"
                  ? "font-medium text-cyan"
                  : "font-medium text-gray-300"
              }
            >
              {originLabel}
            </span>
          </p>
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
