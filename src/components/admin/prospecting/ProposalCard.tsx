"use client";

import type { TerritoryProposalView } from "./types";

const kindLabels = {
  STREET: "רחוב",
  COMMERCIAL_CENTER: "מרכז מסחרי",
  AREA: "אזור קומפקטי",
};

export default function ProposalCard({
  proposal,
  busy,
  onApprove,
  onReject,
}: {
  proposal: TerritoryProposalView;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <section className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-amber-400/15 px-2.5 py-1 text-xs font-bold text-amber-300">
              ממתין לאישור
            </span>
            <span className="text-xs text-gray-400">{kindLabels[proposal.kind]}</span>
            <span className="text-xs text-gray-500">
              ביטחון {Math.round(proposal.confidence * 100)}%
            </span>
          </div>
          <h2 className="mt-3 text-xl font-bold text-white">
            {proposal.displayName}, {proposal.city}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-300">{proposal.rationale}</p>
          <p className="mt-3 text-xs text-gray-500">חיפוש: {proposal.searchQuery}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {proposal.expectedBusinessTypes.map((type) => (
              <span key={type} className="rounded-lg bg-gray-800 px-2.5 py-1 text-xs text-gray-300">
                {type}
              </span>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onApprove}
            className="rounded-xl bg-green-500 px-4 py-2 text-sm font-bold text-gray-950 transition hover:bg-green-400 disabled:opacity-50"
          >
            אשר אזור
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onReject}
            className="rounded-xl border border-gray-600 px-4 py-2 text-sm font-bold text-gray-200 transition hover:border-red-400 hover:text-red-300 disabled:opacity-50"
          >
            דחה
          </button>
        </div>
      </div>
    </section>
  );
}
