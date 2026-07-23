"use client";

import { useRef, useState } from "react";
import toast from "react-hot-toast";

import Modal from "@/components/ui/Modal";

import QualityScoreBadge from "./QualityScoreBadge";
import type {
  SellerColdLead,
  SellerCompanyNote,
} from "./cold-lead-types";

const scoreLabels = {
  availability: ["אמינות וזמינות", 20],
  performance: ["מהירות ומובייל", 20],
  seo: ["SEO", 20],
  maintenance: ["תחזוקה ותוכן", 15],
  visual: ["נראות וחוויה", 15],
  commercial: ["יכולת מסחרית", 10],
} as const;

const websiteStatusLabels: Record<string, string> = {
  NO_WEBSITE: "אין אתר",
  SOCIAL_ONLY: "קיים רק עמוד רשת חברתית",
  PARKED: "הדומיין אינו אתר פעיל",
  UNREACHABLE: "האתר אינו זמין",
  ACTIVE: "אתר פעיל",
  BLOCKED: "האתר חסם את הבדיקה",
  UNKNOWN: "סטטוס האתר אינו ודאי",
};

const salesFitEvidenceLabels: Record<string, string> = {
  LOCAL_BRAND: "מותג מקומי",
  STREET_FACING: "עסק שפונה לרחוב",
  SINGLE_LOCATION_SIGNAL: "נראה כסניף יחיד",
  DIRECT_PUBLIC_PHONE: "טלפון עסקי ישיר",
  OWNER_LANGUAGE: "שפה אישית של בעל העסק",
  MULTI_LOCATION: "מספר סניפים",
  FRANCHISE_LANGUAGE: "סימני זכיינות",
  CORPORATE_LANGUAGE: "שפה תאגידית",
  INSTITUTIONAL_TYPE: "גוף מוסדי",
  INDUSTRIAL_TYPE: "פעילות תעשייתית",
  INSUFFICIENT_EVIDENCE: "אין מספיק מידע",
};

const dayNames = [
  "יום ראשון",
  "יום שני",
  "יום שלישי",
  "יום רביעי",
  "יום חמישי",
  "יום שישי",
  "יום שבת",
];

