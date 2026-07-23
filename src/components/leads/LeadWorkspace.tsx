"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import LeadPreparationPanel from "@/components/seller/leads/LeadPreparationPanel";
import LeadOutcomeSheet, {
  type LeadOutcomeInput,
} from "@/components/seller/leads/LeadOutcomeSheet";
import Modal from "@/components/ui/Modal";
import type { LeadDetail } from "@/lib/leads/projection";
import {
  isLeadChangedEventFor,
  LEAD_CHANGED_EVENT,
} from "@/lib/leads/ui-events";
import {
  contactDetailsForUpdate,
  leadWorkspaceTabFromQuery,
  type LeadContactDraft,
  type LeadPrimaryActionKind,
  type LeadWorkspaceTab,
} from "@/lib/leads/ui-state";

import LeadActivityTimeline from "./LeadActivityTimeline";
import LeadContactActions from "./LeadContactActions";
import LeadPrimaryAction from "./LeadPrimaryAction";
import LeadSourceBadge from "./LeadSourceBadge";

const stageLabels: Record<string, string> = {
  NEW: "חדש",
  PREPARING: "בהכנה",
  CONTACTING: "בתהליך יצירת קשר",
  QUALIFIED: "מוכשר לחוזה",
  AGREEMENT_DRAFT: "חוזה בטיוטה",
  AGREEMENT_SENT: "חוזה נשלח",
  AGREEMENT_SIGNED: "חוזה נחתם",
  WON: "עסקה נסגרה",
  LOST: "אבוד",
  SPAM: "ספאם",
};

const nextActionLabels: Record<string, string> = {
  RECOVER_FIRST_PAYMENT: "לטפל בתשלום הראשון",
  COMPLETE_FOLLOW_UP: "לבצע את הפולואפ",
  VIEW_AGREEMENT: "לפתוח את החוזה",
  CREATE_AGREEMENT: "להכין חוזה",
  CLAIM: "לקחת אחריות על הליד",
  PREPARE: "להכין את השיחה",
  CONTACT: "ליצור קשר",
  NONE: "אין פעולה פתוחה",
};

async function responseError(response: Response) {
  const payload = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  return payload?.error || "הפעולה נכשלה";
}

