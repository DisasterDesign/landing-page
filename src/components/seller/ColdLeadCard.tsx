"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import toast from "react-hot-toast";

import LeadSourceBadge from "@/components/leads/LeadSourceBadge";
import Modal from "@/components/ui/Modal";
import type { SellerLeadDetail } from "@/lib/leads/projection";
import { leadContactActionState } from "@/lib/leads/ui-state";

import QualityScoreBadge from "./QualityScoreBadge";

export default function ColdLeadCard({
  lead,
  busy = false,
  highlighted = false,
  onClaim,
}: {
  lead: SellerLeadDetail;
  busy?: boolean;
  highlighted?: boolean;
  onClaim: (lead: SellerLeadDetail) => void;
}) {
  const fallbackInputRef = useRef<HTMLInputElement>(null);
  const [copyFallbackOpen, setCopyFallbackOpen] = useState(false);
  const score = lead.preparation?.qualityScore ?? null;
  const phone = lead.phone;
  const owned = Boolean(lead.owner);
  const contactActions = leadContactActionState({
    phone,
    phoneSource: lead.phoneSource,
    allowPublicPhoneBeforeClaim: true,
    website: lead.website,
    mapUrl: lead.mapUrl,
    doNotContactAt: lead.doNotContactAt,
    capabilities: lead.capabilities,
  });

  function copyPhone() {
    if (!phone || !contactActions.canCopyPhone) return;
    if (!navigator.clipboard?.writeText) {
      setCopyFallbackOpen(true);
      requestAnimationFrame(() => fallbackInputRef.current?.select());
      return;
    }
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
      <article
        id={`lead-${lead.id}`}
        className={`rounded-2xl border bg-gray-900 p-4 shadow-sm transition ${
          highlighted
            ? "border-pink ring-2 ring-pink/30"
            : "border-gray-700"
        }`}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-3">
            <LeadSourceBadge
              intentLevel={lead.intentLevel}
              sourceKey={lead.sourceKey}
              sourceLabel={lead.sourceLabel}
              sourceContext={lead.sourceContext}
            />
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-white">
                {lead.company ?? lead.name ?? "עסק ללא שם"}
              </h2>
              <QualityScoreBadge score={score} />
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400">
              {lead.category && <span>{lead.category}</span>}
              {lead.address && <span>{lead.address}</span>}
              {lead.owner && <span>בטיפול: {lead.owner.name}</span>}
              {!lead.owner && lead.eligibleSeller && (
                <span>ממתין ללקיחה על ידי {lead.eligibleSeller.name}</span>
              )}
            </div>
            <p className="max-w-3xl text-sm leading-6 text-gray-300">
              {lead.preparation?.opportunitySummary ??
                "נמצאה הזדמנות לשיפור האתר והנוכחות הדיגיטלית."}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            {lead.capabilities.canClaim ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => onClaim(lead)}
                className="rounded-xl bg-pink px-4 py-2.5 text-sm font-bold text-white transition hover:bg-pink-dark disabled:opacity-50"
              >
                {busy ? "לוקח..." : "התחל הכנה"}
              </button>
            ) : owned ? (
              <Link
                href={`/seller/leads/${lead.id}`}
                className="rounded-xl bg-pink px-4 py-2.5 text-sm font-bold text-white transition hover:bg-pink-dark"
              >
                פתח ליד
              </Link>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-800 pt-4">
          {contactActions.blocked ? (
            <span className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-300">
              חסימת פניות פעילה
            </span>
          ) : phone && contactActions.canCall ? (
            <>
              <a
                href={`tel:${phone.replace(/[^+\d]/g, "")}`}
                className="rounded-xl bg-green-500 px-3 py-2 text-sm font-bold text-gray-950"
              >
                <bdi dir="ltr">{phone}</bdi>
              </a>
              <button
                type="button"
                onClick={copyPhone}
                className="rounded-xl bg-cyan/20 px-3 py-2 text-sm font-bold text-cyan"
              >
                העתק טלפון
              </button>
            </>
          ) : phone ? (
            <span className="rounded-xl border border-gray-700 px-3 py-2 text-sm text-gray-400">
              אין הרשאה ליצור קשר
            </span>
          ) : lead.preparation?.liveStatus === "UNAVAILABLE" ? (
            <span className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-200">
              המידע לא זמין זמנית
            </span>
          ) : (
            <span className="rounded-xl border border-gray-700 px-3 py-2 text-sm text-gray-400">
              אין כרגע מספר ציבורי
            </span>
          )}

          {lead.website ? (
            <a
              href={lead.website}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm font-bold text-cyan"
            >
              פתח אתר ישן ↗
            </a>
          ) : (
            <span className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm font-bold text-amber-200">
              אין אתר
            </span>
          )}
          {lead.mapUrl && (
            <a
              href={lead.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm font-bold text-cyan"
            >
              Google Maps ↗
            </a>
          )}
        </div>
      </article>

      <Modal
        isOpen={copyFallbackOpen}
        onClose={() => setCopyFallbackOpen(false)}
        title="העתקת מספר הטלפון"
      >
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