export default function LegacyColdLeadCard({
  lead,
  onOutcome,
  onPromote,
  onRetry,
  companyNotes = [],
  companyNotesOpen = false,
  companyNotesLoading = false,
  companyNoteDraft = "",
  companyNoteBusy = false,
  onToggleCompanyNotes,
  onCompanyNoteDraftChange,
  onAddCompanyNote,
  promoting = false,
}: {
  lead: SellerColdLead;
  onOutcome: () => void;
  onPromote?: () => void;
  onRetry?: () => void;
  companyNotes?: SellerCompanyNote[];
  companyNotesOpen?: boolean;
  companyNotesLoading?: boolean;
  companyNoteDraft?: string;
  companyNoteBusy?: boolean;
  onToggleCompanyNotes?: () => void;
  onCompanyNoteDraftChange?: (value: string) => void;
  onAddCompanyNote?: () => void;
  promoting?: boolean;
}) {
  const fallbackInputRef = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [copyFallbackOpen, setCopyFallbackOpen] = useState(false);
  const contactBlocked = lead.status === "DO_NOT_CALL";
  const phone = lead.business.phone;
  const todayHours = lead.business.weekdayDescriptions.find((description) =>
    description.includes(dayNames[new Date().getDay()]),
  );

  function copyPhone() {
    if (contactBlocked || lead.liveStatus !== "READY" || !phone) return;
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
      <article className="rounded-2xl border border-gray-700 bg-gray-900 p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-white">{lead.business.displayName}</h2>
            <QualityScoreBadge score={lead.qualityScore} />
            {lead.salesFit.ownerReachabilityScore !== null && (
              <span className="rounded-full bg-green-500/10 px-2 py-1 text-xs font-bold text-green-300">
                התאמה לשיחה {lead.salesFit.ownerReachabilityScore}/100
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400">
            {lead.business.category && <span>{lead.business.category}</span>}
            {lead.business.address && <span>{lead.business.address}</span>}
            {lead.business.rating !== null && (
              <span dir="ltr">
                ★ {lead.business.rating.toFixed(1)}
                {lead.business.reviewCount !== null ? ` (${lead.business.reviewCount})` : ""}
              </span>
            )}
          </div>

          {todayHours && <p className="text-xs text-gray-500">{todayHours}</p>}
          <p className="text-sm text-gray-300">
            {lead.opportunitySummary ?? "נמצאה הזדמנות לשיפור האתר"}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          {contactBlocked ? (
            <span className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-bold text-red-300">
              חסימת פניות פעילה
            </span>
          ) : lead.liveStatus === "READY" && phone ? (
            <>
              <a
                href={`tel:${phone.replace(/[^+\d]/g, "")}`}
                className="rounded-xl bg-green-500 px-4 py-2 text-sm font-bold text-gray-950"
              >
                <span className="ml-2">התקשר</span>
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
          ) : lead.liveStatus === "UNAVAILABLE" ? (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm font-bold text-amber-200"
            >
              הטלפון לא נטען · נסה שוב
            </button>
          ) : (
            <span className="rounded-xl border border-gray-700 px-3 py-2 text-sm text-gray-400">
              אין כרגע מספר ציבורי
            </span>
          )}

          {!contactBlocked && (
            <button
              type="button"
              onClick={onOutcome}
              className="rounded-xl bg-pink px-4 py-2 text-sm font-bold text-white"
            >
              תעד שיחה
            </button>
          )}
          {lead.status === "QUALIFIED" && onPromote && (
            <button
              type="button"
              disabled={promoting}
              onClick={onPromote}
              className="rounded-xl bg-cyan px-4 py-2 text-sm font-bold text-gray-950 disabled:opacity-50"
            >
              {promoting ? "מעביר..." : "העבר ללידים החמים"}
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-3">
          <h3 className="text-xs font-bold text-green-300">למה העסק מתאים לשיחה</h3>
          <p className="mt-2 text-sm text-gray-300">
            {lead.salesFit.reason ?? "העסק טרם עבר את מודל ההתאמה החדש"}
          </p>
        </div>

        <div className="rounded-xl border border-cyan/20 bg-cyan/5 p-3">
          <h3 className="text-xs font-bold text-cyan">שלוש זוויות לשיחה</h3>
          <ol className="mt-2 space-y-1.5 text-sm text-gray-300">
            {lead.callAngles.slice(0, 3).map((angle, index) => (
              <li key={`${index}-${angle}`} className="flex gap-2">
                <span className="font-bold text-cyan">{index + 1}.</span>
                <span>{angle}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
        {lead.business.website ? (
          <a
            href={lead.business.website}
            target="_blank"
            rel="noreferrer"
            className="font-bold text-cyan hover:underline"
          >
            פתח אתר ↗
          </a>
        ) : (
          <span className="font-bold text-amber-300">
            {websiteStatusLabels[lead.websiteStatus] ?? "לא נמצא אתר"}
          </span>
        )}
        <a
          href={lead.business.mapUrl}
          target="_blank"
          rel="noreferrer"
          className="font-bold text-cyan hover:underline"
        >
          פתח ב־Google Maps ↗
        </a>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="text-gray-400 hover:text-white"
        >
          {expanded ? "הסתר פירוט" : "הצג פירוט דירוג והיסטוריה"}
        </button>
        {lead.leadId && (
          <button
            type="button"
            onClick={onToggleCompanyNotes}
            disabled={!lead.canManageCompanyNotes || !onToggleCompanyNotes}
            aria-expanded={companyNotesOpen}
            title={
              lead.canManageCompanyNotes
                ? undefined
                : "הערות החברה זמינות לאחר לקיחת הליד"
            }
            className={`font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
              companyNotesOpen || lead.companyNotesCount > 0
                ? "text-amber-400"
                : "text-gray-400 hover:text-white"
            }`}
          >
            📝 הערות חברה
            {lead.companyNotesCount > 0
              ? ` (${lead.companyNotesCount})`
              : ""}
          </button>
        )}
        {lead.liveStatus !== "UNAVAILABLE" && (
          <span className="mr-auto text-[10px] text-gray-600">
            פרטי העסק באדיבות Google Maps
          </span>
        )}
      </div>

      {expanded && (
        <div className="mt-4 grid gap-4 border-t border-gray-800 pt-4 md:grid-cols-3">
          <div>
            <h3 className="text-xs font-bold text-gray-400">פירוט דירוג האתר</h3>
            <div className="mt-2 space-y-2">
              {lead.scoreBreakdown &&
                Object.entries(scoreLabels).map(([key, [label, maximum]]) => {
                  const value =
                    lead.scoreBreakdown?.[key as keyof typeof lead.scoreBreakdown] ?? 0;
                  return (
                    <div key={key} className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">{label}</span>
                      <span className="font-mono text-white">
                        {value}/{maximum}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold text-gray-400">ראיות להתאמה</h3>
            {lead.salesFit.evidence.length === 0 ? (
              <p className="mt-2 text-xs text-gray-600">אין פירוט נוסף</p>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                {lead.salesFit.evidence.map((evidence) => (
                  <span
                    key={evidence}
                    className="rounded-lg bg-gray-800 px-2 py-1 text-xs text-gray-300"
                  >
                    {salesFitEvidenceLabels[evidence] ?? evidence}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-xs font-bold text-gray-400">שיחות קודמות</h3>
            <div className="mt-2 space-y-2">
              {lead.interactions.length === 0 ? (
                <p className="text-xs text-gray-600">אין עדיין שיחות</p>
              ) : (
                lead.interactions.map((interaction) => (
                  <div key={interaction.id} className="rounded-lg bg-gray-800 p-2 text-xs">
                    <div className="font-bold text-gray-300">{interaction.outcome}</div>
                    {interaction.note && (
                      <div className="mt-1 text-gray-500">{interaction.note}</div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {companyNotesOpen && lead.canManageCompanyNotes && (
        <section className="mt-4 space-y-3 border-t border-gray-800 pt-4">
          <h3 className="text-xs font-bold text-amber-400">היסטוריית החברה</h3>
          {companyNotesLoading ? (
            <p className="text-xs text-gray-500">טוען הערות...</p>
          ) : companyNotes.length === 0 ? (
            <p className="text-xs text-gray-600">
              אין הערות עדיין — תעד מה קרה ומה הצעד הבא לצוות.
            </p>
          ) : (
            <ol className="space-y-1.5">
              {companyNotes.map((note, index) => (
                <li
                  key={note.id}
                  className="flex items-start gap-2 rounded-xl bg-gray-800/60 px-3 py-2 text-xs"
                >
                  <span className="shrink-0 font-mono font-bold text-amber-400">
                    {index + 1}.
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="whitespace-pre-wrap break-words text-gray-200">
                      {note.body}
                    </p>
                    <p className="mt-0.5 text-[10px] text-gray-500">
                      {new Date(note.createdAt).toLocaleString("he-IL", {
                        day: "numeric",
                        month: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] text-gray-500">
                    {note.author?.name ?? ""}
                  </span>
                </li>
              ))}
            </ol>
          )}

          <div className="flex gap-2">
            <input
              value={companyNoteDraft}
              onChange={(event) =>
                onCompanyNoteDraftChange?.(event.target.value)
              }
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  onAddCompanyNote?.();
                }
              }}
              placeholder="הערה חדשה לצוות..."
              className="flex-1 rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-xs text-white outline-none placeholder:text-gray-600 focus:border-amber-500/50"
            />
            <button
              type="button"
              onClick={onAddCompanyNote}
              disabled={
                companyNoteBusy ||
                !companyNoteDraft.trim() ||
                !onAddCompanyNote
              }
              className="rounded-xl bg-amber-500/20 px-3 py-2 text-xs font-bold text-amber-400 transition-colors hover:bg-amber-500/30 disabled:opacity-40"
            >
              {companyNoteBusy ? "שומר..." : "הוסף"}
            </button>
          </div>
        </section>
      )}
      </article>

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
