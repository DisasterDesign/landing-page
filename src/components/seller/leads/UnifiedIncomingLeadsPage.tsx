"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

import type { LeadIntentLevel } from "@prisma/client";

import LeadSourceBadge, {
  LEAD_TEMPERATURES,
} from "@/components/leads/LeadSourceBadge";
import Modal from "@/components/ui/Modal";
import PullToRefresh from "@/components/ui/PullToRefresh";
import type { SellerLeadDetail } from "@/lib/leads/projection";
import { mergeLeadQueueItems } from "@/lib/leads/ui-state";

const TEMPERATURE_TABS: Array<{ value: LeadIntentLevel | ""; label: string }> = [
  { value: "", label: "הכל" },
  { value: "INBOUND", label: `${LEAD_TEMPERATURES.INBOUND.emoji} חמים` },
  { value: "AD_RESPONSE", label: `${LEAD_TEMPERATURES.AD_RESPONSE.emoji} בינוניים` },
  { value: "OUTBOUND", label: `${LEAD_TEMPERATURES.OUTBOUND.emoji} קרים` },
];

const slaLabels = {
  ON_TIME: "בתוך זמן התגובה",
  OVERDUE: "חריגת זמן תגובה",
  MET: "נענה בזמן",
  MISSED: "נענה באיחור",
} as const;

const slaStyles = {
  ON_TIME: "bg-green-500/10 text-green-300 border-green-500/30",
  OVERDUE: "bg-red-500/10 text-red-300 border-red-500/30",
  MET: "bg-green-500/10 text-green-300 border-green-500/30",
  MISSED: "bg-amber-400/10 text-amber-200 border-amber-400/30",
} as const;

