"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

import CallOutcomeSheet from "@/components/seller/CallOutcomeSheet";
import ColdLeadCard from "@/components/seller/LegacyColdLeadCard";
import type {
  SellerColdLead,
  SellerCompanyNote,
  SellerLeadInteractionInput,
} from "@/components/seller/cold-lead-types";

interface ColdLeadResponse {
  batch: {
    id: string;
    weekStart: string;
    territory: string;
    target: number;
    total: number;
    completed: number;
  } | null;
  current: SellerColdLead[];
  followUps: SellerColdLead[];
  focusState?: "none" | "found" | "not_found";
}

export default function LegacyColdLeadsPage() {
  const router = useRouter();
  const [data, setData] = useState<ColdLeadResponse>({
    batch: null,
    current: [],
    followUps: [],
    focusState: "none",
  });
  const [tab, setTab] = useState<"current" | "followUps">("current");
  const [selected, setSelected] = useState<SellerColdLead | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [openCompanyNotes, setOpenCompanyNotes] = useState<Set<string>>(
    new Set(),
  );
  const [companyNotesByLead, setCompanyNotesByLead] = useState<
    Record<string, SellerCompanyNote[]>
  >({});
  const [companyNotesLoading, setCompanyNotesLoading] = useState<Set<string>>(
    new Set(),
  );
  const [companyNoteDrafts, setCompanyNoteDrafts] = useState<
    Record<string, string>
  >({});
  const [companyNoteBusy, setCompanyNoteBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const focus = new URLSearchParams(window.location.search).get("focus");
      setFocusId(focus);
      const params = new URLSearchParams();
      if (focus) params.set("focus", focus);
      const response = await fetch(
        `/api/seller/cold-leads${params.size ? `?${params.toString()}` : ""}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error();
      setData(await response.json());
    } catch {
      toast.error("שגיאה בטעינת הלידים הקרים");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!focusId || loading) return;
    const inFollowUps = data.followUps.some(
      (lead) => (lead.leadId ?? lead.id) === focusId,
    );
    const exists =
      inFollowUps ||
      data.current.some((lead) => (lead.leadId ?? lead.id) === focusId);
    if (!exists) return;
    if (inFollowUps) setTab("followUps");
    requestAnimationFrame(() => {
      document
        .getElementById(`lead-${focusId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [data, focusId, loading]);

  const saveOutcome = async (input: SellerLeadInteractionInput) => {
    if (!selected) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/seller/cold-leads/${selected.id}/interactions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!response.ok) throw new Error();
      toast.success(input.outcome === "INTERESTED" ? "מעולה — הליד מוכן להעברה" : "תוצאת השיחה נשמרה");
      setSelected(null);
      await load();
    } catch {
      toast.error("שמירת השיחה נכשלה");
    } finally {
      setBusy(false);
    }
  };

  const promote = async (lead: SellerColdLead) => {
    setPromotingId(lead.id);
    try {
      const response = await fetch(`/api/seller/cold-leads/${lead.id}/promote`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "העברת הליד נכשלה");
      toast.success("הליד מוכן להכנת חוזה");
      router.push(
        `/seller/agreements/new?leadId=${encodeURIComponent(result.leadId)}`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "העברת הליד נכשלה");
    } finally {
      setPromotingId(null);
    }
  };

  const loadCompanyNotes = async (leadId: string) => {
    setCompanyNotesLoading((current) => new Set(current).add(leadId));
    try {
      const response = await fetch(`/api/seller/leads/${leadId}/notes`, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error();
      const payload = (await response.json()) as {
        notes?: SellerCompanyNote[];
      };
      setCompanyNotesByLead((current) => ({
        ...current,
        [leadId]: payload.notes ?? [],
      }));
    } catch {
      toast.error("שגיאה בטעינת הערות החברה");
    } finally {
      setCompanyNotesLoading((current) => {
        const next = new Set(current);
        next.delete(leadId);
        return next;
      });
    }
  };

  const toggleCompanyNotes = async (lead: SellerColdLead) => {
    const leadId = lead.leadId;
    if (!leadId || !lead.canManageCompanyNotes) return;
    const opening = !openCompanyNotes.has(leadId);
    setOpenCompanyNotes((current) => {
      const next = new Set(current);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
    if (opening && companyNotesByLead[leadId] === undefined) {
      await loadCompanyNotes(leadId);
    }
  };

  const addCompanyNote = async (lead: SellerColdLead) => {
    const leadId = lead.leadId;
    const body = leadId ? (companyNoteDrafts[leadId] ?? "").trim() : "";
    if (!leadId || !lead.canManageCompanyNotes || !body) return;

    setCompanyNoteBusy(leadId);
    try {
      const response = await fetch(`/api/seller/leads/${leadId}/notes`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!response.ok) throw new Error();
      setCompanyNoteDrafts((current) => ({ ...current, [leadId]: "" }));
      await Promise.all([loadCompanyNotes(leadId), load()]);
      toast.success("ההערה נוספה להיסטוריית החברה");
    } catch {
      toast.error("שמירת הערת החברה נכשלה");
    } finally {
      setCompanyNoteBusy(null);
    }
  };

  const leads = tab === "current" ? data.current : data.followUps;
  const progress = data.batch ? Math.min(100, (data.batch.completed / Math.max(data.batch.target, 1)) * 100) : 0;

  return (
    <div dir="rtl" className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">הלידים הקרים שלי</h1>
          <p className="mt-1 text-sm text-gray-400">
            {data.batch ? `${data.batch.territory} · שבוע ${new Date(data.batch.weekStart).toLocaleDateString("he-IL")}` : "הרשימה השבועית תופיע כאן"}
          </p>
        </div>
        <button type="button" onClick={load} className="w-fit rounded-xl border border-gray-700 px-3 py-2 text-sm text-gray-400 hover:text-white">
          רענן
        </button>
      </header>

      {data.batch && (
        <section className="rounded-2xl border border-gray-700 bg-gray-900 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">התקדמות שבועית</span>
            <span className="font-bold text-white">{data.batch.completed}/{data.batch.target}</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-800">
            <div className="h-full rounded-full bg-gradient-to-l from-pink to-cyan" style={{ width: `${progress}%` }} />
          </div>
        </section>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTab("current")}
          className={`rounded-xl px-4 py-2 text-sm font-bold ${tab === "current" ? "bg-pink text-white" : "bg-gray-800 text-gray-400"}`}
        >
          השבוע ({data.current.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("followUps")}
          className={`rounded-xl px-4 py-2 text-sm font-bold ${tab === "followUps" ? "bg-pink text-white" : "bg-gray-800 text-gray-400"}`}
        >
          חזרות להיום ({data.followUps.length})
        </button>
      </div>

      {focusId && data.focusState === "not_found" && !loading && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
          הליד שבקישור לא נמצא ברשימה שלך או שאינו זמין יותר.
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-sm text-gray-500">טוען...</div>
      ) : leads.length === 0 ? (
        <div className="rounded-2xl border border-gray-700 bg-gray-900 py-16 text-center text-sm text-gray-500">
          {tab === "current" ? "אין לידים פעילים ברשימה" : "אין שיחות חזרה להיום"}
        </div>
      ) : (
        <div className="space-y-3">
          {leads.map((lead) => (
            <div
              id={`lead-${lead.leadId ?? lead.id}`}
              key={lead.id}
              className={
                focusId === (lead.leadId ?? lead.id)
                  ? "rounded-2xl ring-2 ring-pink/40"
                  : ""
              }
            >
              <ColdLeadCard
                lead={lead}
                onOutcome={() => setSelected(lead)}
                onPromote={() => promote(lead)}
                onRetry={load}
                companyNotes={
                  lead.leadId
                    ? companyNotesByLead[lead.leadId] ?? []
                    : []
                }
                companyNotesOpen={
                  Boolean(lead.leadId) &&
                  openCompanyNotes.has(lead.leadId!)
                }
                companyNotesLoading={
                  Boolean(lead.leadId) &&
                  companyNotesLoading.has(lead.leadId!)
                }
                companyNoteDraft={
                  lead.leadId ? companyNoteDrafts[lead.leadId] ?? "" : ""
                }
                companyNoteBusy={
                  Boolean(lead.leadId) &&
                  companyNoteBusy === lead.leadId
                }
                onToggleCompanyNotes={() => void toggleCompanyNotes(lead)}
                onCompanyNoteDraftChange={(value) => {
                  if (!lead.leadId) return;
                  setCompanyNoteDrafts((current) => ({
                    ...current,
                    [lead.leadId!]: value,
                  }));
                }}
                onAddCompanyNote={() => void addCompanyNote(lead)}
                promoting={promotingId === lead.id}
              />
            </div>
          ))}
        </div>
      )}

      {selected && (
        <CallOutcomeSheet
          lead={selected}
          busy={busy}
          onClose={() => setSelected(null)}
          onSubmit={saveOutcome}
        />
      )}
    </div>
  );
}
