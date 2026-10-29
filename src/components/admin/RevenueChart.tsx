"use client";

import { useEffect, useMemo, useState } from "react";
import { useFinanceOwner } from "@/components/admin/FinanceBookSelect";
import { startVisibleRefresh } from "@/lib/admin/dashboard-refresh";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface ClientProduct {
  financeBook?: string;
  name: string;
  monthlyAmount: number | null;
  status: string;
  startDate: string | null;
  createdAt: string;
}

interface Client {
  id: string;
  name: string;
  amount: number | null;
  expense: number | null;
  cardcomFee: number | null;
  startDate: string | null;
  createdAt: string;
  products?: ClientProduct[];
}

interface MonthData {
  key: string;
  label: string;
  revenue: number;
  expenses: number;
  profit: number;
  isCurrent: boolean;
  /** receipts view only — split of what arrived */
  subscriptions?: number;
  jobs?: number;
}

/** One month of money that actually arrived — from /api/revenue/monthly. */
interface MonthlyReceipt {
  month: string;
  subscriptions: number;
  jobs: number;
  revenue: number;
  expenses: number;
  profit: number;
  unvaluedCount?: number;
}

// The receipts view gets VAT and the Cardcom fee applied server-side
// (/api/revenue/monthly); only the new-MRR projection still nets VAT here.
const VAT_RATE = 18;

const HEBREW_MONTHS_SHORT = [
  "ינו",
  "פבר",
  "מרץ",
  "אפר",
  "מאי",
  "יוני",
  "יולי",
  "אוג",
  "ספט",
  "אוק",
  "נוב",
  "דצמ",
];

function formatCurrency(n: number): string {
  return n.toLocaleString("he-IL", { maximumFractionDigits: 0 });
}

/** "2026-04" → "אפר 26" */
function monthLabel(key: string): string {
  const [year, month] = key.split("-");
  return `${HEBREW_MONTHS_SHORT[parseInt(month, 10) - 1]} ${year.slice(2)}`;
}

function formatCurrencyShort(n: number): string {
  if (Math.abs(n) >= 1000) {
    return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
  }
  return Math.round(n).toString();
}

interface TooltipPayloadItem {
  payload: MonthData;
  value: number;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}) {
  if (!active || !payload?.length) return null;
  const data = payload[0].payload;
  const profitColor = data.profit >= 0 ? "text-green-400" : "text-red-400";
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-lg text-right" dir="rtl">
      <p className="text-gray-300 text-xs font-bold mb-1.5">{data.label}</p>
      <p className="text-sm text-white font-mono">
        הכנסות: {formatCurrency(data.revenue)} ₪
      </p>
      {/* Receipts view only — knowing WHICH kind of money arrived is the
          point of the split (recurring MRR vs a one-off project). */}
      {data.subscriptions !== undefined && data.revenue > 0 && (
        <p className="text-[11px] text-gray-500 font-mono">
          מנויים {formatCurrency(data.subscriptions)} ₪
          {(data.jobs ?? 0) > 0 && ` · עבודות ${formatCurrency(data.jobs ?? 0)} ₪`}
        </p>
      )}
      <p className="text-xs text-gray-400 font-mono">
        הוצאות: {formatCurrency(data.expenses)} ₪
      </p>
      <p className={`text-sm font-mono font-bold mt-1 ${profitColor}`}>
        רווח: {formatCurrency(data.profit)} ₪
      </p>
    </div>
  );
}