export default function LeadWorkspace({
  leadId,
  audience,
  initialLead = null,
  initialTab,
}: {
  leadId: string;
  audience: "seller" | "admin";
  initialLead?: LeadDetail | null;
  initialTab?: string | string[];
}) {
  const [lead, setLead] = useState<LeadDetail | null>(initialLead);
  const [loading, setLoading] = useState(!initialLead);
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<LeadWorkspaceTab>(() =>
    leadWorkspaceTabFromQuery(initialTab),
  );
  const [outcomeOpen, setOutcomeOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [followUpAt, setFollowUpAt] = useState("");
  const [followUpIsFuture, setFollowUpIsFuture] = useState(false);
  const [followUpReason, setFollowUpReason] = useState("");
  const [editingFollowUpId, setEditingFollowUpId] = useState<string | null>(
    null,
  );
  const [contactDraft, setContactDraft] = useState<LeadContactDraft>({
    name: "",
    company: "",
    email: "",
    phone: "",
  });

  const detailEndpoint =
    audience === "seller"
      ? `/api/seller/leads/${leadId}`
      : `/api/leads/${leadId}`;
  const mutationBase =
    audience === "seller"
      ? `/api/seller/leads/${leadId}`
      : `/api/leads/${leadId}`;

  const loadLead = useCallback(async () => {
    const response = await fetch(detailEndpoint, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error(await responseError(response));
    const nextLead = (await response.json()) as LeadDetail;
    setLead(nextLead);
    setContactDraft({
      name: nextLead.name ?? "",
      company: nextLead.company ?? "",
      email: nextLead.email ?? "",
      phone: nextLead.phone ?? "",
    });
    return nextLead;
  }, [detailEndpoint]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadLead()
      .catch((error) => {
        if (active) toast.error(error instanceof Error ? error.message : "הטעינה נכשלה");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadLead]);

  useEffect(() => {
    const handleLeadChanged = (event: Event) => {
      if (!isLeadChangedEventFor(event, leadId)) return;
      void loadLead().catch((error) => {
        toast.error(
          error instanceof Error ? error.message : "רענון הליד נכשל",
        );
      });
    };

    window.addEventListener(LEAD_CHANGED_EVENT, handleLeadChanged);
    return () => {
      window.removeEventListener(LEAD_CHANGED_EVENT, handleLeadChanged);
    };
  }, [leadId, loadLead]);

  const activeFollowUp = useMemo(
    () => lead?.followUps.find((followUp) => followUp.status === "SCHEDULED"),
    [lead],
  );

  async function mutate(
    url: string,
    init: RequestInit,
    successMessage: string,
  ) {
    setBusy(true);
    try {
      const response = await fetch(url, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...init.headers,
        },
      });
      if (!response.ok) throw new Error(await responseError(response));
      await loadLead();
      toast.success(successMessage);
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "הפעולה נכשלה");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function claimLead() {
    setBusy(true);
    try {
      const response = await fetch(`/api/seller/leads/${leadId}/claim`, {
        method: "POST",
      });
      if (response.status === 409) {
        toast.error("הליד כבר נלקח");
        await loadLead();
        return false;
      }
      if (!response.ok) throw new Error(await responseError(response));
      await loadLead();
      toast.success("הליד נרשם על שמך");
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "לקיחת הליד נכשלה");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handlePrimaryAction(action: LeadPrimaryActionKind) {
    if (!lead) return;
    if (action === "START_PREPARATION") {
      if (audience === "seller" && (await claimLead())) {
        setActiveTab("preparation");
      }
      return;
    }
    if (action === "CLAIM_AND_CALL") {
      if (audience === "seller" && (await claimLead())) {
        if (lead.phone) window.location.href = `tel:${lead.phone.replace(/[^+\d]/g, "")}`;
        setOutcomeOpen(true);
      }
      return;
    }
    if (action === "CALL") {
      if (lead.phone) {
        window.location.href = `tel:${lead.phone.replace(/[^+\d]/g, "")}`;
      }
      setOutcomeOpen(true);
      return;
    }
    if (action === "RECORD_OUTCOME") {
      setOutcomeOpen(true);
    }
  }

  async function submitOutcome(input: LeadOutcomeInput) {
    const success = await mutate(
      `${mutationBase}/interactions`,
      { method: "POST", body: JSON.stringify(input) },
      "תוצאת השיחה נשמרה",
    );
    if (success) {
      setOutcomeOpen(false);
      setActiveTab("activity");
    }
  }

  async function addNote() {
    if (!noteBody.trim()) return;
    const success = await mutate(
      `${mutationBase}/notes`,
      { method: "POST", body: JSON.stringify({ body: noteBody.trim() }) },
      "ההערה נשמרה בהיסטוריית החברה",
    );
    if (success) setNoteBody("");
  }

  async function scheduleFollowUp() {
    if (!followUpAt || !followUpReason.trim()) return;
    const success = await mutate(
      `${mutationBase}/follow-ups`,
      {
        method: editingFollowUpId ? "PATCH" : "POST",
        body: JSON.stringify({
          ...(editingFollowUpId
            ? { action: "reschedule", followUpId: editingFollowUpId }
            : {}),
          dueAt: new Date(followUpAt).toISOString(),
          reason: followUpReason.trim(),
        }),
      },
      editingFollowUpId ? "הפולואפ עודכן" : "הפולואפ נקבע",
    );
    if (success) {
      setFollowUpOpen(false);
      setFollowUpAt("");
      setFollowUpIsFuture(false);
      setFollowUpReason("");
      setEditingFollowUpId(null);
    }
  }

  function openNewFollowUp() {
    setEditingFollowUpId(null);
    setFollowUpAt("");
    setFollowUpIsFuture(false);
    setFollowUpReason("");
    setFollowUpOpen(true);
  }

  function editActiveFollowUp() {
    if (!activeFollowUp) return;
    const localDate = new Date(activeFollowUp.dueAt);
    const offsetMs = localDate.getTimezoneOffset() * 60_000;
    setEditingFollowUpId(activeFollowUp.id);
    setFollowUpAt(
      new Date(localDate.getTime() - offsetMs).toISOString().slice(0, 16),
    );
    setFollowUpIsFuture(localDate.getTime() > Date.now());
    setFollowUpReason(activeFollowUp.reason);
    setFollowUpOpen(true);
  }

  async function completeFollowUp() {
    if (!activeFollowUp) return;
    await mutate(
      `${mutationBase}/follow-ups`,
      {
        method: "PATCH",
        body: JSON.stringify({
          action: "complete",
          followUpId: activeFollowUp.id,
        }),
      },
      "הפולואפ הושלם",
    );
  }

  async function updateContact() {
    if (!lead) return;
    const changed = contactDetailsForUpdate({
      current: lead,
      draft: contactDraft,
      confirmGooglePhone: audience === "seller",
    });
    if (Object.keys(changed).length === 0) {
      toast.error("לא בוצע שינוי בפרטי הקשר");
      return;
    }
    await mutate(
      `${mutationBase}/contact`,
      {
        method: "POST",
        body: JSON.stringify(
          audience === "seller"
            ? { ...changed, confirmedBySeller: true }
            : { ...changed, reason: "תיקון ידני ממסך הליד" },
        ),
      },
      "פרטי הקשר עודכנו",
    );
  }

  if (loading && !lead) {
    return (
      <div
        dir="rtl"
        className="rounded-2xl border border-gray-700 bg-gray-900 p-8 text-center text-gray-400"
      >
        טוען ליד...
      </div>
    );
  }

  if (!lead) {
    return (
      <div
        dir="rtl"
        className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-red-200"
      >
        הליד לא נמצא או שאין הרשאה לצפות בו.
      </div>
    );
  }

  const displayName = lead.company ?? lead.name ?? "ליד ללא שם";
  const nextActionLabel = nextActionLabels[lead.nextAction.kind];

  return (
    <div dir="rtl" className="space-y-4">
      <header className="rounded-2xl border border-gray-700 bg-gray-900 p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-3">
            <LeadSourceBadge
              intentLevel={lead.intentLevel}
              sourceKey={lead.sourceKey}
              sourceLabel={lead.sourceLabel}
              sourceContext={lead.sourceContext}
            />
            <div>
              <h1 className="text-2xl font-bold text-white">{displayName}</h1>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-400">
                <span>
                  שלב:{" "}
                  <strong className="text-gray-200">
                    {lead.stage ? stageLabels[lead.stage] : "דורש סיווג"}
                  </strong>
                </span>
                <span>
                  בעלות:{" "}
                  <strong className="text-gray-200">
                    {lead.owner?.name ??
                      (lead.eligibleSeller?.name
                        ? `ממתין ל־${lead.eligibleSeller.name}`
                        : "ללא בעלים")}
                  </strong>
                </span>
              </div>
            </div>
            <LeadContactActions
              phone={lead.phone}
              phoneSource={lead.phoneSource}
              website={lead.website}
              mapUrl={lead.mapUrl}
              doNotContactAt={lead.doNotContactAt}
              capabilities={lead.capabilities}
              onScheduleFollowUp={openNewFollowUp}
            />
          </div>

          <div className="rounded-xl border border-gray-700 bg-gray-800 p-4 lg:min-w-64">
            <p className="text-xs text-gray-500">הפעולה הבאה</p>
            <p className="mt-1 text-sm font-bold text-white">
              {nextActionLabel}
            </p>
            {lead.nextAction.kind === "COMPLETE_FOLLOW_UP" && (
              <p className="mt-1 text-xs text-gray-400">
                {new Date(lead.nextAction.dueAt).toLocaleString("he-IL")}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <LeadPrimaryAction
                lead={lead}
                audience={audience}
                busy={busy}
                onAction={handlePrimaryAction}
              />
              {lead.nextAction.kind === "COMPLETE_FOLLOW_UP" &&
                lead.capabilities.canCompleteFollowUp &&
                !lead.doNotContactAt && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={completeFollowUp}
                    className="rounded-xl bg-cyan/20 px-4 py-2.5 text-sm font-bold text-cyan transition hover:bg-cyan/30 disabled:opacity-50"
                  >
                    סמן כהושלם
                  </button>
                )}
            </div>
          </div>
        </div>
      </header>

      {lead.migrationReviewRequired && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200">
          הליד דורש סיווג אדמין לפני שאפשר ליצור קשר או לקדם מכירה.
          {lead.migrationReviewReason && (
            <span className="mr-2 text-amber-100">
              {lead.migrationReviewReason}
            </span>
          )}
        </div>
      )}

      <nav
        aria-label="אזורי עבודה בליד"
        role="tablist"
        className="flex gap-2 overflow-x-auto rounded-2xl border border-gray-700 bg-gray-900 p-2"
      >
        {(
          [
            ["activity", "פעילות והערות"],
            ["preparation", "הכנה ואבחון"],
            ["agreement", "חוזה ומכירה"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            id={`lead-tab-${value}`}
            aria-selected={activeTab === value}
            aria-controls={`lead-panel-${value}`}
            onClick={() => setActiveTab(value)}
            className={`min-h-11 shrink-0 rounded-xl px-4 py-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink ${
              activeTab === value
                ? "bg-pink text-white"
                : "text-gray-400 hover:bg-gray-800 hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      <main
        id={`lead-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`lead-tab-${activeTab}`}
        className="rounded-2xl border border-gray-700 bg-gray-900 p-5"
      >
        {activeTab === "activity" && (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
            <LeadActivityTimeline items={lead.timeline} />
            <aside className="space-y-4">
              {lead.capabilities.canAddNote && (
                <section className="rounded-xl border border-gray-700 bg-gray-800 p-4">
                  <h2 className="font-bold text-white">הערה לצוות</h2>
                  <p className="mt-1 text-xs text-gray-500">
                    ההערה נשמרת בהיסטוריית החברה עם שמך וזמן הכתיבה.
                  </p>
                  <textarea
                    value={noteBody}
                    onChange={(event) => setNoteBody(event.target.value)}
                    maxLength={5_000}
                    rows={4}
                    className="mt-3 w-full resize-none rounded-xl border border-gray-700 bg-gray-900 px-3 py-2.5 text-white outline-none focus:border-pink"
                  />
                  <button
                    type="button"
                    disabled={busy || !noteBody.trim()}
                    onClick={addNote}
                    className="mt-3 w-full rounded-xl bg-cyan/20 py-2.5 text-sm font-bold text-cyan transition hover:bg-cyan/30 disabled:opacity-40"
                  >
                    שמור הערה
                  </button>
                </section>
              )}

              {activeFollowUp && (
                <section className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4">
                  <h2 className="font-bold text-amber-200">פולואפ פתוח</h2>
                  <p className="mt-2 text-sm text-gray-200">
                    {activeFollowUp.reason}
                  </p>
                  <time className="mt-1 block text-xs text-gray-400">
                    {new Date(activeFollowUp.dueAt).toLocaleString("he-IL")}
                  </time>
                  {lead.capabilities.canCompleteFollowUp &&
                    !lead.doNotContactAt && (
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={editActiveFollowUp}
                          className="rounded-xl border border-amber-400/30 px-3 py-2 text-xs font-bold text-amber-100"
                        >
                          שנה מועד
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={completeFollowUp}
                          className="rounded-xl bg-cyan/20 px-3 py-2 text-xs font-bold text-cyan disabled:opacity-50"
                        >
                          סמן כהושלם
                        </button>
                      </div>
                    )}
                </section>
              )}
            </aside>
          </div>
        )}

        {activeTab === "preparation" && (
          <LeadPreparationPanel lead={lead} />
        )}

        {activeTab === "agreement" && (
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-xl border border-gray-700 bg-gray-800 p-4">
              <h2 className="font-bold text-white">פרטי קשר מאומתים</h2>
              <p className="mt-1 text-xs text-gray-500">
                לפני הכנת חוזה ודאו שהפרטים נמסרו או אושרו בשיחה. מספר מ־Google
                אינו נכנס אוטומטית לחוזה.
              </p>
              <div className="mt-4 grid gap-3">
                {(
                  [
                    ["name", "שם איש קשר", "text"],
                    ["company", "שם העסק", "text"],
                    ["email", "דוא״ל", "email"],
                    ["phone", "טלפון", "tel"],
                  ] as const
                ).map(([key, label, type]) => (
                  <label key={key} className="space-y-1 text-sm text-gray-300">
                    <span>{label}</span>
                    <input
                      type={type}
                      value={contactDraft[key]}
                      disabled={!lead.capabilities.canUpdateContact}
                      onChange={(event) =>
                        setContactDraft((current) => ({
                          ...current,
                          [key]: event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-gray-700 bg-gray-900 px-3 py-2.5 text-white outline-none focus:border-pink disabled:opacity-60"
                    />
                  </label>
                ))}
              </div>
              {lead.capabilities.canUpdateContact && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={updateContact}
                  className="mt-4 w-full rounded-xl bg-cyan/20 py-2.5 text-sm font-bold text-cyan transition hover:bg-cyan/30 disabled:opacity-50"
                >
                  אשר ושמור פרטי קשר
                </button>
              )}
            </section>

            <section className="rounded-xl border border-gray-700 bg-gray-800 p-4">
              <h2 className="font-bold text-white">חוזה ומכירה</h2>
              {lead.agreements.length === 0 ? (
                <p className="mt-3 text-sm text-gray-400">
                  עדיין לא נוצר חוזה לליד. האפשרות תיפתח לאחר שהליד יוכשר.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {lead.agreements.map((agreement) => (
                    <li
                      key={agreement.id}
                      className="rounded-xl border border-gray-700 bg-gray-900 p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-white">
                          {agreement.status}
                        </span>
                        <span className="text-sm text-gray-300">
                          ₪{agreement.monthlyPrice.toLocaleString("he-IL")}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        תשלום: {agreement.paymentStatus}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              {lead.capabilities.canCreateAgreement && (
                <p className="mt-4 text-sm text-gray-300">
                  הפעולה להכנת החוזה זמינה בראש העמוד.
                </p>
              )}
            </section>
          </div>
        )}
      </main>

      {outcomeOpen && (
        <LeadOutcomeSheet
          lead={lead}
          isOpen
          busy={busy}
          onClose={() => setOutcomeOpen(false)}
          onSubmit={submitOutcome}
        />
      )}

      <Modal
        isOpen={followUpOpen}
        onClose={() => {
          setFollowUpOpen(false);
          setEditingFollowUpId(null);
        }}
        title={editingFollowUpId ? "שינוי פולואפ" : "קביעת פולואפ"}
      >
        <div dir="rtl" className="space-y-4">
          <label className="block space-y-2 text-sm text-gray-300">
            <span>מועד</span>
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
          <label className="block space-y-2 text-sm text-gray-300">
            <span>סיבה / מה לעשות</span>
            <textarea
              value={followUpReason}
              onChange={(event) => setFollowUpReason(event.target.value)}
              maxLength={500}
              rows={3}
              className="w-full resize-none rounded-xl border border-gray-700 bg-gray-800 px-3 py-2.5 text-white outline-none focus:border-pink"
            />
          </label>
          <button
            type="button"
            disabled={
              busy ||
              !followUpAt ||
              !followUpReason.trim() ||
              !followUpIsFuture
            }
            onClick={scheduleFollowUp}
            className="w-full rounded-xl bg-pink py-3 text-sm font-bold text-white transition hover:bg-pink-dark disabled:opacity-40"
          >
            שמור פולואפ
          </button>
        </div>
      </Modal>
    </div>
  );
}
