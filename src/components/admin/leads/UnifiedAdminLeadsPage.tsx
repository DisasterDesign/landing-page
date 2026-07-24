"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";

import { LEAD_TEMPERATURES } from "@/components/leads/LeadSourceBadge";
import PullToRefresh from "@/components/ui/PullToRefresh";
import type {
  LeadMetrics as LeadMetricsValue,
} from "@/lib/leads/analytics";
import { adminDateInputValue } from "@/lib/leads/admin-filter-ui";
import type { LeadDetail } from "@/lib/leads/projection";

import LeadFilters, {
  emptyAdminLeadFilters,
  type AdminLeadFilterValues,
} from "./LeadFilters";
import LeadMetrics from "./LeadMetrics";
import LeadTable from "./LeadTable";

function filtersFromParams(
  params: URLSearchParams,
): AdminLeadFilterValues {
  return Object.fromEntries(
    Object.keys(emptyAdminLeadFilters).map((key) => [
      key,
      key === "from" || key === "to"
        ? adminDateInputValue(params.get(key))
        : params.get(key) ??
          emptyAdminLeadFilters[key as keyof AdminLeadFilterValues],
    ]),
  ) as unknown as AdminLeadFilterValues;
}

function paramsFromFilters(values: AdminLeadFilterValues) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (!value || (key === "dateField" && value === "createdAt")) continue;
    if (key === "from") {
      params.set(key, new Date(`${value}T00:00:00`).toISOString());
    } else if (key === "to") {
      params.set(key, new Date(`${value}T23:59:59.999`).toISOString());
    } else {
      params.set(key, value);
    }
  }
  params.set("limit", "50");
  return params;
}

