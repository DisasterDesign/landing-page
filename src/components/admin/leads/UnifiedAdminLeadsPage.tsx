"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  });
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    setFilters(filtersFromParams(new URLSearchParams(query)));
  }, [query]);

  const load = useCallback(
    async (cursor?: string) => {
      const params = new URLSearchParams(query);
      params.set("limit", "50");
      if (cursor) params.set("cursor", cursor);
      else params.delete("cursor");
      // Headline metrics describe the WHOLE business — the temperature tab
      // filters only the list below. Strip `intent` from the analytics call
      // so switching tabs never zeroes the funnel and summary cards.
      const metricsParams = new URLSearchParams(params);
      metricsParams.delete("intent");
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
    router.replace(`/admin/leads?${paramsFromFilters(filters).toString()}`);
  }

  function resetFilters() {
    setFilters(emptyAdminLeadFilters);
    router.replace("/admin/leads");
  }

  return (
    <PullToRefresh onRefresh={() => load()}>
      <div dir="rtl" className="space-y-5">
        <header>
          <h1 className="text-2xl font-bold text-white">לידים — CRM מאוחד</h1>
          <p className="mt-1 text-sm text-gray-400">
            מוצגים לידים פתוחים בלבד — מה שנכנס וטרם טופל. סגורים (שולם / לא
            נסגר / ספאם) דרך סינון השלב.
          </p>
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
                  const next = { ...filters, intent: value };
                  setFilters(next);
                  router.replace(
                    `/admin/leads?${paramsFromFilters(next).toString()}`,
                  );
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

        <LeadMetrics metrics={metrics} />

        <LeadFilters
          values={filters}
          sellers={sellers}
          onChange={setFilters}
          onApply={applyFilters}
          onReset={resetFilters}
        />

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
      </div>
    </PullToRefresh>
  );
}
