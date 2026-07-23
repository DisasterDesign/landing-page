"use client";

import { useState } from "react";

import type {
  SellerColdLead,
  SellerLeadInteractionInput,
  SellerLeadInteractionOutcome,
  SellerLeadLossReason,
} from "./cold-lead-types";

const outcomes: Array<[SellerLeadInteractionOutcome, string]> = [
  ["NO_ANSWER", "לא ענו"],
  ["CALLBACK", "ביקשו לחזור"],
  ["NON_DECISION_MAKER", "לא מקבל ההחלטה"],
  ["INTERESTED", "מעוניין"],
  ["NOT_INTERESTED", "לא מעוניין"],
  ["WRONG_NUMBER", "מספר שגוי"],
  ["DO_NOT_CALL", "לא להתקשר"],
];

const lossReasons: Array<[SellerLeadLossReason, string]> = [
  ["NO_INTEREST", "אין עניין"],
  ["NO_BUDGET", "אין תקציב"],
  ["BAD_TIMING", "תזמון לא מתאים"],
  ["EXISTING_PROVIDER", "יש ספק קיים"],
  ["DECISION_MAKER_UNREACHABLE", "לא ניתן להגיע למקבל החלטות"],
  ["NOT_FIT", "לא מתאים לשירות"],
  ["BAD_CONTACT", "פרטי קשר שגויים"],
  ["DUPLICATE", "ליד כפול"],
  ["OTHER", "סיבה אחרת"],
];

