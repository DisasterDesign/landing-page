"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { exportCsv } from "@/lib/csv-export";

interface ReferralRow {
  source: string;
  medium: string;
  sessions: number;
  engagedSessions: number;
}

export default function ReferralsPage() {
  const [rows, setRows] = useState<ReferralRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/seo/referrals", { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error || "שגיאה");
          return;
        }
        setRows(json.referrals ?? []);
      } catch {
        toast.error("שגיאה בטעינת המקורות");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleExport = () => {
    exportCsv(
      ["מקור", "מדיום", "כניסות", "כניסות מעורבות", "שיעור מעורבות"],
      rows.map((r) => [
        r.source,
        r.medium,
        r.sessions,
        r.engagedSessions,
        r.sessions > 0 ? ((r.engagedSessions / r.sessions) * 100).toFixed(1) + "%" : "-",
      ]),
      `referrals-${new Date().toISOString().slice(0, 10)}.csv`
    );
  };

  if (loading) {
    return <div className="h-64 bg-gray-900 border border-gray-700 rounded-2xl animate-pulse" />;
  }

  if (error) {
    return (
      <div dir="rtl" className="space-y-4">
        <h2 className="text-2xl font-bold">תנועה ממקורות חיצוניים</h2>
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-5">
          <p className="text-sm text-yellow-300">{error}</p>
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div dir="rtl" className="space-y-4">
        <h2 className="text-2xl font-bold">תנועה ממקורות חיצוניים</h2>
        <EmptyState />
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">תנועה ממקורות חיצוניים</h2>
        <button
          onClick={handleExport}
          className="text-xs text-cyan hover:text-cyan/80 underline-offset-2 hover:underline"
        >
          ייצוא CSV
        </button>
      </div>

      <div className="bg-gray-900 border border-gray-700 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-800/50 border-b border-gray-700">
            <tr>
              <th className="text-right text-gray-400 font-medium px-3 py-2.5">מקור</th>
              <th className="text-right text-gray-400 font-medium px-3 py-2.5">מדיום</th>
              <th className="text-right text-gray-400 font-medium px-3 py-2.5">כניסות</th>
              <th className="text-right text-gray-400 font-medium px-3 py-2.5">מעורבות</th>
              <th className="text-right text-gray-400 font-medium px-3 py-2.5">שיעור מעורבות</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const rate = r.sessions > 0 ? (r.engagedSessions / r.sessions) * 100 : 0;
              return (
                <tr key={`${r.source}-${r.medium}-${i}`} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/30">
                  <td className="px-3 py-2 text-white">{r.source}</td>
                  <td className="px-3 py-2 text-gray-400 text-xs">{r.medium}</td>
                  <td className="px-3 py-2 text-gray-300 font-mono">
                    {r.sessions.toLocaleString("he-IL")}
                  </td>
                  <td className="px-3 py-2 text-gray-300 font-mono">
                    {r.engagedSessions.toLocaleString("he-IL")}
                  </td>
                  <td className="px-3 py-2 text-gray-300 font-mono">{rate.toFixed(1)}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-2xl p-12 text-center">
      <p className="text-base font-bold text-white mb-2">אין נתונים עדיין</p>
      <p className="text-sm text-gray-500">
        אין כניסות מאתרים חיצוניים ב-28 הימים האחרונים, או שטרם בוצע סנכרון.
      </p>
    </div>
  );
}
