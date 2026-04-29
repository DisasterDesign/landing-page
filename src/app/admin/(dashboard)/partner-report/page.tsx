"use client";

import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";

interface PartnerRow {
  id: string;
  number: number;
  name: string;
  amount: number;
  vat: number;
  cardcomFee: number;
  profit: number;
  partnerShare: number;
  paymentDate: string | null;
}

interface Totals {
  amount: number;
  vat: number;
  cardcomFee: number;
  profit: number;
  partnerShare: number;
}

interface ReportPayload {
  snapshotAt: string;
  rows: PartnerRow[];
  totals: Totals;
  count: number;
}

const fmtNum = (n: number | null | undefined) =>
  n != null
    ? n.toLocaleString("he-IL", { minimumFractionDigits: 0, maximumFractionDigits: 1 })
    : "";

export default function PartnerReportPage() {
  const [data, setData] = useState<ReportPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/partner-report`, { cache: "no-store" });
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
    load();
  }, [load]);

  const totals = data?.totals;
  const rows = data?.rows ?? [];

  const snapshotLabel = data?.snapshotAt
    ? new Date(data.snapshotAt).toLocaleString("he-IL", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <div dir="rtl" className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">דוח שותף — תמונת מצב</h1>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed max-w-xl">
            סיכום הכנסות חודשי על לקוחות פעילים בהוראת קבע (סטטוס &quot;בוצע&quot;).
            רווח = סכום פחות מע&quot;מ פחות עמלת CardCom 2%. כל אחד מהשותפים
            (אלעד ורועי) מקבל מחצית מהרווח. ל-snapshot חודשי — שמור / צלם
            בסוף החודש.
          </p>
        </div>
        {snapshotLabel && (
          <div className="text-[11px] text-gray-500 font-mono">
            עודכן: {snapshotLabel}
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard
          label="לקוחות פעילים"
          value={data?.count ?? 0}
          format="int"
        />
        <SummaryCard
          label="רווח אחרי עמלות / חודש"
          value={totals?.profit ?? 0}
          accent
        />
        <SummaryCard
          label="חלק אלעד"
          value={totals?.partnerShare ?? 0}
          accent
          highlight
        />
        <SummaryCard
          label="חלק רועי"
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
          אין לקוחות פעילים עם סטטוס &quot;בוצע&quot;
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
                  <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-32">תשלום אחרון</th>
                  <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-28">חודשי (₪)</th>
                  <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-24 bg-gray-700/40">מע״מ (₪)</th>
                  <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-24 bg-gray-700/40">CardCom (₪)</th>
                  <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-28 bg-gray-700/40">רווח (₪)</th>
                  <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-28 bg-pink/10">חלק אלעד (₪)</th>
                  <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-28 bg-pink/10">חלק רועי (₪)</th>
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
                    <td className="px-3 py-2 font-mono bg-gray-700/20">
                      <span className={r.profit >= 0 ? "text-green-400" : "text-red-400"}>
                        {fmtNum(r.profit)}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono bg-pink/10">
                      <span className={r.partnerShare >= 0 ? "text-pink" : "text-red-400"}>
                        {fmtNum(r.partnerShare)}
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
                  <td className="px-3 py-2.5 font-mono bg-gray-700/20">
                    <span className={(totals?.profit ?? 0) >= 0 ? "text-green-400" : "text-red-400"}>
                      {fmtNum(totals?.profit)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-mono bg-pink/10 text-pink font-bold">
                    {fmtNum(totals?.partnerShare)}
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
                        ? ` · תשלום אחרון ${new Date(r.paymentDate).toLocaleDateString("he-IL")}`
                        : ""}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-gray-400 pt-2 border-t border-gray-800">
                  <span>חודשי: <span className="font-mono text-gray-300">{fmtNum(r.amount)}</span></span>
                  <span>מע״מ: <span className="font-mono text-gray-300">{fmtNum(r.vat)}</span></span>
                  <span>CardCom: <span className="font-mono text-gray-300">{fmtNum(r.cardcomFee)}</span></span>
                  <span>
                    רווח:{" "}
                    <span className={`font-mono font-bold ${r.profit >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {fmtNum(r.profit)}
                    </span>
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-3 pt-2 border-t border-gray-800">
                  <div className="bg-pink/10 rounded-lg px-2 py-1.5 text-center">
                    <div className="text-[10px] text-gray-400">חלק אלעד</div>
                    <div className="font-mono font-bold text-pink text-base">{fmtNum(r.partnerShare)} ₪</div>
                  </div>
                  <div className="bg-pink/10 rounded-lg px-2 py-1.5 text-center">
                    <div className="text-[10px] text-gray-400">חלק רועי</div>
                    <div className="font-mono font-bold text-pink text-base">{fmtNum(r.partnerShare)} ₪</div>
                  </div>
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
