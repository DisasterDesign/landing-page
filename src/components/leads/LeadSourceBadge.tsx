import type { LeadIntentLevel } from "@prisma/client";

import Badge from "@/components/ui/Badge";

const intentLabels: Record<LeadIntentLevel, string> = {
  OUTBOUND: "פנייה קרה",
  AD_RESPONSE: "השאירו פרטים בפרסומת",
  INBOUND: "פנייה יזומה של הלקוח",
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
      <Badge
        variant={
          intentLevel === "OUTBOUND"
            ? "yellow"
            : intentLevel === "INBOUND"
              ? "green"
              : "pink"
        }
      >
        {intentLevel ? intentLabels[intentLevel] : "דורש סיווג"}
      </Badge>
      <span className="text-sm text-gray-300">
        {sourceLabel ||
          (sourceKey ? sourceLabels[sourceKey] ?? sourceKey : "מקור לא מסווג")}
      </span>
      {context.length > 0 && (
        <span className="text-xs text-gray-500">{context.join(" · ")}</span>
      )}
    </div>
  );
}

