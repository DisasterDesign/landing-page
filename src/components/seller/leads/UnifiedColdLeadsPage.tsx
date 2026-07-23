"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

import ColdLeadCard from "@/components/seller/ColdLeadCard";
import PullToRefresh from "@/components/ui/PullToRefresh";
import type { SellerLeadDetail } from "@/lib/leads/projection";
import { mergeLeadQueueItems } from "@/lib/leads/ui-state";

interface ColdLeadResponse {
  batch: {
    id: string;
    weekStart: string;
    territory: string;
    target: number;
    total: number;
    completed: number;
  } | null;
  current: SellerLeadDetail[];
  followUps: SellerLeadDetail[];
  nextCursor: string | null;
}

export default function UnifiedColdLeadsPage() {
  const router = useRouter();
  const [data, setData] = useState<ColdLeadResponse>({
    batch: null,
    current: [],
    followUps: [],
    nextCursor: null,
  });
  const [tab, setTab] = useState<"current" | "followUps">("current");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/seller/cold-leads", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error();
      setData((await response.json()) as ColdLeadResponse);
    } catch {
      toast.error("שגיאה בטעינת הלידים הקרים");
    } finally {
      setLoading(false);
    }
  }, []);

  async function loadMore() {
    const cursor = data.nextCursor;
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const response = await fetch(
        `/api/seller/cold-leads?cursor=${encodeURIComponent(cursor)}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error();
      const next = (await response.json()) as ColdLeadResponse;
      setData((current) => ({
        batch: next.batch ?? current.batch,
        current: mergeLeadQueueItems(current.current, next.current),
        followUps: mergeLeadQueueItems(current.followUps, next.followUps),
        nextCursor: next.nextCursor,
      }));
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
    const inFollowUps = data.followUps.some((lead) => lead.id === focusId);
    const exists =
      inFollowUps || data.current.some((lead) => lead.id === focusId);
    if (!exists) return;
    if (inFollowUps) setTab("followUps");
    requestAnimationFrame(() => {
      document
        .getElementById(`lead-${focusId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [data, focusId, loading]);

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

  const leads = tab === "current" ? data.current : data.followUps;
  const progress = data.batch
    ? Math.min(
        100,
        (data.batch.completed / Math.max(data.batch.target, 1)) * 100,
      )
    : 0;

  return (
    <PullToRefresh onRefresh={load}>
      <div dir="rtl" className="space-y-5">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">
              הלידים הקרים שלי
            </h1>
            <p className="mt-1 text-sm text-gray-400">
              {data.batch
                ? `${data.batch.territory} · שבוע ${new Date(
                    data.batch.weekStart,
                  ).toLocaleDateString("he-IL")}`
                : "הרשימה השבועית תופיע כאן"}
            </p>
          </div>
          <button
            type="button"
            onClick={load}
            className="w-fit rounded-xl border border-gray-700 px-3 py-2 text-sm text-gray-400 transition hover:text-white"
          >
            רענן
          </button>
        </header>

        {data.batch && (
          <section className="rounded-2xl border border-gray-700 bg-gray-900 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">התקדמות שבועית</span>
              <span className="font-bold text-white">
                {data.batch.completed}/{data.batch.target}
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-800">
              <div
                className="h-full rounded-full bg-gradient-to-l from-pink to-cyan"
                style={{ width: `${progress}%` }}
              />
            </div>
          </section>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setTab("current")}
            className={`rounded-xl px-4 py-2 text-sm font-bold ${
              tab === "current"
                ? "bg-pink text-white"
                : "bg-gray-800 text-gray-400"
            }`}
          >
            השבוע ({data.current.length})
          </button>
          <button
            type="button"
            onClick={() => setTab("followUps")}
            className={`rounded-xl px-4 py-2 text-sm font-bold ${
              tab === "followUps"
                ? "bg-pink text-white"
                : "bg-gray-800 text-gray-400"
            }`}
          >
            פולואפים שהגיע זמנם ({data.followUps.length})
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-gray-500">
            טוען...
          </div>
        ) : leads.length === 0 ? (
          <div className="rounded-2xl border border-gray-700 bg-gray-900 py-16 text-center text-sm text-gray-500">
            {tab === "current"
              ? "אין לידים פעילים ברשימה"
              : "אין פולואפים שהגיע זמנם"}
          </div>
        ) : (
          <div className="space-y-3">
            {leads.map((lead) => (
              <ColdLeadCard
                key={lead.id}
                lead={lead}
                busy={busyId === lead.id}
                highlighted={focusId === lead.id}
                onClaim={claim}
              />
            ))}
          </div>
        )}

        {!loading && data.nextCursor && (
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
    </PullToRefresh>
  );
}
