import type { LeadIntentLevel } from "@prisma/client";

/**
 * The lead-temperature doctrine (Elad, 24.7.2026): every lead has one of
 * three temperatures, and temperature is the FIRST thing a human should see —
 * before name, before source.
 *
 *   🧊 קר    (OUTBOUND)    — we initiated: the Google-Maps prospecting engine
 *   🌤 בינוני (AD_RESPONSE) — they left quick details on one of our ads (Meta)
 *   🔥 חם    (INBOUND)     — they came looking for us (word of mouth today,
 *                            Google search tomorrow)
 *
 * The technical channel (sourceKey) is open-ended; every new channel maps
 * onto one of these three temperatures instead of inventing a new lead type.
 */
export const LEAD_TEMPERATURES: Record<
  LeadIntentLevel,
  { label: string; emoji: string; chipClass: string }
> = {
  OUTBOUND: {
    label: "ליד קר",
    emoji: "🧊",
    chipClass: "bg-cyan/10 text-cyan border-cyan/40",
  },
  AD_RESPONSE: {
    label: "ליד בינוני",
    emoji: "🌤️",
    chipClass: "bg-amber-400/10 text-amber-300 border-amber-400/40",
  },
  INBOUND: {
    label: "ליד חם",
    emoji: "🔥",
    chipClass: "bg-red-500/10 text-red-400 border-red-500/40",
  },
};

const sourceLabels: Record<string, string> = {
  google_maps: "Google Maps",
  meta_lead_ads: "Meta Lead Ads",
  website: "אתר Fuzion",
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
      <span className="text-sm text-gray-300">
        {sourceKey
          ? sourceLabels[sourceKey] ?? sourceLabel ?? sourceKey
          : sourceLabel ?? "מקור לא מסווג"}
      </span>
      {context.length > 0 && (
        <span className="text-xs text-gray-500">{context.join(" · ")}</span>
      )}
    </div>
  );
}
