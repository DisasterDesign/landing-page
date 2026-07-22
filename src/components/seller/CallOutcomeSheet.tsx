"use client";

import { useState } from "react";

import type { SellerColdLead } from "./cold-lead-types";

const outcomes = [
  ["NO_ANSWER", "לא ענו"],
  ["CALLBACK", "לחזור בהמשך"],
  ["CONNECTED", "דיברנו"],
  ["INTERESTED", "מעוניין"],
  ["NOT_INTERESTED", "לא מעוניין"],
  ["WRONG_NUMBER", "מספר שגוי"],
  ["DO_NOT_CALL", "לא להתקשר"],
] as const;

export default function CallOutcomeSheet({
  lead,
  busy,
  onClose,
  onSubmit,
}: {
  lead: SellerColdLead;
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: { outcome: string; note?: string; nextFollowUpAt?: string }) => void;
}) {
  const [outcome, setOutcome] = useState<string>("");
  const [note, setNote] = useState("");
  const [followUp, setFollowUp] = useState("");
  const needsFollowUp = outcome === "NO_ANSWER" || outcome === "CALLBACK";

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 md:items-center" onClick={onClose}>
      <div
        dir="rtl"
        className="safe-pb w-full max-w-lg rounded-t-3xl border border-gray-700 bg-gray-900 p-5 shadow-2xl md:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">תוצאת שיחה</h2>
            <p className="mt-1 text-xs text-gray-500">
              {lead.live?.displayName ?? lead.auditedDomain ?? "עסק"}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-white" aria-label="סגור">
            ✕
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          {outcomes.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setOutcome(value)}
              className={`rounded-xl border px-3 py-2.5 text-sm font-bold transition ${
                outcome === value
                  ? value === "DO_NOT_CALL"
                    ? "border-red-500 bg-red-500/15 text-red-300"
                    : "border-pink bg-pink/15 text-pink"
                  : "border-gray-700 text-gray-300 hover:border-gray-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {needsFollowUp && (
          <label className="mt-4 block space-y-2 text-sm text-gray-300">
            <span>מתי לחזור?</span>
            <input
              type="datetime-local"
              value={followUp}
              onChange={(event) => setFollowUp(event.target.value)}
              className="w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2.5 text-white outline-none focus:border-pink"
            />
          </label>
        )}

        <label className="mt-4 block space-y-2 text-sm text-gray-300">
          <span>פתק מהשיחה</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={2_000}
            rows={3}
            className="w-full resize-none rounded-xl border border-gray-700 bg-gray-800 px-3 py-2.5 text-white outline-none focus:border-pink"
          />
        </label>

        <button
          type="button"
          disabled={!outcome || busy}
          onClick={() =>
            onSubmit({
              outcome,
              note: note.trim() || undefined,
              nextFollowUpAt: followUp ? new Date(followUp).toISOString() : undefined,
            })
          }
          className="mt-5 w-full rounded-xl bg-pink py-3 text-sm font-bold text-white disabled:opacity-40"
        >
          שמור תוצאה
        </button>
      </div>
    </div>
  );
}
