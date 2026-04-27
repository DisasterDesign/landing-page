"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import toast from "react-hot-toast";

interface PartnerRow {
  id: string;
  number: number;
  name: string;
  amount: number;
  vat: number;
  cardcomFee: number;
  expense: number;
  netProfit: number;
  partnerShare: number;
  paymentDate: string | null;
}

interface Totals {
  amount: number;
  vat: number;
  cardcomFee: number;
  expense: number;
  netProfit: number;
  partnerShare: number;
}

interface ReportPayload {
  month: string;
  rows: PartnerRow[];
  totals: Totals;
  count: number;
}

const HE_MONTHS = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];

const fmtNum = (n: number | null | undefined) =>
  n != null
    ? n.toLocaleString("he-IL", { minimumFractionDigits: 0, maximumFractionDigits: 1 })
    : "";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return `${HE_MONTHS[m - 1]} ${y}`;
}

// Generate the last 12 month options (incl. current) for the dropdown.
function recentMonths(count = 12): string[] {
  const now = new Date();
  const list: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    list.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return list;
}

export default function PartnerReportPage() {
  const [month, setMonth] = useState<string>(currentMonth());
  const [data, setData] = useState<ReportPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const monthOptions = useMemo(() => recentMonths(12), []);

  const load = useCallback(async (m: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/partner-report?month=${m}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error();
      const json = (await res.json()) as ReportPayload;
      setData(json);
    } catch {
      toast.error("שגיאה בטעינת הדוח");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(month);
  }, [load, month]);

  const totals = data?.totals;
  const rows = data?.rows ?? [];

  return (
    <div dir="rtl" className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">דוח שותף — חודשי</h1>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed max-w-xl">
            סיכום הכנסות מצטבר על לקוחות עם סטטוס &quot;בוצע&quot; ושיוך
            &quot;fuzion&quot;, לפי חודש תשלום. נטו = סכום פחות מע&quot;מ פחות
            עמלת CardCom 2% פחות הוצאות. חלק שותף = הנטו ÷ 2.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-400">חודש</label>
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-pink"
          >
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard
          label="לקוחות בחודש"
          value={data?.count ?? 0}
          format="int"
        />
        <SummaryCard
          label="הכנסה ברוטו (כולל מע״מ)"
          value={totals?.amount ?? 0}
        />
        <SummaryCard label="רווח נקי" value={totals?.netProfit ?? 0} accent />
        <SummaryCard
          label="חלק שותף (×0.5)"
          value={totals?.partnerShare ?? 0}
          accent
          highlight
        />
      </div>

      {loading ? (
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-12 text-center text-sm text-gray-500">
          טוען...
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-12 text-center text-sm text-gray-500">
          אין לקוחות בקטגוריה הזו לחודש {monthLabel(month)}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto rounded-lg border border-gray-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-800 border-b border-gray-700">
                  <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-12">#</th>
                  <th className="text-right text-gray-400 font-medium px-3 py-2.5 min-w-[180px]">לקוח</th>
                  <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-32">תאריך תשלום</th>
                  <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-28">ברוטו (₪)</th>
                  <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-24 bg-gray-700/40">מע״מ (₪)</th>
                  <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-24 bg-gray-700/40">CardCom (₪)</th>
                  <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-24">הוצאה (₪)</th>
                  <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-28 bg-gray-700/40">נטו (₪)</th>
                  <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-28 bg-pink/10">חלק שותף (₪)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-gray-800 hover:bg-gray-800/40">
                    <td className="px-3 py-2 text-gray-500 font-mono text-xs">#{r.number}</td>
                    <td className="px-3 py-2 text-white">{r.name}</td>
                    <td className="px-3 py-2 text-gray-400 text-xs">
                      {r.paymentDate ? new Date(r.paymentDate).toLocaleDateString("he-IL") : "—"}
                    </td>
                    <td className="px-3 py-2 font-mono">{fmtNum(r.amount)}</td>
                    <td className="px-3 py-2 font-mono text-gray-300 bg-gray-700/20">{fmtNum(r.vat)}</td>
                    <td className="px-3 py-2 font-mono text-gray-300 bg-gray-700/20">{fmtNum(r.cardcomFee)}</td>
                    <td className="px-3 py-2 font-mono">{fmtNum(r.expense)}</td>
                    <td className="px-3 py-2 font-mono bg-gray-700/20">
                      <span className={r.netProfit >= 0 ? "text-green-400" : "text-red-400"}>
                        {fmtNum(r.netProfit)}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono bg-pink/10">
                      <span className={r.partnerShare >= 0 ? "text-pink" : "text-red-400"}>
                        {fmtNum(r.partnerShare)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-800/80 border-t border-gray-600 font-medium">
                  <td className="px-3 py-2.5" colSpan={3}>
                    <span className="text-gray-400">סה&quot;כ ({rows.length} לקוחות)</span>
                  </td>
                  <td className="px-3 py-2.5 font-mono text-white">{fmtNum(totals?.amount)}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-300 bg-gray-700/20">{fmtNum(totals?.vat)}</td>
                  <td className="px-3 py-2.5 font-mono text-gray-300 bg-gray-700/20">{fmtNum(totals?.cardcomFee)}</td>
                  <td className="px-3 py-2.5 font-mono text-white">{fmtNum(totals?.expense)}</td>
                  <td className="px-3 py-2.5 font-mono bg-gray-700/20">
                    <span
                      className={
                        (totals?.netProfit ?? 0) >= 0 ? "text-green-400" : "text-red-400"
                      }
                    >
                      {fmtNum(totals?.netProfit)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-mono bg-pink/10 text-pink font-bold">
                    {fmtNum(totals?.partnerShare)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {rows.map((r) => (
              <div key={r.id} className="bg-gray-900 border border-gray-700 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-white truncate">{r.name}</div>
                    <div className="text-[11px] text-gray-500">
                      #{r.number}
                      {r.paymentDate
                        ? ` · ${new Date(r.paymentDate).toLocaleDateString("he-IL")}`
                        : ""}
                    </div>
                  </div>
                  <div className="text-pink font-mono font-bold text-lg shrink-0">
                    {fmtNum(r.partnerShare)} ₪
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-gray-400 pt-2 border-t border-gray-800">
                  <span>ברוטו: <span className="font-mono text-gray-300">{fmtNum(r.amount)}</span></span>
                  <span>מע״מ: <span className="font-mono text-gray-300">{fmtNum(r.vat)}</span></span>
                  <span>CardCom: <span className="font-mono text-gray-300">{fmtNum(r.cardcomFee)}</span></span>
                  <span>הוצאה: <span className="font-mono text-gray-300">{fmtNum(r.expense)}</span></span>
                  <span className="col-span-2">
                    נטו: <span className={`font-mono font-bold ${r.netProfit >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {fmtNum(r.netProfit)}
                    </span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

interface SummaryCardProps {
  label: string;
  value: number;
  format?: "currency" | "int";
  accent?: boolean;
  highlight?: boolean;
}

function SummaryCard({ label, value, format = "currency", accent, highlight }: SummaryCardProps) {
  const display =
    format === "int"
      ? value.toLocaleString("he-IL", { maximumFractionDigits: 0 })
      : `₪${fmtNum(value)}`;
  return (
    <div
      className={`rounded-2xl p-4 border ${
        highlight
          ? "bg-pink/15 border-pink/40"
          : "bg-gray-900 border-gray-700"
      }`}
    >
      <div className="text-[11px] text-gray-400 mb-1">{label}</div>
      <div
        className={`text-xl md:text-2xl font-bold font-mono ${
          highlight ? "text-pink" : accent ? "text-white" : "text-gray-200"
        }`}
      >
        {display}
      </div>
    </div>
  );
}