export default function RevenueChart() {
  const isOwner = useFinanceOwner();
  const [book, setBook] = useState("");
  const [receiptsReady, setReceiptsReady] = useState(false);
  const [clientsReady, setClientsReady] = useState(false);
  const [receiptsError, setReceiptsError] = useState(false);
  const [clientsError, setClientsError] = useState(false);
  const [syncStale, setSyncStale] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [receipts, setReceipts] = useState<MonthlyReceipt[]>([]);
  const [trackedFrom, setTrackedFrom] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [windowMonths, setWindowMonths] = useState<6 | 12 | 24>(12);
  // "received" = money that actually arrived, by the month it arrived
  // (/api/revenue/monthly). "newMrr" answers "which month did each product
  // enter" — the monthly amounts of products whose startDate lands in that
  // month (billing products only), which is a client-side derivation.
  const [viewMode, setViewMode] = useState<"received" | "newMrr">("received");

  useEffect(() => {
    const poller = startVisibleRefresh(async (signal) => {
      const read = async (path: string) => {
        const res = await fetch(path, { cache: "no-store", signal });
        if (!res.ok) throw new Error(`${path}: ${res.status}`);
        return res.json();
      };
      const results = await Promise.allSettled([
        read("/api/clients"),
        read(`/api/revenue/monthly?months=${windowMonths}${book ? `&book=${book}` : ""}`),
      ]);
      if (signal.aborted) return;
      const [clientsRes, receiptsRes] = results;
      if (clientsRes.status === "fulfilled") {
        if (Array.isArray(clientsRes.value.data)) {
          setClients(clientsRes.value.data);
          setClientsReady(true);
          setClientsError(false);
        } else setClientsError(true);
      }
      if (receiptsRes.status === "fulfilled") {
        if (Array.isArray(receiptsRes.value.data)) {
          setReceipts(receiptsRes.value.data);
          setTrackedFrom(receiptsRes.value.trackedFrom ?? null);
          setSyncStale(receiptsRes.value.partial === true || receiptsRes.value.coverage?.status !== "SUCCESS");
          setReceiptsReady(true);
          setReceiptsError(false);
        } else setReceiptsError(true);
      }
      if (clientsRes.status === "rejected") setClientsError(true);
      if (receiptsRes.status === "rejected") setReceiptsError(true);
      for (const result of results) {
        if (result.status === "rejected") console.error("Failed to load revenue chart:", result.reason);
      }
      setLoading(false);
    });
    return () => poller.stop();
  }, [windowMonths, book]);

  const monthlyData: MonthData[] = useMemo(() => {
    const today0 = new Date();
    today0.setUTCDate(1);
    today0.setUTCHours(0, 0, 0, 0);
    const currentMonthKey = `${today0.getUTCFullYear()}-${String(
      today0.getUTCMonth() + 1,
    ).padStart(2, "0")}`;

    // Receipts come straight from the server, already bucketed by the month
    // the money landed. No client-side derivation — that is what produced the
    // cohort bug (a month with no NEW clients showed ₪0 despite being billed).
    if (viewMode === "received") {
      return receipts.map((month) => {
        const [year, monthStr] = month.month.split("-");
        return {
          key: month.month,
          label: `${HEBREW_MONTHS_SHORT[parseInt(monthStr, 10) - 1]} ${year.slice(2)}`,
          revenue: month.revenue,
          expenses: month.expenses,
          profit: month.profit,
          subscriptions: month.subscriptions,
          jobs: month.jobs,
          isCurrent: month.month === currentMonthKey,
        };
      });
    }

    const monthMap = new Map<string, { revenue: number; expenses: number }>();
    const today = new Date();
    today.setUTCDate(1);
    today.setUTCHours(0, 0, 0, 0);
    const currentKey = `${today.getUTCFullYear()}-${String(
      today.getUTCMonth() + 1
    ).padStart(2, "0")}`;

    // Build a continuous run of months, even if a month has no clients.
    for (let i = windowMonths - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setUTCMonth(d.getUTCMonth() - i);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      monthMap.set(key, { revenue: 0, expenses: 0 });
    }

    // Each billing product is attributed to the month it entered. Product
    // startDate wins; a product without one inherits the client's date so
    // pre-migration data still lands somewhere sensible.
    for (const c of clients) {
      for (const p of c.products ?? []) {
        if (book === "personal" && p.financeBook !== "PRIVATE") continue;
        if (book === "fuzion" && p.financeBook !== "SHARED") continue;
        if (p.status !== "בוצע") continue; // not billing → not new MRR
        const dateStr = p.startDate ?? c.startDate ?? p.createdAt ?? c.createdAt;
        const d = new Date(dateStr);
        const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
        if (!monthMap.has(key)) continue;
        const entry = monthMap.get(key)!;
        entry.revenue += p.monthlyAmount ?? 0;
        monthMap.set(key, entry);
      }
    }

    return Array.from(monthMap.entries()).map(([key, val]) => {
      const [year, monthStr] = key.split("-");
      const monthIdx = parseInt(monthStr, 10) - 1;
      // Net profit excluding VAT
      const netRevenue = (val.revenue * 100) / (100 + VAT_RATE);
      return {
        key,
        label: `${HEBREW_MONTHS_SHORT[monthIdx]} ${year.slice(2)}`,
        revenue: val.revenue,
        expenses: val.expenses,
        profit: netRevenue - val.expenses,
        isCurrent: key === currentKey,
      };
    });
  }, [clients, receipts, windowMonths, viewMode, book]);

  // Summary stats from the visible window
  const stats = useMemo(() => {
    const totalRevenue = monthlyData.reduce((a, m) => a + m.revenue, 0);
    const totalProfit = monthlyData.reduce((a, m) => a + m.profit, 0);
    const monthsWithRevenue = monthlyData.filter((m) => m.revenue > 0).length;
    const avgMonthly = monthsWithRevenue > 0 ? totalRevenue / monthsWithRevenue : 0;

    const current = monthlyData[monthlyData.length - 1]?.revenue ?? 0;
    const previous = monthlyData[monthlyData.length - 2]?.revenue ?? 0;
    const growthPct =
      previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0;

    return {
      totalRevenue,
      totalProfit,
      avgMonthly,
      currentMonth: current,
      growthPct,
    };
  }, [monthlyData]);

  if (loading) {
    return (
      <div className="bg-gray-900 rounded-2xl border border-gray-700 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-700 rounded w-40" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-800 rounded-xl" />
            ))}
          </div>
          <div className="h-[320px] bg-gray-800 rounded-xl" />
        </div>
      </div>
    );
  }

  const hasData = viewMode === "received" ? receiptsReady : clientsReady;
  const refreshFailed = viewMode === "received" ? receiptsError : clientsError;
  const unvaluedCount = receipts.reduce((sum, month) => sum + (month.unvaluedCount ?? 0), 0);
  const unvaluedProducts = clients.flatMap((client) => client.products ?? []).filter((product) => product.status === "בוצע" && product.monthlyAmount == null && (book === "personal" ? product.financeBook === "PRIVATE" : book === "fuzion" ? product.financeBook === "SHARED" : true)).length;
  const hasAnyRevenue = monthlyData.some((m) => m.revenue !== 0);

  return (
    <div dir="rtl" className="bg-gray-900 rounded-2xl border border-gray-700 p-6">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div>
          <h3 className="text-lg font-bold text-white">
            {viewMode === "received" ? "הכנסות חודשיות" : "MRR חדש לפי חודש"}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {viewMode === "received"
              ? `כסף שהתקבל בפועל — לאחר מע״מ, עמלת סליקה משוערת והוצאות ששולמו ותועדו${
                  trackedFrom ? ` (מתועד מ-${monthLabel(trackedFrom)})` : ""
                }`
              : "סכום חודשי של מוצרים שנכנסו לתשלום באותו חודש"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
        {isOwner && <select aria-label="ספר הכנסות" value={book} onChange={(event) => { setBook(event.target.value); setReceiptsReady(false); }} className="bg-gray-800 rounded-xl px-3 py-2 text-xs text-white">
          <option value="">הכול</option><option value="personal">שלי בלבד</option><option value="fuzion">השותפות</option>
        </select>}
        <div className="flex bg-gray-800 rounded-xl p-1 text-xs">
          {([["received", "תקבולים"], ["newMrr", "MRR חדש"]] as const).map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                viewMode === mode ? "bg-gray-900 text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex bg-gray-800 rounded-xl p-1 text-xs">
          {[6, 12, 24].map((n) => (
            <button
              key={n}
              onClick={() => setWindowMonths(n as 6 | 12 | 24)}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                windowMonths === n
                  ? "bg-gray-900 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              {n} חוד׳
            </button>
          ))}
        </div>
        </div>
      </div>

      {(refreshFailed || (viewMode === "received" && syncStale)) && <p role="alert" className="text-sm text-amber-300 mb-4">{refreshFailed ? "טעינת הנתונים נכשלה." : "הסנכרון אינו מכסה את כל התקופה. חודשים חסרים אינם מעידים על אפס הכנסה."} {hasData ? "מוצגים הנתונים האחרונים שהתקבלו." : "הסכומים אינם זמינים כרגע."}</p>}
      {viewMode === "received" && unvaluedCount > 0 && <p className="text-sm text-amber-300 mb-4">{unvaluedCount} תקבולים ללא שווי בשקלים אינם נכללים. הסכומים חלקיים.</p>}
      {viewMode === "newMrr" && unvaluedProducts > 0 && <p className="text-sm text-amber-300 mb-4">{unvaluedProducts} מוצרים ללא סכום חודשי בשקלים אינם נכללים. התחזית חלקית.</p>}
      {/* Summary cards */}
      {hasData && <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <SummaryCard
          label="סה״כ בחלון"
          value={`${formatCurrency(stats.totalRevenue)} ₪`}
        />
        <SummaryCard
          label="ממוצע חודשי"
          value={`${formatCurrency(stats.avgMonthly)} ₪`}
        />
        <SummaryCard
          label={viewMode === "received" ? "לאחר הוצאות שתועדו" : "רווח צפוי"}
          value={`${formatCurrency(stats.totalProfit)} ₪`}
          valueColor={stats.totalProfit >= 0 ? "text-green-400" : "text-red-400"}
        />
        <SummaryCard
          label="חודש נוכחי"
          value={`${formatCurrency(stats.currentMonth)} ₪`}
          delta={
            stats.growthPct === 0
              ? undefined
              : {
                  text: `${stats.growthPct > 0 ? "+" : ""}${stats.growthPct.toFixed(0)}%`,
                  positive: stats.growthPct >= 0,
                }
          }
        />
      </div>

      {/* Chart */}
      {hasAnyRevenue ? (
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={monthlyData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "#6b7280", fontSize: 11 }}
              axisLine={{ stroke: "#2a2a2a" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#6b7280", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={formatCurrencyShort}
              width={50}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ fill: "rgba(17, 24, 39, 0.04)" }}
            />
            <Bar dataKey="revenue" name="הכנסות" radius={[6, 6, 0, 0]} maxBarSize={48}>
              {monthlyData.map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={entry.isCurrent ? "#E503A2" : "#4b5563"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex flex-col items-center justify-center h-[280px] text-gray-500 gap-2">
          <svg className="w-10 h-10 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p className="text-sm">אין הכנסות בחלון הזמן הזה</p>
          <p className="text-xs">{viewMode === "received" ? "לא נמצאו תקבולים מתועדים בתקופה הזאת" : "לא נוספו מוצרים מחויבים בתקופה הזאת"}</p>
        </div>
      )}

      </>}
      {!hasData && <p className="text-sm text-gray-400 py-10 text-center">{refreshFailed ? "אין נתונים זמינים להצגה" : "טוען נתונים לתצוגה שנבחרה…"}</p>}
      <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-gray-900" />
          חודש נוכחי
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-gray-400" />
          חודשים קודמים
        </span>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  valueColor,
  delta,
}: {
  label: string;
  value: string;
  valueColor?: string;
  delta?: { text: string; positive: boolean };
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <p className="text-gray-400 text-xs mb-1">{label}</p>
      <p className={`text-xl font-bold font-mono ${valueColor || "text-white"}`}>{value}</p>
      {delta && (
        <p className={`text-xs mt-0.5 ${delta.positive ? "text-green-400" : "text-red-400"}`}>
          {delta.text} מהחודש הקודם
        </p>
      )}
    </div>
  );
}