export default function UnifiedIncomingLeadsPage() {
  const router = useRouter();
  const copyFallbackInput = useRef<HTMLInputElement>(null);
  const [leads, setLeads] = useState<SellerLeadDetail[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [copyFallback, setCopyFallback] = useState<string | null>(null);
  const [temperature, setTemperature] = useState<LeadIntentLevel | "">("");

  const load = useCallback(async () => {
    try {
      const focus = new URLSearchParams(window.location.search).get("focus");
      const response = await fetch(
        focus
          ? `/api/seller/leads?focus=${encodeURIComponent(focus)}`
          : "/api/seller/leads",
        {
          cache: "no-store",
        },
      );
      if (!response.ok) throw new Error();
      const payload = (await response.json()) as {
        leads: SellerLeadDetail[];
        nextCursor: string | null;
      };
      setLeads(payload.leads);
      setNextCursor(payload.nextCursor);
    } catch {
      toast.error("שגיאה בטעינת הלידים");
    } finally {
      setLoading(false);
    }
  }, []);

  async function loadMore() {
    const cursor = nextCursor;
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const response = await fetch(
        `/api/seller/leads?cursor=${encodeURIComponent(cursor)}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error();
      const payload = (await response.json()) as {
        leads: SellerLeadDetail[];
        nextCursor: string | null;
      };
      setLeads((current) => mergeLeadQueueItems(current, payload.leads));
      setNextCursor(payload.nextCursor);
    } catch {
      toast.error("שגיאה בטעינת לידים נוספים");
    } finally {
      setLoadingMore(false);
    }
  }

  useEffect(() => {
    setFocusId(new URLSearchParams(window.location.search).get("focus"));
    void load();
  }, [load]);

  useEffect(() => {
    if (!focusId || loading) return;
    requestAnimationFrame(() => {
      document
        .getElementById(`lead-${focusId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [focusId, leads, loading]);

  async function claim(lead: SellerLeadDetail) {
    setBusyId(lead.id);
    try {
      const response = await fetch(`/api/seller/leads/${lead.id}/claim`, {
        method: "POST",
      });
      if (response.status === 409) {
        toast.error("הליד כבר נלקח");
        await load();
        return;
      }
      if (!response.ok) throw new Error();
      toast.success("הליד נרשם על שמך");
      router.push(
        `/seller/leads/${encodeURIComponent(lead.id)}?tab=preparation`,
      );
    } catch {
      toast.error("לקיחת הליד נכשלה");
    } finally {
      setBusyId(null);
    }
  }

  function copyPhone(phone: string) {
    if (!navigator.clipboard?.writeText) {
      setCopyFallback(phone);
      requestAnimationFrame(() => copyFallbackInput.current?.select());
      return;
    }
    void navigator.clipboard
      .writeText(phone)
      .then(() => toast.success("הועתק"))
      .catch(() => {
        setCopyFallback(phone);
        requestAnimationFrame(() => copyFallbackInput.current?.select());
      });
  }

  return (
    <PullToRefresh onRefresh={load}>
      <div dir="rtl" className="space-y-5">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">הלידים שלי</h1>
            <p className="mt-1 text-sm text-gray-400">
              רשימה אחת, שלוש דרגות חום: 🔥 חם — הלקוח חיפש אותנו · 🌤️ בינוני
              — השאיר פרטים בפרסומת · 🧊 קר — איתור יזום שלנו. חמים תחילה.
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            className="rounded-xl border border-gray-700 px-3 py-2 text-sm text-gray-400 hover:text-white"
          >
            רענן
          </button>
        </header>

        <nav
          aria-label="סינון לפי דרגת חום"
          className="flex flex-wrap gap-2"
        >
          {TEMPERATURE_TABS.map((tab) => {
            const count =
              tab.value === ""
                ? leads.length
                : leads.filter((lead) => lead.intentLevel === tab.value)
                    .length;
            const active = temperature === tab.value;
            return (
              <button
                key={tab.value || "all"}
                type="button"
                onClick={() => setTemperature(tab.value)}
                className={`rounded-xl border px-4 py-2 text-sm font-bold transition ${
                  active
                    ? "border-pink bg-pink/10 text-white"
                    : "border-gray-700 bg-gray-900 text-gray-400 hover:text-white"
                }`}
              >
                {tab.label}
                <span className="mr-1.5 text-xs text-gray-500">
                  ({count})
                </span>
              </button>
            );
          })}
        </nav>

        {loading ? (
          <div className="py-16 text-center text-gray-500">טוען...</div>
        ) : leads.length === 0 ? (
          <div className="rounded-2xl border border-gray-700 bg-gray-900 py-16 text-center text-gray-500">
            אין כרגע לידים לטיפול.
          </div>
        ) : (
          <div className="space-y-3">
            {leads
              .filter(
                (lead) =>
                  temperature === "" || lead.intentLevel === temperature,
              )
              .map((lead) => {
              const displayName = lead.displayName;
              const sla = lead.responseSla;
              return (
                <article
                  id={`lead-${lead.id}`}
                  key={lead.id}
                  className={`rounded-2xl border bg-gray-900 p-4 transition ${
                    focusId === lead.id
                      ? "border-pink ring-2 ring-pink/30"
                      : "border-gray-700"
                  }`}
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 space-y-3">
                      <LeadSourceBadge
                        intentLevel={lead.intentLevel}
                        sourceKey={lead.sourceKey}
                        sourceLabel={lead.sourceLabel}
                        sourceContext={lead.sourceContext}
                      />
                      <div>
                        <h2 className="text-lg font-bold text-white">
                          {displayName}
                        </h2>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-400">
                          {lead.service && <span>{lead.service}</span>}
                          <span>
                            נוצר לפני {sla?.elapsedMinutes ?? 0} דקות
                          </span>
                          {lead.owner && (
                            <span>בטיפול: {lead.owner.name}</span>
                          )}
                        </div>
                      </div>
                      {lead.message && (
                        <p className="max-w-3xl rounded-xl bg-gray-800 p-3 text-sm text-gray-300">
                          {lead.message}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      {sla && (
                        <span
                          className={`rounded-xl border px-3 py-2 text-xs font-bold ${slaStyles[sla.state]}`}
                        >
                          {slaLabels[sla.state]} · יעד {sla.thresholdMinutes} דק׳
                        </span>
                      )}
                      {lead.capabilities.canClaim ? (
                        <button
                          type="button"
                          disabled={busyId === lead.id}
                          onClick={() => claim(lead)}
                          className="rounded-xl bg-pink px-4 py-2.5 text-sm font-bold text-white transition hover:bg-pink-dark disabled:opacity-50"
                        >
                          {busyId === lead.id
                            ? "לוקח..."
                            : "קח ליד והצג פרטי פנייה"}
                        </button>
                      ) : lead.owner ? (
                        <Link
                          href={`/seller/leads/${encodeURIComponent(lead.id)}?tab=preparation`}
                          className="rounded-xl bg-pink px-4 py-2.5 text-sm font-bold text-white transition hover:bg-pink-dark"
                        >
                          הצג פרטי פנייה
                        </Link>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-800 pt-4">
                    {lead.phone ? (
                      <>
                        <bdi
                          dir="ltr"
                          className="rounded-xl border border-gray-700 px-3 py-2 text-sm text-gray-300"
                        >
                          {lead.phone}
                        </bdi>
                        {lead.capabilities.canContact &&
                          !lead.doNotContactAt && (
                            <button
                              type="button"
                              onClick={() => copyPhone(lead.phone!)}
                              className="rounded-xl bg-cyan/20 px-3 py-2 text-sm font-bold text-cyan"
                            >
                              העתק טלפון
                            </button>
                          )}
                      </>
                    ) : (
                      <span className="rounded-xl border border-gray-700 px-3 py-2 text-sm text-gray-400">
                        אין טלפון
                      </span>
                    )}
                    {lead.email &&
                      lead.capabilities.canContact &&
                      !lead.doNotContactAt && (
                        <a
                          href={`mailto:${lead.email}`}
                          className="rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm font-bold text-cyan"
                        >
                          {lead.email}
                        </a>
                      )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {!loading && nextCursor && (
          <button
            type="button"
            disabled={loadingMore}
            onClick={loadMore}
            className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-sm font-bold text-cyan transition hover:border-cyan/40 disabled:opacity-50"
          >
            {loadingMore ? "טוען..." : "טען עוד"}
          </button>
        )}
      </div>

      <Modal
        isOpen={copyFallback !== null}
        onClose={() => setCopyFallback(null)}
        title="העתקת מספר הטלפון"
      >
        <input
          ref={copyFallbackInput}
          value={copyFallback ?? ""}
          readOnly
          dir="ltr"
          onFocus={(event) => event.currentTarget.select()}
          className="w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-3 text-white outline-none focus:border-pink"
        />
      </Modal>
    </PullToRefresh>
  );
}
