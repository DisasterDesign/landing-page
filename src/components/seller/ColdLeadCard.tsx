"use client";

import { useState } from "react";

import QualityScoreBadge from "./QualityScoreBadge";
import type { SellerColdLead } from "./cold-lead-types";

const scoreLabels = {
  availability: ["אמינות וזמינות", 20],
  performance: ["מהירות ומובייל", 20],
  seo: ["SEO", 20],
  maintenance: ["תחזוקה ותוכן", 15],
  visual: ["נראות וחוויה", 15],
  commercial: ["יכולת מסחרית", 10],
} as const;

export default function ColdLeadCard({
  lead,
  onOutcome,
  onPromote,
  promoting = false,
}: {
  lead: SellerColdLead;
  onOutcome: () => void;
  onPromote?: () => void;
  promoting?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const name = lead.live?.displayName ?? lead.auditedDomain ?? "פרטי העסק לא זמינים";

  return (
    <article className="rounded-2xl border border-gray-700 bg-gray-900 p-4 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-white">{name}</h2>
            <QualityScoreBadge score={lead.qualityScore} />
          </div>
          {lead.live?.address && <p className="mt-1 text-xs text-gray-500">{lead.live.address}</p>}
          <p className="mt-2 text-sm text-gray-300">
            {lead.opportunitySummary ?? "נמצאה הזדמנות לשיפור האתר"}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {lead.live?.phone && (
            <a
              href={`tel:${lead.live.phone.replace(/[^+\d]/g, "")}`}
              className="rounded-xl bg-green-500 px-4 py-2 text-sm font-bold text-gray-950"
              dir="ltr"
            >
              {lead.live.phone}
            </a>
          )}
          <button
            type="button"
            onClick={onOutcome}
            className="rounded-xl bg-pink px-4 py-2 text-sm font-bold text-white"
          >
            תעד שיחה
          </button>
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

      <div className="mt-4 rounded-xl border border-cyan/20 bg-cyan/5 p-3">
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

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
        {lead.live?.website && (
          <a href={lead.live.website} target="_blank" rel="noreferrer" className="text-cyan hover:underline">
            פתח אתר ↗
          </a>
        )}
        <button type="button" onClick={() => setExpanded((value) => !value)} className="text-gray-400 hover:text-white">
          {expanded ? "הסתר פירוט" : "הצג פירוט דירוג והיסטוריה"}
        </button>
      </div>

      {expanded && (
        <div className="mt-4 grid gap-4 border-t border-gray-800 pt-4 md:grid-cols-2">
          <div>
            <h3 className="text-xs font-bold text-gray-400">פירוט דירוג</h3>
            <div className="mt-2 space-y-2">
              {lead.scoreBreakdown &&
                Object.entries(scoreLabels).map(([key, [label, maximum]]) => {
                  const value = lead.scoreBreakdown?.[key as keyof typeof lead.scoreBreakdown] ?? 0;
                  return (
                    <div key={key} className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">{label}</span>
                      <span className="font-mono text-white">{value}/{maximum}</span>
                    </div>
                  );
                })}
            </div>
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
                    {interaction.note && <div className="mt-1 text-gray-500">{interaction.note}</div>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
