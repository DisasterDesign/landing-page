import type { LeadIntentLevel } from "@prisma/client";

/**
 * The lead-temperature doctrine (Elad, 24.7.2026): every lead has one of
 * three temperatures (intentLevel) — OUTBOUND we initiated, AD_RESPONSE they
 * answered an ad, INBOUND they came looking. That stays the DATA model.
 *
 * The UI, however, speaks in SOURCES (Elad's refinement, same day): a
 * salesperson thinks "this came from Google Maps / Facebook / organically",
 * not in temperature metaphors. So the visible names are the sources, and
 * the temperature remains the underlying grouping.
 */
export const LEAD_TEMPERATURES: Record<
  LeadIntentLevel,
  { label: string; emoji: string; chipClass: string }
> = {
  OUTBOUND: {
    label: "גוגל מפות",
    emoji: "📍",
    chipClass: "bg-cyan/10 text-cyan border-cyan/40",
  },
  AD_RESPONSE: {
    label: "פייסבוק",
    emoji: "📘",
    chipClass: "bg-blue-500/10 text-blue-300 border-blue-400/40",
  },
  INBOUND: {
    label: "אורגני",
    emoji: "🌱",
    chipClass: "bg-green-500/10 text-green-300 border-green-500/40",
  },
};

// Secondary detail — shown only when it ADDS information beyond the chip
// (the chip already says גוגל מפות/פייסבוק/אורגני).
const sourceLabels: Record<string, string> = {
  google_maps: "",
  meta_lead_ads: "",
  website: "טופס האתר",
  google_search_ads: "Google Search",
};

const preferredContextKeys = [
  "territory",
  "weekStart",
  "campaignName",
  "campaignId",
  "formName",
  "landingPage",
  "service",
];

export default function LeadSourceBadge({
  intentLevel,
  sourceKey,
  sourceLabel,
  sourceContext,
}: {
  intentLevel: LeadIntentLevel | null;
  sourceKey: string | null;
  sourceLabel?: string;
  sourceContext?: Record<string, string | number | null>;
}) {
  const temperature = intentLevel ? LEAD_TEMPERATURES[intentLevel] : null;
  const context = preferredContextKeys
    .flatMap((key) => {
      const value = sourceContext?.[key];
      return value === null || value === undefined || value === ""
        ? []
        : [String(value)];
    })
    .slice(0, 2);

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="מקור הליד">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-bold ${
          temperature
            ? temperature.chipClass
            : "border-gray-600 bg-gray-500/10 text-gray-300"
        }`}
      >
        <span aria-hidden="true">{temperature?.emoji ?? "❔"}</span>
        {temperature?.label ?? "דורש סיווג"}
      </span>
      {(() => {
        const secondary = sourceKey
          ? sourceLabels[sourceKey] ?? sourceLabel ?? sourceKey
          : sourceLabel ?? "מקור לא מסווג";
        return secondary ? (
          <span className="text-sm text-gray-300">{secondary}</span>
        ) : null;
      })()}
      {context.length > 0 && (
        <span className="text-xs text-gray-500">{context.join(" · ")}</span>
      )}
    </div>
  );
}