export default function UnifiedAdminLeadsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const [filters, setFilters] = useState<AdminLeadFilterValues>(() =>
    filtersFromParams(new URLSearchParams(query)),
  );
  const [leads, setLeads] = useState<LeadDetail[]>([]);
  const [sellers, setSellers] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [metrics, setMetrics] = useState<LeadMetricsValue | null>(null);
  const [stats, setStats] = useState({
    openCount: 0,
    dueThisWeekCount: 0,
    newThisWeekCount: 0,
    openByIntent: { OUTBOUND: 0, AD_RESPONSE: 0, INBOUND: 0 },
    byStageGroup: {
      NEW: 0,
      IN_PROGRESS: 0,
      WON: 0,
      LOST: 0,
      SPAM: 0,
      ALL: 0,
      OPEN: 0,
    },
  });
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    setFilters(filtersFromParams(new URLSearchParams(query)));
  }, [query]);

  const load = useCallback(
    async (cursor?: string) => {
      const params = new URLSearchParams(query);
      params.set("limit", "50");
      if (cursor) params.set("cursor", cursor);
      else params.delete("cursor");
      // Headline metrics describe the WHOLE business — the source tab and
      // status bar filter only the list below. Strip `intent` AND the stage
      // selection from the analytics call: the funnel is attainment-based
      // (all-time), and filtering it by CURRENT stage (stageGroup=NEW is the
      // automatic state inside every source tab) zeroes every milestone.
      const metricsParams = new URLSearchParams(params);
      metricsParams.delete("intent");
      metricsParams.delete("stageGroup");
      metricsParams.delete("stage");
      try {
        const [leadsResponse, metricsResponse] = await Promise.all([
          fetch(`/api/leads?${params.toString()}`, { cache: "no-store" }),
          cursor
            ? Promise.resolve(null)
            : fetch(`/api/leads/analytics?${metricsParams.toString()}`, {
                cache: "no-store",
              }),
        ]);
        if (!leadsResponse.ok) throw new Error();
        const payload = (await leadsResponse.json()) as {
          leads: LeadDetail[];
          nextCursor: string | null;
          stats: typeof stats;
        };
        setLeads((current) =>
          cursor ? [...current, ...payload.leads] : payload.leads,
        );
        setNextCursor(payload.nextCursor);
        setStats(payload.stats);
        if (metricsResponse?.ok) {
          setMetrics(
            ((await metricsResponse.json()) as {
              metrics: LeadMetricsValue;
            }).metrics,
          );
        } else if (metricsResponse) {
          // A silent failure here leaves the funnel as an eternal skeleton —
          // that is how the stageGroup leak went unnoticed. Say it out loud.
          toast.error("שגיאה בטעינת מדדי המשפך");
        }
      } catch {
        toast.error("שגיאה בטעינת ה־CRM");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [query],
  );

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  // Ported from the legacy admin leads page: manual + on-mount silent pull
  // of Meta Lead Ads via POST /api/integrations/facebook/sync.
  const syncFromFacebook = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent ?? false;
      setSyncing(true);
      try {
        const response = await fetch("/api/integrations/facebook/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const payload = (await response.json()) as {
          error?: string;
          created: number;
          updated: number;
          skipped: number;
          total: number;
        };
        if (!response.ok) throw new Error(payload.error || "sync failed");
        if (!silent) {
          toast.success(
            `סנכרון הושלם: ${payload.created} חדשים, ${payload.updated} עודכנו, ${payload.skipped} דולגו (מתוך ${payload.total})`,
            { duration: 8000 },
          );
        } else if (payload.created > 0) {
          toast.success(`${payload.created} לידים חדשים מפייסבוק`, {
            duration: 4000,
          });
        }
        await load();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "שגיאה בסנכרון",
          opts?.silent ? { duration: 3000 } : undefined,
        );
      } finally {
        setSyncing(false);
      }
    },
    [load],
  );

  const autoSyncedRef = useRef(false);
  useEffect(() => {
    if (autoSyncedRef.current) return;
    autoSyncedRef.current = true;
    void syncFromFacebook({ silent: true });
  }, [syncFromFacebook]);

  useEffect(() => {
    void fetch("/api/users", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : []))
      .then(
        (
          users: Array<{
            id: string;
            name: string;
            role: string;
          }>,
        ) =>
          setSellers(
            users
              .filter((user) => user.role === "SELLER")
              .map(({ id, name }) => ({ id, name })),
          ),
      )
      .catch(() => undefined);
  }, []);

  const totalOpen = useMemo(
    () =>
      Object.values(stats.openByIntent).reduce((sum, count) => sum + count, 0),
    [stats.openByIntent],
  );

  const cards = useMemo(
    () => [
      ["לידים פתוחים", totalOpen],
      ["נכנסו השבוע (פייסבוק+אורגני)", stats.newThisWeekCount],
      ["פולואפים השבוע", stats.dueThisWeekCount],
      ["מוצגים", leads.length],
    ] as const,
    [leads.length, stats, totalOpen],
  );

  function applyFilters() {
    const params = paramsFromFilters(filters);
    // Keep the status-bar selection alive across filter/search applies.
    const current = new URLSearchParams(query);
    for (const key of ["stageGroup", "all"]) {
      const value = current.get(key);
      if (value) params.set(key, value);
    }
    router.replace(`/admin/leads?${params.toString()}`);
  }

  function resetFilters() {
    setFilters(emptyAdminLeadFilters);
    router.replace("/admin/leads");
  }

  return (
    <PullToRefresh onRefresh={() => load()}>
      <div dir="rtl" className="space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">לידים — CRM מאוחד</h1>
            <p className="mt-1 text-sm text-gray-400">
              מוצגים לידים פתוחים בלבד — מה שנכנס וטרם טופל. סגורים (שולם / לא
              נסגר / ספאם) דרך סינון השלב.
            </p>
          </div>
          <button
            type="button"
            onClick={() => syncFromFacebook()}
            disabled={syncing}
            className="rounded-xl border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-300 transition-colors hover:border-pink disabled:cursor-not-allowed disabled:opacity-50"
          >
            {syncing ? "מסנכרן..." : "🔄 סנכרן מפייסבוק"}
          </button>
        </header>

        {/* Source first — the salesperson's mental model. */}
        <nav aria-label="סינון לפי מקור" className="flex flex-wrap gap-2">
          {(
            [
              ["", "הכל"],
              ["AD_RESPONSE", `${LEAD_TEMPERATURES.AD_RESPONSE.emoji} פייסבוק`],
              ["OUTBOUND", `${LEAD_TEMPERATURES.OUTBOUND.emoji} גוגל מפות`],
              ["INBOUND", `${LEAD_TEMPERATURES.INBOUND.emoji} אורגני`],
            ] as const
          ).map(([value, label]) => {
            const active = filters.intent === value;
            // OPEN leads only, and ALWAYS global — the counts never change
            // when a tab is selected (openByIntent is computed server-side
            // without the intent filter; "הכל" is their sum, not the
            // filtered openCount, which would zero out inside a tab).
            const count =
              value === "" ? totalOpen : stats.openByIntent[value] ?? 0;
            return (
              <button
                key={value || "all"}
                type="button"
                onClick={() => {
                  setFilters({ ...filters, intent: value });
                  const next = new URLSearchParams(query);
                  if (value) next.set("intent", value);
                  else next.delete("intent");
                  next.delete("cursor");
                  // Entering a SOURCE tab lands on its fresh leads — that is
                  // what a salesperson opens the tab for. "הכל" returns to
                  // the open-leads default.
                  next.delete("all");
                  if (value) next.set("stageGroup", "NEW");
                  else next.delete("stageGroup");
                  router.replace(`/admin/leads?${next.toString()}`);
                }}
                className={`rounded-xl border px-4 py-2 text-sm font-bold transition ${
                  active
                    ? "border-pink bg-pink/10 text-white"
                    : "border-gray-700 bg-gray-900 text-gray-400 hover:text-white"
                }`}
              >
                {label}
                <span className="mr-1.5 text-xs text-gray-500">
                  ({count} פתוחים)
                </span>
              </button>
            );
          })}
        </nav>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {cards.map(([label, value]) => (
            <div
              key={label}
              className="rounded-2xl border border-gray-700 bg-gray-900 p-4"
            >
              <p className="text-xs text-gray-500">{label}</p>
              <p className="mt-1 text-2xl font-bold text-white">
                {value.toLocaleString("he-IL")}
              </p>
            </div>
          ))}
        </div>

        {/* The classic status bar — a lead's life-state at a click. "כל
            הלידים" is the only view that includes closed history. */}
        <nav aria-label="סינון לפי סטטוס" className="flex flex-wrap gap-2">
          {(
            [
              ["OPEN", "פתוחים"],
              ["NEW", "חדשים"],
              ["IN_PROGRESS", "בטיפול"],
              ["WON", "נסגרו ✓"],
              ["LOST", "לא נסגרו"],
              ["SPAM", "ספאם"],
              ["ALL", "כל הלידים"],
            ] as const
          ).map(([value, label]) => {
            const params = new URLSearchParams(query);
            const activeGroup =
              params.get("stageGroup") ??
              (params.get("all") === "true" ? "ALL" : "OPEN");
            const active = activeGroup === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => {
                  const next = new URLSearchParams(query);
                  next.delete("stageGroup");
                  next.delete("all");
                  next.delete("cursor");
                  if (value === "ALL") next.set("all", "true");
                  else if (value !== "OPEN") next.set("stageGroup", value);
                  router.replace(`/admin/leads?${next.toString()}`);
                }}
                className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${
                  active
                    ? "border-cyan bg-cyan/10 text-white"
                    : "border-gray-700 bg-gray-900 text-gray-400 hover:text-white"
                }`}
              >
                {label}
                <span className="mr-1 text-[10px] text-gray-500">
                  ({stats.byStageGroup[value]})
                </span>
              </button>
            );
          })}
        </nav>

        <div className="flex flex-wrap items-center gap-2">
          <input
            value={filters.search}
            onChange={(event) =>
              setFilters({ ...filters, search: event.target.value })
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") applyFilters();
            }}
            placeholder="חיפוש שם, עסק, אימייל או טלפון"
            className="min-w-64 flex-1 rounded-xl border border-gray-700 bg-gray-900 px-4 py-2.5 text-sm text-white outline-none focus:border-pink"
          />
          <button
            type="button"
            onClick={() => setShowAdvancedFilters((value) => !value)}
            className="rounded-xl border border-gray-700 px-4 py-2.5 text-sm text-gray-400 transition hover:text-white"
          >
            {showAdvancedFilters ? "הסתר סינון מתקדם ▴" : "סינון מתקדם ▾"}
          </button>
        </div>

        {showAdvancedFilters && (
          <LeadFilters
            values={filters}
            sellers={sellers}
            onChange={setFilters}
            onApply={applyFilters}
            onReset={resetFilters}
          />
        )}

        {loading ? (
          <div className="rounded-2xl border border-gray-700 bg-gray-900 p-12 text-center text-gray-500">
            טוען לידים...
          </div>
        ) : (
          <LeadTable leads={leads} />
        )}

        {nextCursor && (
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => {
              setLoadingMore(true);
              void load(nextCursor);
            }}
            className="w-full rounded-xl border border-gray-700 bg-gray-900 py-3 text-sm font-bold text-gray-300 hover:border-pink disabled:opacity-50"
          >
            {loadingMore ? "טוען..." : "טען עוד"}
          </button>
        )}

        {/* Strategic, cumulative stats live at the BOTTOM — the top of this
            page is tactical: who to call now. (Elad, 24.7) */}
        <LeadMetrics metrics={metrics} />
      </div>
    </PullToRefresh>
  );
}
