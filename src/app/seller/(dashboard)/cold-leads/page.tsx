"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

import CallOutcomeSheet from "@/components/seller/CallOutcomeSheet";
import ColdLeadCard from "@/components/seller/ColdLeadCard";
import type { SellerColdLead } from "@/components/seller/cold-lead-types";

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
}

export default function SellerColdLeadsPage() {
  const router = useRouter();
  const [data, setData] = useState<ColdLeadResponse>({ batch: null, current: [], followUps: [] });
  const [tab, setTab] = useState<"current" | "followUps">("current");
  const [selected, setSelected] = useState<SellerColdLead | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [promotingId, setPromotingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/seller/cold-leads", { cache: "no-store" });
      if (!response.ok) throw new Error();
      setData(await response.json());
    } catch {
      toast.error("שגיאה בטעינת הלידים הקרים");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveOutcome = async (input: { outcome: string; note?: string; nextFollowUpAt?: string }) => {
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
      toast.success("הליד הועבר למסלול המכירה הרגיל");
      router.push(`/seller/leads?focus=${result.leadId}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "העברת הליד נכשלה");
    } finally {
      setPromotingId(null);
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

      {loading ? (
        <div className="py-16 text-center text-sm text-gray-500">טוען...</div>
      ) : leads.length === 0 ? (
        <div className="rounded-2xl border border-gray-700 bg-gray-900 py-16 text-center text-sm text-gray-500">
          {tab === "current" ? "אין לידים פעילים ברשימה" : "אין שיחות חזרה להיום"}
        </div>
      ) : (
        <div className="space-y-3">
          {leads.map((lead) => (
            <ColdLeadCard
              key={lead.id}
              lead={lead}
              onOutcome={() => setSelected(lead)}
              onPromote={() => promote(lead)}
              promoting={promotingId === lead.id}
            />
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
