"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { exportCsv } from "@/lib/csv-export";

interface BacklinkRow {
  id: string;
  sourceDomain: string;
  targetUrl: string;
  firstSeen: string;
  lastSeen: string;
}

interface ApiResponse {
  backlinks: BacklinkRow[];
  summary: { totalCount: number; uniqueDomains: number; newThisWeek: number };
}

function shortPath(url: string): string {
  try {
    return new URL(url).pathname || "/";
  } catch {
    return url;
  }
}

function isNewThisWeek(iso: string): boolean {
  const d = new Date(iso).getTime();
  return Date.now() - d < 7 * 24 * 60 * 60 * 1000;
}

export default function BacklinksPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/seo/backlinks", { cache: "no-store" });
        if (!res.ok) throw new Error();
        setData(await res.json());
      } catch {
        toast.error("שגיאה בטעינת הקישורים");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleExport = () => {
    if (!data) return;
    exportCsv(
      ["דומיין מקור", "דף יעד", "נצפה ראשונה", "נצפה אחרונה"],
      data.backlinks.map((b) => [
        b.sourceDomain,
        shortPath(b.targetUrl),
        new Date(b.firstSeen).toLocaleDateString("he-IL"),
        new Date(b.lastSeen).toLocaleDateString("he-IL"),
      ]),
      `backlinks-${new Date().toISOString().slice(0, 10)}.csv`
    );
  };

  if (loading) {
    return <div className="h-64 bg-gray-900 border border-gray-700 rounded-2xl animate-pulse" />;
  }

  if (!data || data.backlinks.length === 0) {
    return (
      <div dir="rtl" className="space-y-4">
        <h2 className="text-2xl font-bold">קישורים נכנסים</h2>
        <EmptyState />
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">קישורים נכנסים</h2>
        <button
          onClick={handleExport}
          className="text-xs text-cyan hover:text-cyan/80 underline-offset-2 hover:underline"
        >
          ייצוא CSV
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <SummaryCard label="סה״כ קישורים" value={data.summary.totalCount.toLocaleString("he-IL")} accent="pink" />
        <SummaryCard label="דומיינים ייחודיים" value={data.summary.uniqueDomains.toLocaleString("he-IL")} accent="cyan" />
        <SummaryCard label="חדשים השבוע" value={data.summary.newThisWeek.toLocaleString("he-IL")} accent="pink" />
      </div>

      <div className="bg-gray-900 border border-gray-700 rounded-2xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-800/50 border-b border-gray-700">
            <tr>
              <th className="text-right text-gray-400 font-medium px-3 py-2.5">דומיין מקור</th>
              <th className="text-right text-gray-400 font-medium px-3 py-2.5">דף שלנו</th>
              <th className="text-right text-gray-400 font-medium px-3 py-2.5">נצפה ראשונה</th>
              <th className="text-right text-gray-400 font-medium px-3 py-2.5">נצפה אחרונה</th>
            </tr>
          </thead>
          <tbody>
            {data.backlinks.map((b) => {
              const isNew = isNewThisWeek(b.firstSeen);
              return (
                <tr
                  key={b.id}
                  className={`border-b border-gray-800 last:border-0 hover:bg-gray-800/30 ${
                    isNew ? "bg-green-500/5" : ""
                  }`}
                >
                  <td className="px-3 py-2 text-white">
                    {b.sourceDomain}
                    {isNew && (
                      <span className="mr-2 text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded">
                        חדש
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-300 text-xs">{shortPath(b.targetUrl)}</td>
                  <td className="px-3 py-2 text-gray-500 text-xs">
                    {new Date(b.firstSeen).toLocaleDateString("he-IL")}
                  </td>
                  <td className="px-3 py-2 text-gray-500 text-xs">
                    {new Date(b.lastSeen).toLocaleDateString("he-IL")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "pink" | "cyan";
}) {
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent === "pink" ? "text-pink" : "text-cyan"}`}>{value}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-2xl p-12 text-center">
      <p className="text-base font-bold text-white mb-2">אין קישורים עדיין</p>
      <p className="text-sm text-gray-500">
        הקישורים יתעדכנו אוטומטית בסנכרון הבא. גוגל מציגה רק חלק מהקישורים — לכיסוי
        מלא צריך כלי בתשלום (Ahrefs).
      </p>
    </div>
  );
}
