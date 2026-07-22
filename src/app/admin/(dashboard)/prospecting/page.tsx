"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import CycleProgress from "@/components/admin/prospecting/CycleProgress";
import ProposalCard from "@/components/admin/prospecting/ProposalCard";
import ProspectTable from "@/components/admin/prospecting/ProspectTable";
import type {
  ProspectingCycleView,
  ProspectView,
} from "@/components/admin/prospecting/types";

interface Settings {
  environmentEnabled: boolean;
  sellerId: string | null;
  weeklyTarget: number;
  adminKillSwitch: boolean;
  sellers: Array<{ id: string; name: string; email: string }>;
}

function withCounts(cycle: ProspectingCycleView): ProspectingCycleView {
  const prospects = cycle.prospects ?? [];
  return {
    ...cycle,
    prospectCounts: prospects.reduce<Record<string, number>>((counts, prospect) => {
      counts[prospect.status] = (counts[prospect.status] ?? 0) + 1;
      return counts;
    }, {}),
  };
}

export default function ProspectingAdminPage() {
  const [cycles, setCycles] = useState<ProspectingCycleView[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedCycle, setSelectedCycle] = useState<ProspectingCycleView | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const loadCycles = useCallback(async () => {
    const response = await fetch("/api/prospecting/cycles", { cache: "no-store" });
    if (!response.ok) throw new Error("טעינת המחזורים נכשלה");
    const data = await response.json();
    const nextCycles = (data.cycles ?? []) as ProspectingCycleView[];
    setCycles(nextCycles);
    setSelectedId((current) => {
      if (current && nextCycles.some((cycle) => cycle.id === current)) return current;
      const proposalId = new URLSearchParams(window.location.search).get("proposal");
      return (
        nextCycles.find((cycle) => cycle.proposals.some((proposal) => proposal.id === proposalId))?.id ??
        nextCycles[0]?.id ??
        null
      );
    });
  }, []);

  const loadSettings = useCallback(async () => {
    const response = await fetch("/api/prospecting/settings", { cache: "no-store" });
    if (!response.ok) throw new Error("טעינת ההגדרות נכשלה");
    setSettings(await response.json());
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadCycles(), loadSettings()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "שגיאה בטעינת המערכת");
    } finally {
      setLoading(false);
    }
  }, [loadCycles, loadSettings]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedCycle(null);
      return;
    }
    let active = true;
    fetch(`/api/prospecting/cycles/${selectedId}`, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((data) => {
        if (active) setSelectedCycle(withCounts(data.cycle));
      })
      .catch(() => {
        if (active) toast.error("טעינת פרטי המחזור נכשלה");
      });
    return () => {
      active = false;
    };
  }, [selectedId]);

  const pendingProposal = useMemo(
    () => selectedCycle?.proposals.find((proposal) => proposal.status === "PROPOSED") ?? null,
    [selectedCycle],
  );

  const mutate = async (url: string, body?: unknown) => {
    setBusy(true);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "הפעולה נכשלה");
      await loadCycles();
      if (selectedId) {
        const detail = await fetch(`/api/prospecting/cycles/${selectedId}`, { cache: "no-store" });
        if (detail.ok) setSelectedCycle(withCounts((await detail.json()).cycle));
      }
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "הפעולה נכשלה");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveSettings = async () => {
    if (!settings?.sellerId) {
      toast.error("יש לבחור מוכר");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/prospecting/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sellerId: settings.sellerId,
          weeklyTarget: settings.weeklyTarget,
          adminKillSwitch: settings.adminKillSwitch,
        }),
      });
      if (!response.ok) throw new Error();
      toast.success("ההגדרות נשמרו");
    } catch {
      toast.error("שמירת ההגדרות נכשלה");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="py-20 text-center text-sm text-gray-500">טוען מערכת לידים קרים...</div>;
  }

  return (
    <div dir="rtl" className="space-y-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">לידים קרים שבועיים</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-400">
            המערכת מציעה אזור, ממתינה לאישור, בודקת את העסקים ומעבירה למוכר עד 50 לידים
            מדורגים. המוכר אינו מעורב בסינון.
          </p>
        </div>
        <span
          className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${
            !settings?.environmentEnabled || settings?.adminKillSwitch
              ? "bg-red-500/15 text-red-300"
              : "bg-green-500/15 text-green-300"
          }`}
        >
          {!settings?.environmentEnabled
            ? "הפיצ׳ר כבוי ב-environment"
            : settings.adminKillSwitch
              ? "האוטומציה עצורה"
              : "האוטומציה פעילה"}
        </span>
      </header>

      {settings && (
        <section className="rounded-2xl border border-gray-700 bg-gray-900 p-5">
          <div className="grid gap-4 md:grid-cols-[1fr_160px_auto] md:items-end">
            <label className="space-y-2 text-sm text-gray-300">
              <span>מוכר שמקבל את הרשימה</span>
              <select
                value={settings.sellerId ?? ""}
                onChange={(event) => setSettings({ ...settings, sellerId: event.target.value })}
                className="w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2.5 text-white outline-none focus:border-pink"
              >
                <option value="">בחר מוכר</option>
                {settings.sellers.map((seller) => (
                  <option key={seller.id} value={seller.id}>
                    {seller.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-2 text-sm text-gray-300">
              <span>לידים בשבוע</span>
              <input
                type="number"
                min={1}
                max={50}
                value={settings.weeklyTarget}
                onChange={(event) =>
                  setSettings({ ...settings, weeklyTarget: Number(event.target.value) })
                }
                className="w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2.5 text-white outline-none focus:border-pink"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  setSettings({ ...settings, adminKillSwitch: !settings.adminKillSwitch })
                }
                className={`rounded-xl border px-4 py-2.5 text-sm font-bold ${
                  settings.adminKillSwitch
                    ? "border-green-500/40 text-green-300"
                    : "border-red-500/40 text-red-300"
                }`}
              >
                {settings.adminKillSwitch ? "אפשר אוטומציה" : "עצור אוטומציה"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={saveSettings}
                className="rounded-xl bg-pink px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                שמור
              </button>
            </div>
          </div>
        </section>
      )}

      {pendingProposal && (
        <ProposalCard
          proposal={pendingProposal}
          busy={busy}
          onApprove={async () => {
            if (await mutate(`/api/prospecting/proposals/${pendingProposal.id}/approve`)) {
              toast.success("האזור אושר והסריקה נכנסה לתור");
            }
          }}
          onReject={async () => {
            const reason = window.prompt("למה לדחות את האזור? תיווצר הצעה חלופית.");
            if (!reason) return;
            if (await mutate(`/api/prospecting/proposals/${pendingProposal.id}/reject`, { reason })) {
              toast.success("האזור נדחה ונוצרה הצעה חלופית");
            }
          }}
        />
      )}

      <div className="grid gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="space-y-2">
          <h2 className="px-1 text-xs font-bold text-gray-500">מחזורים</h2>
          {cycles.length === 0 ? (
            <div className="rounded-2xl border border-gray-700 bg-gray-900 p-5 text-sm text-gray-500">
              המחזור הראשון ייווצר ביום ראשון אחרי הפעלת הפיצ׳ר.
            </div>
          ) : (
            cycles.map((cycle) => (
              <button
                type="button"
                key={cycle.id}
                onClick={() => setSelectedId(cycle.id)}
                className={`w-full rounded-xl border p-3 text-right transition ${
                  cycle.id === selectedId
                    ? "border-pink/50 bg-pink/10"
                    : "border-gray-700 bg-gray-900 hover:border-gray-600"
                }`}
              >
                <div className="text-sm font-bold text-white">
                  {new Date(cycle.weekStart).toLocaleDateString("he-IL")}
                </div>
                <div className="mt-1 text-xs text-gray-500">{cycle.status}</div>
              </button>
            ))
          )}
        </aside>

        <main className="min-w-0 space-y-5">
          {selectedCycle ? (
            <>
              <CycleProgress cycle={selectedCycle} />
              <div className="flex flex-wrap justify-end gap-2">
                {selectedCycle.status === "FAILED" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => mutate(`/api/prospecting/cycles/${selectedCycle.id}/retry`)}
                    className="rounded-xl bg-cyan/15 px-4 py-2 text-sm font-bold text-cyan disabled:opacity-50"
                  >
                    נסה שוב
                  </button>
                )}
                {!(["PUBLISHED", "CANCELLED"] as string[]).includes(selectedCycle.status) && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      if (!window.confirm("לבטל את המחזור הנוכחי?")) return;
                      await mutate(`/api/prospecting/cycles/${selectedCycle.id}/cancel`);
                    }}
                    className="rounded-xl border border-red-500/30 px-4 py-2 text-sm text-red-300 disabled:opacity-50"
                  >
                    בטל מחזור
                  </button>
                )}
              </div>
              <ProspectTable prospects={(selectedCycle.prospects ?? []) as ProspectView[]} />
            </>
          ) : (
            <div className="rounded-2xl border border-gray-700 bg-gray-900 p-12 text-center text-sm text-gray-500">
              אין מחזור להצגה
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
