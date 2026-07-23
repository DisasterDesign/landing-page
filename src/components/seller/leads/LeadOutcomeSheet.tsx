"use client";

import type {
  LeadInteractionChannel,
  LeadInteractionOutcome,
  LeadLossReason,
} from "@prisma/client";
import { useMemo, useState } from "react";

import Modal from "@/components/ui/Modal";
import { initialLeadOutcomeFormState } from "@/lib/leads/ui-state";

export interface LeadOutcomeLead {
  displayName: string;
  name: string | null;
  company: string | null;
  preparation: {
    callAngles: Array<{ id: string; text: string; version: number }>;
  } | null;
}

export interface LeadOutcomeInput {
  channel: LeadInteractionChannel;
  outcome: LeadInteractionOutcome;
  decisionMakerReached: boolean;
  note?: string;
  followUpAction?: "SCHEDULE" | "END_AS_LOST";
  followUpAt?: string;
  lossReason?: LeadLossReason;
  lossReasonDetails?: string;
  usedCallAngleIds: string[];
}

const outcomes: Array<[LeadInteractionOutcome, string]> = [
  ["NO_ANSWER", "לא ענו"],
  ["CALLBACK", "ביקשו לחזור"],
  ["NON_DECISION_MAKER", "לא מקבל ההחלטה"],
  ["INTERESTED", "מעוניין"],
  ["NOT_INTERESTED", "לא מעוניין"],
  ["WRONG_NUMBER", "מספר שגוי"],
  ["DO_NOT_CALL", "לא ליצור קשר"],
];

const lossReasons: Array<[LeadLossReason, string]> = [
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

export default function LeadOutcomeSheet({
  lead,
  isOpen,
  busy,
  onClose,
  onSubmit,
}: {
  lead: LeadOutcomeLead;
  isOpen: boolean;
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: LeadOutcomeInput) => void;
}) {
  const initialState = initialLeadOutcomeFormState();
  const [channel, setChannel] =
    useState<LeadInteractionChannel>(initialState.channel);
  const [outcome, setOutcome] = useState<LeadInteractionOutcome | null>(
    initialState.outcome,
  );
  const [decisionMakerReached, setDecisionMakerReached] = useState(
    initialState.decisionMakerReached,
  );
  const [note, setNote] = useState(initialState.note);
  const [followUpAction, setFollowUpAction] = useState<
    "SCHEDULE" | "END_AS_LOST" | null
  >(initialState.followUpAction);
  const [followUpAt, setFollowUpAt] = useState(initialState.followUpAt);
  const [followUpIsFuture, setFollowUpIsFuture] = useState(
    initialState.followUpIsFuture,
  );
  const [lossReason, setLossReason] = useState<LeadLossReason | null>(
    initialState.lossReason,
  );
  const [lossReasonDetails, setLossReasonDetails] = useState(
    initialState.lossReasonDetails,
  );
  const [usedCallAngleIds, setUsedCallAngleIds] = useState<string[]>(
    initialState.usedCallAngleIds,
  );

  const callAngles = lead.preparation?.callAngles.slice(0, 3) ?? [];
  const explicitNextAction =
    outcome === "NO_ANSWER" || outcome === "NON_DECISION_MAKER";
  const schedulesFollowUp =
    outcome === "CALLBACK" || followUpAction === "SCHEDULE";
  const endsAsLost =
    outcome === "NOT_INTERESTED" || followUpAction === "END_AS_LOST";
  const requiresDecisionMaker =
    outcome === "INTERESTED" || outcome === "NOT_INTERESTED";
  const valid = useMemo(
    () =>
      Boolean(outcome) &&
      (!requiresDecisionMaker || decisionMakerReached) &&
      (!explicitNextAction || Boolean(followUpAction)) &&
      (!schedulesFollowUp || (Boolean(followUpAt) && followUpIsFuture)) &&
      (!endsAsLost || Boolean(lossReason)) &&
      (lossReason !== "OTHER" || Boolean(lossReasonDetails.trim())),
    [
      decisionMakerReached,
      endsAsLost,
      explicitNextAction,
      followUpAction,
      followUpAt,
      followUpIsFuture,
      lossReason,
      lossReasonDetails,
      outcome,
      requiresDecisionMaker,
      schedulesFollowUp,
    ],
  );

  function selectOutcome(next: LeadInteractionOutcome) {
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

  function toggleCallAngle(id: string) {
    setUsedCallAngleIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : current.length < 3
          ? [...current, id]
          : current,
    );
  }

  function submit() {
    if (!outcome || !valid) return;
    onSubmit({
      channel,
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
      usedCallAngleIds,
    });
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="תוצאת שיחה">
      <div dir="rtl">
        <p className="text-xs text-gray-500">
          {lead.displayName}
        </p>

        <label className="mt-4 block space-y-2 text-sm text-gray-300">
          <span>ערוץ הקשר</span>
          <select
            value={channel}
            onChange={(event) =>
              setChannel(event.target.value as LeadInteractionChannel)
            }
            className="w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2.5 text-white outline-none focus:border-pink"
          >
            <option value="PHONE">טלפון</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="EMAIL">דוא״ל</option>
            <option value="OTHER">אחר</option>
          </select>
        </label>

        <div
          role="group"
          aria-label="תוצאת השיחה"
          className="mt-4 grid grid-cols-2 gap-2"
        >
          {outcomes.map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={outcome === value}
              onClick={() => selectOutcome(value)}
              className={`rounded-xl border px-3 py-2.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink ${
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
            <div
              role="group"
              aria-label="הפעולה הבאה"
              className="grid grid-cols-2 gap-2"
            >
              <button
                type="button"
                aria-pressed={followUpAction === "SCHEDULE"}
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
                aria-pressed={followUpAction === "END_AS_LOST"}
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
                setLossReason(event.target.value as LeadLossReason)
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

        {callAngles.length > 0 && (
          <fieldset className="mt-4">
            <legend className="text-sm text-gray-300">
              באילו זוויות השתמשת?
            </legend>
            <div className="mt-2 space-y-2">
              {callAngles.map((angle) => (
                <label
                  key={angle.id}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-gray-700 bg-gray-800 p-3 text-sm text-gray-200"
                >
                  <input
                    type="checkbox"
                    checked={usedCallAngleIds.includes(angle.id)}
                    onChange={() => toggleCallAngle(angle.id)}
                    className="mt-0.5 h-4 w-4 accent-pink"
                  />
                  <span>{angle.text}</span>
                </label>
              ))}
            </div>
          </fieldset>
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
          className="mt-5 w-full rounded-xl bg-pink py-3 text-sm font-bold text-white transition hover:bg-pink-dark disabled:opacity-40"
        >
          {busy ? "שומר..." : "שמור תוצאה"}
        </button>
      </div>
    </Modal>
  );
}
