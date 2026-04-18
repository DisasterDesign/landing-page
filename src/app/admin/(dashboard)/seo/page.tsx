"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface IntegrationInfo {
  email: string | null;
  gscSiteUrl: string | null;
  ga4PropertyId: string | null;
  expiresAt: string;
  createdAt: string;
}

interface StatusResponse {
  oauthConfigured: boolean;
  connected: boolean;
  integration: IntegrationInfo | null;
}

interface GscSite {
  siteUrl: string;
  permissionLevel: string;
}
interface Ga4Property {
  propertyId: string;
  displayName: string;
}

interface Snapshot {
  date: string;
  totalClicks: number;
  totalImpressions: number;
  avgCtr: number;
  avgPosition: number;
}

interface QueryRow {
  id: string;
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  topPage: string | null;
}

interface PageRow {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

function nf(n: number, digits = 0): string {
  return n.toLocaleString("he-IL", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function shortPath(url: string, max = 40): string {
  try {
    const u = new URL(url);
    const p = u.pathname || "/";
    return p.length > max ? p.slice(0, max - 1) + "…" : p;
  } catch {
    return url.length > max ? url.slice(0, max - 1) + "…" : url;
  }
}

function deltaText(now: number, prev: number): { text: string; positive: boolean } {
  if (prev === 0) {
    return { text: now > 0 ? "+∞" : "0%", positive: now >= 0 };
  }
  const pctChange = ((now - prev) / prev) * 100;
  const sign = pctChange >= 0 ? "+" : "";
  return { text: `${sign}${pctChange.toFixed(1)}%`, positive: pctChange >= 0 };
}

export default function SeoPage() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Site picker state
  const [sites, setSites] = useState<{ gscSites: GscSite[]; ga4Properties: Ga4Property[] } | null>(
    null
  );
  const [loadingSites, setLoadingSites] = useState(false);
  const [selectedSite, setSelectedSite] = useState("");
  const [selectedProperty, setSelectedProperty] = useState("");
  const [savingConfig, setSavingConfig] = useState(false);

  // Dashboard state
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [topQueries, setTopQueries] = useState<QueryRow[]>([]);
  const [topPages, setTopPages] = useState<PageRow[]>([]);
  const [loadingDashboard, setLoadingDashboard] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/seo/status", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = (await res.json()) as StatusResponse;
      setStatus(data);
    } catch {
      toast.error("שגיאה בטעינת המצב");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSites = useCallback(async () => {
    setLoadingSites(true);
    try {
      const res = await fetch("/api/seo/sites", { cache: "no-store" });
      if (!res.ok) throw new Error();
      setSites(await res.json());
    } catch {
      toast.error("שגיאה בטעינת רשימת אתרים");
    } finally {
      setLoadingSites(false);
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoadingDashboard(true);
    try {
      const [snapsRes, queriesRes, pagesRes] = await Promise.all([
        fetch("/api/seo/snapshots?days=90", { cache: "no-store" }),
        fetch("/api/seo/queries?limit=5&sort=clicks&order=desc", { cache: "no-store" }),
        fetch("/api/seo/pages?limit=5&sort=clicks&order=desc", { cache: "no-store" }),
      ]);
      if (snapsRes.ok) setSnapshots((await snapsRes.json()).snapshots ?? []);
      if (queriesRes.ok) setTopQueries((await queriesRes.json()).queries ?? []);
      if (pagesRes.ok) setTopPages((await pagesRes.json()).pages ?? []);
    } catch {
      toast.error("שגיאה בטעינת הדשבורד");
    } finally {
      setLoadingDashboard(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    if (!status) return;
    if (status.connected && !status.integration?.gscSiteUrl) {
      loadSites();
    }
    if (status.connected && status.integration?.gscSiteUrl) {
      loadDashboard();
    }
  }, [status, loadSites, loadDashboard]);

  useEffect(() => {
    if (params.get("connected") === "1") {
      toast.success("חשבון Google חובר בהצלחה");
      router.replace("/admin/seo");
    }
    const err = params.get("error");
    if (err) {
      toast.error(`שגיאת חיבור: ${err}`);
      router.replace("/admin/seo");
    }
  }, [params, router]);

  const handleConnect = () => {
    window.location.href = "/api/seo/connect";
  };

  const handleDisconnect = async () => {
    if (!confirm("לנתק את חשבון Google? הנתונים הקיימים יישמרו אבל לא יתעדכנו.")) return;
    setDisconnecting(true);
    try {
      const res = await fetch("/api/seo/disconnect", { method: "POST" });
      if (!res.ok) throw new Error();
      toast.success("נותק");
      setStatus(null);
      setSnapshots([]);
      setTopQueries([]);
      setTopPages([]);
      await loadStatus();
    } catch {
      toast.error("שגיאה בניתוק");
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!selectedSite || !selectedProperty) {
      toast.error("יש לבחור גם אתר וגם נכס Analytics");
      return;
    }
    setSavingConfig(true);
    try {
      const res = await fetch("/api/seo/configure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gscSiteUrl: selectedSite,
          ga4PropertyId: selectedProperty,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("נשמר. הסנכרון הראשוני יתחיל כעת");
      await loadStatus();
    } catch {
      toast.error("שגיאה בשמירה");
    } finally {
      setSavingConfig(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/seo/refresh", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "סנכרון נכשל");
      } else {
        toast.success(json.message || "הסנכרון הושלם");
        await loadDashboard();
      }
    } catch {
      toast.error("שגיאה בסנכרון");
    } finally {
      setRefreshing(false);
    }
  };

  // ---------- RENDER STATES ----------

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-32 bg-gray-800 rounded animate-pulse" />
        <div className="h-48 bg-gray-900 border border-gray-700 rounded-2xl animate-pulse" />
      </div>
    );
  }

  // 1) Not connected
  if (!status?.connected) {
    return (
      <div dir="rtl" className="space-y-6 max-w-3xl">
        {!status?.oauthConfigured && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-5">
            <h3 className="text-base font-bold text-yellow-300 mb-2">
              מחכה להגדרת מפתחות Google
            </h3>
            <p className="text-sm text-gray-300 leading-relaxed">
              המנהל צריך להגדיר את משתני הסביבה{" "}
              <code className="bg-gray-800 px-1.5 py-0.5 rounded text-xs">
                GOOGLE_CLIENT_ID
              </code>
              ,{" "}
              <code className="bg-gray-800 px-1.5 py-0.5 rounded text-xs">
                GOOGLE_CLIENT_SECRET
              </code>{" "}
              ו-
              <code className="bg-gray-800 px-1.5 py-0.5 rounded text-xs">
                GOOGLE_REDIRECT_URI
              </code>{" "}
              ב-Vercel.
            </p>
          </div>
        )}

        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 space-y-5">
          <div>
            <h3 className="text-lg font-bold text-white mb-2">חבר חשבון Google</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              נחבר את החשבון שלך ל-Search Console ול-Analytics — בקריאה בלבד.
            </p>
          </div>
          <ul className="space-y-2 text-sm text-gray-300">
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan" />
              מילות החיפוש שמובילות אנשים לאתר שלך
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan" />
              דפים שמקבלים הכי הרבה תנועה אורגנית
            </li>
            <li className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan" />
              קישורים נכנסים מאתרים חיצוניים
            </li>
          </ul>
          <button
            onClick={handleConnect}
            disabled={!status?.oauthConfigured}
            className="inline-flex items-center gap-2 px-5 py-3 bg-pink hover:bg-pink-light disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21.35 11.1H12v3.2h5.35c-.5 2.4-2.6 4.1-5.35 4.1-3.25 0-5.9-2.65-5.9-5.9s2.65-5.9 5.9-5.9c1.5 0 2.85.55 3.9 1.5l2.4-2.3C16.6 4.45 14.45 3.5 12 3.5 7.05 3.5 3 7.55 3 12.5s4.05 9 9 9c5.2 0 8.65-3.65 8.65-8.8 0-.6-.05-1.1-.15-1.6z" />
            </svg>
            חבר חשבון Google
          </button>
        </div>
      </div>
    );
  }

  // 2) Connected but no site picked
  if (!status.integration?.gscSiteUrl) {
    return (
      <div dir="rtl" className="space-y-6 max-w-2xl">
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 space-y-5">
          <div>
            <h3 className="text-lg font-bold text-white mb-1">בחר אתר ונכס</h3>
            <p className="text-sm text-gray-400">
              מחובר כ-{status.integration?.email}. עכשיו בחר את האתר ב-Search Console
              ואת נכס ה-Analytics שתרצה לעקוב אחריהם.
            </p>
          </div>

          {loadingSites ? (
            <div className="h-12 bg-gray-800 rounded animate-pulse" />
          ) : (
            <>
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  אתר ב-Search Console *
                </label>
                <select
                  value={selectedSite}
                  onChange={(e) => setSelectedSite(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-pink"
                >
                  <option value="">בחר אתר…</option>
                  {(sites?.gscSites ?? []).map((s) => (
                    <option key={s.siteUrl} value={s.siteUrl}>
                      {s.siteUrl}
                    </option>
                  ))}
                </select>
                {(sites?.gscSites ?? []).length === 0 && !loadingSites && (
                  <p className="text-xs text-yellow-400 mt-1">
                    אין אתרים זמינים בחשבון Search Console שלך.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  נכס Analytics 4 *
                </label>
                <select
                  value={selectedProperty}
                  onChange={(e) => setSelectedProperty(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-pink"
                >
                  <option value="">בחר נכס…</option>
                  {(sites?.ga4Properties ?? []).map((p) => (
                    <option key={p.propertyId} value={p.propertyId}>
                      {p.displayName}
                    </option>
                  ))}
                </select>
                {(sites?.ga4Properties ?? []).length === 0 && !loadingSites && (
                  <p className="text-xs text-yellow-400 mt-1">
                    אין נכסי Analytics זמינים.
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleSaveConfig}
                  disabled={savingConfig || !selectedSite || !selectedProperty}
                  className="flex-1 bg-pink hover:bg-pink-light disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition-colors"
                >
                  {savingConfig ? "שומר…" : "שמור"}
                </button>
                <button
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="px-4 border border-gray-700 hover:border-gray-600 text-gray-300 rounded-xl"
                >
                  ניתוק
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // 3) Dashboard — fully configured
  const recent28 = snapshots.slice(-28);
  const prior28 = snapshots.slice(-56, -28);
  const sumNow = recent28.reduce(
    (acc, s) => ({
      clicks: acc.clicks + s.totalClicks,
      impressions: acc.impressions + s.totalImpressions,
    }),
    { clicks: 0, impressions: 0 }
  );
  const sumPrev = prior28.reduce(
    (acc, s) => ({
      clicks: acc.clicks + s.totalClicks,
      impressions: acc.impressions + s.totalImpressions,
    }),
    { clicks: 0, impressions: 0 }
  );
  const ctrNow = sumNow.impressions > 0 ? sumNow.clicks / sumNow.impressions : 0;
  const ctrPrev = sumPrev.impressions > 0 ? sumPrev.clicks / sumPrev.impressions : 0;
  const posNow =
    recent28.length > 0
      ? recent28.reduce((a, s) => a + s.avgPosition, 0) / recent28.length
      : 0;
  const posPrev =
    prior28.length > 0
      ? prior28.reduce((a, s) => a + s.avgPosition, 0) / prior28.length
      : 0;
  const clicksDelta = deltaText(sumNow.clicks, sumPrev.clicks);
  const imprDelta = deltaText(sumNow.impressions, sumPrev.impressions);
  const ctrDelta = deltaText(ctrNow, ctrPrev);
  // Lower position = better; invert for color
  const posDeltaRaw = deltaText(posNow, posPrev);
  const posDelta = { text: posDeltaRaw.text, positive: !posDeltaRaw.positive };

  const chartData = snapshots.map((s) => ({
    date: s.date.slice(5, 10), // MM-DD
    clicks: s.totalClicks,
    impressions: s.totalImpressions,
  }));

  const hasData = snapshots.length > 0;

  return (
    <div dir="rtl" className="space-y-6">
      {/* Header bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs text-gray-500">{status.integration.email}</p>
          <p className="text-sm text-gray-300">{status.integration.gscSiteUrl}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="bg-pink hover:bg-pink-light disabled:opacity-50 text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors"
          >
            {refreshing ? "מסנכרן…" : "סנכרן עכשיו"}
          </button>
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="text-xs text-gray-500 hover:text-red-400"
          >
            ניתוק
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="קליקים (28 ימים)"
          value={nf(sumNow.clicks)}
          delta={clicksDelta}
          accent="pink"
        />
        <StatCard
          label="הופעות"
          value={nf(sumNow.impressions)}
          delta={imprDelta}
          accent="cyan"
        />
        <StatCard label="CTR ממוצע" value={pct(ctrNow)} delta={ctrDelta} accent="pink" />
        <StatCard
          label="מיקום ממוצע"
          value={posNow > 0 ? posNow.toFixed(1) : "-"}
          delta={posDelta}
          accent="cyan"
        />
      </div>

      {/* Chart */}
      {hasData ? (
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5">
          <h3 className="text-base font-bold text-white mb-4">מגמה 90 ימים</h3>
          <div style={{ width: "100%", height: 280 }}>
            <ResponsiveContainer>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="clicks-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ec4899" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#ec4899" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="impr-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#01FFFF" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#01FFFF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="date" stroke="#6b7280" tick={{ fontSize: 11 }} reversed />
                <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "#111",
                    border: "1px solid #374151",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "#9ca3af" }}
                />
                <Area
                  type="monotone"
                  dataKey="impressions"
                  stroke="#01FFFF"
                  fill="url(#impr-grad)"
                  name="הופעות"
                  strokeWidth={1.5}
                />
                <Area
                  type="monotone"
                  dataKey="clicks"
                  stroke="#ec4899"
                  fill="url(#clicks-grad)"
                  name="קליקים"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <EmptyDashboard loading={loadingDashboard} />
      )}

      {/* Top tables */}
      {hasData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <TopTable
            title="5 מילים מובילות"
            href="/admin/seo/keywords"
            headers={["מילה", "קליקים", "הופעות", "מיקום"]}
            rows={topQueries.map((q) => [
              q.query,
              nf(q.clicks),
              nf(q.impressions),
              q.position.toFixed(1),
            ])}
          />
          <TopTable
            title="5 דפים מובילים"
            href="/admin/seo/pages"
            headers={["כתובת", "קליקים", "הופעות", "מיקום"]}
            rows={topPages.map((p) => [
              shortPath(p.page, 32),
              nf(p.clicks),
              nf(p.impressions),
              p.position.toFixed(1),
            ])}
          />
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  delta,
  accent,
}: {
  label: string;
  value: string;
  delta: { text: string; positive: boolean };
  accent: "pink" | "cyan";
}) {
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 sm:p-5">
      <p className="text-xs text-gray-500 mb-1.5">{label}</p>
      <p className={`text-2xl sm:text-3xl font-bold ${accent === "pink" ? "text-pink" : "text-cyan"}`}>
        {value}
      </p>
      <p
        className={`text-xs mt-1 ${
          delta.positive ? "text-green-400" : "text-red-400"
        }`}
      >
        {delta.text} מהחלון הקודם
      </p>
    </div>
  );
}

function TopTable({
  title,
  href,
  headers,
  rows,
}: {
  title: string;
  href: string;
  headers: string[];
  rows: (string | number)[][];
}) {
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-bold text-white">{title}</h3>
        <Link
          href={href}
          className="text-xs text-cyan hover:text-cyan/80 underline-offset-2 hover:underline"
        >
          הצג הכל
        </Link>
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500 py-6 text-center">אין נתונים</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-gray-800/50">
            <tr>
              {headers.map((h) => (
                <th key={h} className="text-right text-gray-400 font-medium px-2 py-1.5">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-gray-800 hover:bg-gray-800/30">
                {r.map((c, j) => (
                  <td
                    key={j}
                    className={`px-2 py-1.5 ${j === 0 ? "text-white truncate max-w-[160px]" : "text-gray-300 font-mono"}`}
                  >
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function EmptyDashboard({ loading }: { loading: boolean }) {
  if (loading) {
    return <div className="h-64 bg-gray-900 border border-gray-700 rounded-2xl animate-pulse" />;
  }
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-2xl p-12 text-center">
      <svg
        className="w-12 h-12 mx-auto text-gray-700 mb-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </svg>
      <p className="text-base font-bold text-white mb-2">אין נתונים עדיין</p>
      <p className="text-sm text-gray-500">
        הנתונים יתעדכנו אוטומטית בסנכרון הבא, או לחץ &quot;סנכרן עכשיו&quot;
      </p>
    </div>
  );
}