export default function CallOutcomeSheet({
  lead,
  busy,
  onClose,
  onSubmit,
}: {
  lead: SellerColdLead;
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: SellerLeadInteractionInput) => void;
}) {
  const [outcome, setOutcome] =
    useState<SellerLeadInteractionOutcome | null>(null);
  const [decisionMakerReached, setDecisionMakerReached] = useState(false);
  const [note, setNote] = useState("");
  const [followUpAction, setFollowUpAction] = useState<
    "SCHEDULE" | "END_AS_LOST" | null
  >(null);
  const [followUpAt, setFollowUpAt] = useState("");
  const [followUpIsFuture, setFollowUpIsFuture] = useState(false);
  const [lossReason, setLossReason] =
    useState<SellerLeadLossReason | null>(null);
  const [lossReasonDetails, setLossReasonDetails] = useState("");

  const explicitNextAction =
    outcome === "NO_ANSWER" || outcome === "NON_DECISION_MAKER";
  const schedulesFollowUp =
    outcome === "CALLBACK" || followUpAction === "SCHEDULE";
  const endsAsLost =
    outcome === "NOT_INTERESTED" || followUpAction === "END_AS_LOST";
  const requiresDecisionMaker =
    outcome === "INTERESTED" || outcome === "NOT_INTERESTED";
  const valid =
    Boolean(outcome) &&
    (!requiresDecisionMaker || decisionMakerReached) &&
    (!explicitNextAction || Boolean(followUpAction)) &&
    (!schedulesFollowUp || (Boolean(followUpAt) && followUpIsFuture)) &&
    (!endsAsLost || Boolean(lossReason)) &&
    (lossReason !== "OTHER" || Boolean(lossReasonDetails.trim()));

  function selectOutcome(next: SellerLeadInteractionOutcome) {
    setOutcome(next);
    setDecisionMakerReached(false);
    setFollowUpAction(next === "CALLBACK" ? "SCHEDULE" : null);
    setFollowUpAt("");
    setFollowUpIsFuture(false);
    setLossReason(
      next === "NOT_INTERESTED"
        ? "NO_INTEREST"
        : next === "WRONG_NUMBER"
          ? "BAD_CONTACT"
          : next === "DO_NOT_CALL"
            ? "DO_NOT_CONTACT"
            : null,
    );
    setLossReasonDetails("");
  }

  function submit() {
    if (!outcome || !valid) return;
    onSubmit({
      channel: "PHONE",
      outcome,
      decisionMakerReached:
        outcome === "NON_DECISION_MAKER" ? false : decisionMakerReached,
      note: note.trim() || undefined,
      followUpAction:
        outcome === "CALLBACK" ? "SCHEDULE" : followUpAction ?? undefined,
      followUpAt: schedulesFollowUp
        ? new Date(followUpAt).toISOString()
        : undefined,
      lossReason: lossReason ?? undefined,
      lossReasonDetails: lossReasonDetails.trim() || undefined,
      usedCallAngleIds: [],
    });
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 md:items-center"
      onClick={onClose}
    >
      <div
        dir="rtl"
        className="safe-pb max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-gray-700 bg-gray-900 p-5 shadow-2xl md:rounded-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">תוצאת שיחה</h2>
            <p className="mt-1 text-xs text-gray-500">
              {lead.business.displayName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white"
            aria-label="סגור"
          >
            ✕
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          {outcomes.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => selectOutcome(value)}
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

        {requiresDecisionMaker && (
          <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-gray-700 bg-gray-800 p-3 text-sm text-gray-200">
            <input
              type="checkbox"
              checked={decisionMakerReached}
              onChange={(event) =>
                setDecisionMakerReached(event.target.checked)
              }
              className="h-4 w-4 accent-pink"
            />
            דיברתי עם מקבל/ת ההחלטות
          </label>
        )}

        {explicitNextAction && (
          <div className="mt-4">
            <p className="mb-2 text-sm text-gray-300">מה הפעולה הבאה?</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFollowUpAction("SCHEDULE")}
                className={`rounded-xl border px-3 py-2.5 text-sm ${
                  followUpAction === "SCHEDULE"
                    ? "border-pink bg-pink/15 text-pink"
                    : "border-gray-700 text-gray-300"
                }`}
              >
                לקבוע פולואפ
              </button>
              <button
                type="button"
                onClick={() => setFollowUpAction("END_AS_LOST")}
                className={`rounded-xl border px-3 py-2.5 text-sm ${
                  followUpAction === "END_AS_LOST"
                    ? "border-red-500 bg-red-500/15 text-red-300"
                    : "border-gray-700 text-gray-300"
                }`}
              >
                לסיים כאבוד
              </button>
            </div>
          </div>
        )}

        {schedulesFollowUp && (
          <label className="mt-4 block space-y-2 text-sm text-gray-300">
            <span>מתי לחזור?</span>
            <input
              type="datetime-local"
              value={followUpAt}
              onChange={(event) => {
                setFollowUpAt(event.target.value);
                setFollowUpIsFuture(
                  new Date(event.target.value).getTime() > Date.now(),
                );
              }}
              className="w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2.5 text-white outline-none focus:border-pink"
            />
          </label>
        )}

        {endsAsLost && (
          <label className="mt-4 block space-y-2 text-sm text-gray-300">
            <span>סיבת סיום</span>
            <select
              value={lossReason ?? ""}
              onChange={(event) =>
                setLossReason(event.target.value as SellerLeadLossReason)
              }
              className="w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2.5 text-white outline-none focus:border-pink"
            >
              <option value="" disabled>
                בחרו סיבה
              </option>
              {lossReasons.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        )}

        {lossReason === "OTHER" && (
          <label className="mt-4 block space-y-2 text-sm text-gray-300">
            <span>פרטי הסיבה</span>
            <input
              value={lossReasonDetails}
              onChange={(event) => setLossReasonDetails(event.target.value)}
              maxLength={500}
              className="w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2.5 text-white outline-none focus:border-pink"
            />
          </label>
        )}

        <label className="mt-4 block space-y-2 text-sm text-gray-300">
          <span>הערה מהשיחה</span>
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
          disabled={!valid || busy}
          onClick={submit}
          className="mt-5 w-full rounded-xl bg-pink py-3 text-sm font-bold text-white disabled:opacity-40"
        >
          שמור תוצאה
        </button>
      </div>
    </div>
  );
}
