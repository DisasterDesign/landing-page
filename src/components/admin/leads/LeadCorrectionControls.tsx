"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import type { LeadDetail } from "@/lib/leads/projection";
import {
  firstAllowedAdminStageAction,
  type AdminStageAction,
} from "@/lib/leads/ui-state";

const fieldClass =
  "w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white outline-none focus:border-pink";

async function save(
  url: string,
  body: Record<string, unknown>,
  success: string,
  leadId: string,
) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      message?: string;
      error?: string;
    } | null;
    throw new Error(payload?.message ?? payload?.error ?? "הפעולה נכשלה");
  }
  toast.success(success);
  window.dispatchEvent(
    new CustomEvent("lead:changed", { detail: { id: leadId } }),
  );
}

export default function LeadCorrectionControls({
  lead,
}: {
  lead: LeadDetail;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [contactReason, setContactReason] = useState("");
  const [contact, setContact] = useState({
    name: lead.name ?? "",
    company: lead.company ?? "",
    email: lead.email ?? "",
    phone: lead.phoneSource === "CRM" ? lead.phone ?? "" : "",
  });
  const [sourceReason, setSourceReason] = useState("");
  const [intentLevel, setIntentLevel] = useState(lead.intentLevel ?? "INBOUND");
  const [sourceKey, setSourceKey] = useState(lead.sourceKey ?? "website");
  const [externalLeadId, setExternalLeadId] = useState("");
  const [snapshot, setSnapshot] = useState(
    JSON.stringify(lead.sourceSnapshot ?? {}, null, 2),
  );
  const [stageAction, setStageAction] = useState<AdminStageAction>(
    () => firstAllowedAdminStageAction(lead.capabilities) ?? "mark-lost",
  );
  const [stageReason, setStageReason] = useState("");
  const [lossReason, setLossReason] = useState("NO_INTEREST");
  const [sellers, setSellers] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [creditSellerId, setCreditSellerId] = useState("");
  const [creditReason, setCreditReason] = useState("");

  useEffect(() => {
    void fetch("/api/users", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : []))
      .then(
        (users: Array<{ id: string; name: string; role: string }>) =>
          setSellers(
            users
              .filter((user) => user.role === "SELLER")
              .map(({ id, name }) => ({ id, name })),
          ),
      );
  }, []);

  useEffect(() => {
    const allowed = firstAllowedAdminStageAction(lead.capabilities);
    const currentAllowed =
      (stageAction === "mark-lost" && lead.capabilities.canMarkLost) ||
      (stageAction === "mark-spam" && lead.capabilities.canMarkSpam) ||
      (stageAction === "reopen-lost" && lead.capabilities.canReopen);
    if (allowed && !currentAllowed) setStageAction(allowed);
  }, [lead.capabilities, stageAction]);

  async function run(operation: () => Promise<void>) {
    setBusy(true);
    try {
      await operation();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "הפעולה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      dir="rtl"
      className="rounded-2xl border border-gray-700 bg-gray-900 p-4"
    >
      <h2 className="font-bold text-white">תיקונים מבוקרים</h2>
      <div className="mt-4 space-y-3">
        {lead.capabilities.canUpdateContact && (
          <details className="rounded-xl border border-gray-700 bg-gray-800 p-3">
            <summary className="cursor-pointer font-bold text-gray-200">
              תיקון פרטי קשר
            </summary>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["name", "שם"],
                  ["company", "עסק"],
                  ["email", "דוא״ל"],
                  ["phone", "טלפון"],
                ] as const
              ).map(([key, label]) => (
                <input
                  key={key}
                  aria-label={label}
                  value={contact[key]}
                  onChange={(event) =>
                    setContact((current) => ({
                      ...current,
                      [key]: event.target.value,
                    }))
                  }
                  placeholder={label}
                  className={fieldClass}
                />
              ))}
            </div>
            <input
              value={contactReason}
              onChange={(event) => setContactReason(event.target.value)}
              placeholder="סיבת התיקון"
              className={`${fieldClass} mt-2`}
            />
            <button
              type="button"
              disabled={busy || contactReason.trim().length < 3}
              onClick={() =>
                run(() =>
                  save(
                    `/api/leads/${lead.id}/contact`,
                    { ...contact, reason: contactReason.trim() },
                    "פרטי הקשר תוקנו",
                    lead.id,
                  ),
                )
              }
              className="mt-2 rounded-xl bg-cyan/20 px-4 py-2 text-sm font-bold text-cyan disabled:opacity-40"
            >
              שמור תיקון
            </button>
          </details>
        )}

        {lead.capabilities.canCorrectSource && !lead.migrationReviewRequired && (
          <details className="rounded-xl border border-gray-700 bg-gray-800 p-3">
            <summary className="cursor-pointer font-bold text-gray-200">
              תיקון מקור הליד
            </summary>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <select
                value={intentLevel}
                onChange={(event) =>
                  setIntentLevel(
                    event.target.value as typeof intentLevel,
                  )
                }
                className={fieldClass}
              >
                <option value="OUTBOUND">פנייה קרה</option>
                <option value="AD_RESPONSE">תגובה לפרסומת</option>
                <option value="INBOUND">פנייה יזומה</option>
              </select>
              <select
                value={sourceKey}
                onChange={(event) => setSourceKey(event.target.value)}
                className={fieldClass}
              >
                <option value="google_maps">Google Maps</option>
                <option value="meta_lead_ads">Meta Lead Ads</option>
                <option value="website">אתר</option>
                <option value="google_search_ads">Google Search</option>
              </select>
              <input
                value={externalLeadId}
                onChange={(event) => setExternalLeadId(event.target.value)}
                placeholder="External ID, אם נדרש"
                className={fieldClass}
              />
              <input
                value={sourceReason}
                onChange={(event) => setSourceReason(event.target.value)}
                placeholder="סיבת התיקון"
                className={fieldClass}
              />
            </div>
            <textarea
              value={snapshot}
              onChange={(event) => setSnapshot(event.target.value)}
              rows={7}
              dir="ltr"
              className={`${fieldClass} mt-2 resize-y`}
            />
            <button
              type="button"
              disabled={busy || sourceReason.trim().length < 3}
              onClick={() =>
                run(async () => {
                  const sourceSnapshot = JSON.parse(snapshot) as Record<
                    string,
                    unknown
                  >;
                  await save(
                    `/api/leads/${lead.id}/source`,
                    {
                      intentLevel,
                      sourceKey,
                      ...(externalLeadId.trim()
                        ? { externalLeadId: externalLeadId.trim() }
                        : {}),
                      sourceSnapshot,
                      reason: sourceReason.trim(),
                    },
                    "מקור הליד תוקן",
                    lead.id,
                  );
                })
              }
              className="mt-2 rounded-xl bg-cyan/20 px-4 py-2 text-sm font-bold text-cyan disabled:opacity-40"
            >
              שמור מקור
            </button>
          </details>
        )}

        {(lead.capabilities.canMarkLost ||
          lead.capabilities.canMarkSpam ||
          lead.capabilities.canReopen) && (
          <details className="rounded-xl border border-gray-700 bg-gray-800 p-3">
            <summary className="cursor-pointer font-bold text-gray-200">
              שינוי שלב מבוקר
            </summary>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <select
                value={stageAction}
                onChange={(event) =>
                  setStageAction(event.target.value as typeof stageAction)
                }
                className={fieldClass}
              >
                {lead.capabilities.canMarkLost && (
                  <option value="mark-lost">סמן כאבוד</option>
                )}
                {lead.capabilities.canMarkSpam && (
                  <option value="mark-spam">סמן כספאם</option>
                )}
                {lead.capabilities.canReopen && (
                  <option value="reopen-lost">פתח מחדש</option>
                )}
              </select>
              {stageAction === "mark-lost" && (
                <select
                  value={lossReason}
                  onChange={(event) => setLossReason(event.target.value)}
                  className={fieldClass}
                >
                  <option value="NO_INTEREST">אין עניין</option>
                  <option value="NO_BUDGET">אין תקציב</option>
                  <option value="BAD_TIMING">תזמון</option>
                  <option value="NOT_FIT">לא מתאים</option>
                  <option value="BAD_CONTACT">פרטים שגויים</option>
                  <option value="OTHER">אחר</option>
                </select>
              )}
              <input
                value={stageReason}
                onChange={(event) => setStageReason(event.target.value)}
                placeholder="סיבה / פרטים"
                className={fieldClass}
              />
            </div>
            <button
              type="button"
              disabled={busy || stageReason.trim().length < 3}
              onClick={() =>
                run(() =>
                  save(
                    `/api/leads/${lead.id}/stage`,
                    {
                      action: stageAction,
                      reason: stageReason.trim(),
                      ...(stageAction === "mark-lost"
                        ? {
                            lossReason,
                            ...(lossReason === "OTHER"
                              ? { lossReasonDetails: stageReason.trim() }
                              : {}),
                          }
                        : {}),
                    },
                    "שלב הליד עודכן",
                    lead.id,
                  ),
                )
              }
              className="mt-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-300 disabled:opacity-40"
            >
              בצע שינוי
            </button>
          </details>
        )}

        {lead.capabilities.canChangeCommissionCredit &&
          lead.agreements.length > 0 && (
            <details className="rounded-xl border border-gray-700 bg-gray-800 p-3">
              <summary className="cursor-pointer font-bold text-gray-200">
                תיקון קרדיט מכירה
              </summary>
              <p className="mt-2 text-xs text-amber-200">
                שינוי בעלות על הליד אינו משנה את קרדיט העמלה. זו פעולה נפרדת
                ומתועדת.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <select
                  value={creditSellerId}
                  onChange={(event) => setCreditSellerId(event.target.value)}
                  className={fieldClass}
                >
                  <option value="">בחר איש מכירות</option>
                  {sellers.map((seller) => (
                    <option key={seller.id} value={seller.id}>
                      {seller.name}
                    </option>
                  ))}
                </select>
                <input
                  value={creditReason}
                  onChange={(event) => setCreditReason(event.target.value)}
                  placeholder="סיבת התיקון"
                  className={fieldClass}
                />
              </div>
              <button
                type="button"
                disabled={
                  busy ||
                  !creditSellerId ||
                  creditReason.trim().length < 3
                }
                onClick={() =>
                  run(() =>
                    save(
                      `/api/agreements/${lead.agreements.at(-1)!.id}/credit`,
                      {
                        creditedSellerId: creditSellerId,
                        reason: creditReason.trim(),
                      },
                      "קרדיט המכירה עודכן",
                      lead.id,
                    ),
                  )
                }
                className="mt-2 rounded-xl bg-cyan/20 px-4 py-2 text-sm font-bold text-cyan disabled:opacity-40"
              >
                עדכן קרדיט
              </button>
            </details>
          )}
      </div>
    </section>
  );
}
