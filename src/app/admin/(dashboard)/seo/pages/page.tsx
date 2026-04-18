"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { exportCsv } from "@/lib/csv-export";

interface PageRow {
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

type SortKey = "page" | "clicks" | "impressions" | "ctr" | "position";

function shortPath(url: string): string {
  try {
    return new URL(url).pathname || "/";
  } catch {
    return url;
  }
}

export default function PagesPage() {
  const [rows, setRows] = useState<PageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("clicks");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/seo/pages?limit=100&sort=clicks&order=desc", {
          cache: "no-store",
        });
        if (!res.ok) throw new Error();
        setRows((await res.json()).pages ?? []);
      } catch {
        toast.error("שגיאה בטעינת הדפים");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "position" ? "asc" : "desc");
    }
  };

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDir]);

  const handleExport = () => {
    exportCsv(
      ["דף", "קליקים", "הופעות", "CTR", "מיקום"],
      sorted.map((r) => [
        shortPath(r.page),
        r.clicks,
        r.impressions,
        (r.ctr * 100).toFixed(2) + "%",
        r.position.toFixed(1),
      ]),
      `pages-${new Date().toISOString().slice(0, 10)}.csv`
    );
  };

  if (loading) {
    return <div className="h-64 bg-gray-900 border border-gray-700 rounded-2xl animate-pulse" />;
  }

  return (
    <div dir="rtl" className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">דפים מובילים</h2>
        <button
          onClick={handleExport}
          disabled={sorted.length === 0}
          className="text-xs text-cyan hover:text-cyan/80 disabled:opacity-50 underline-offset-2 hover:underline"
        >
          ייצוא CSV
        </button>
      </div>

      {sorted.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="bg-gray-900 border border-gray-700 rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-800/50 border-b border-gray-700">
              <tr>
                <Th label="דף" k="page" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <Th label="קליקים" k="clicks" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <Th label="הופעות" k="impressions" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <Th label="CTR" k="ctr" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <Th label="מיקום" k="position" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr
                  key={r.page}
                  className="border-b border-gray-800 last:border-0 hover:bg-gray-800/30 cursor-pointer"
                  onClick={() => window.open(r.page, "_blank")}
                >
                  <td className="px-3 py-2 text-white text-xs">{shortPath(r.page)}</td>
                  <td className="px-3 py-2 text-gray-300 font-mono">
                    {r.clicks.toLocaleString("he-IL")}
                  </td>
                  <td className="px-3 py-2 text-gray-300 font-mono">
                    {r.impressions.toLocaleString("he-IL")}
                  </td>
                  <td className="px-3 py-2 text-gray-300 font-mono">{(r.ctr * 100).toFixed(1)}%</td>
                  <td className="px-3 py-2 text-gray-300 font-mono">{r.position.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({
  label,
  k,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (k: SortKey) => void;
}) {
  const active = sortKey === k;
  return (
    <th className="text-right text-gray-400 font-medium px-3 py-2.5">
      <button
        onClick={() => onSort(k)}
        className={`flex items-center gap-1 ${active ? "text-white" : ""}`}
      >
        {label}
        {active && <span className="text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>}
      </button>
    </th>
  );
}

function EmptyState() {
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-2xl p-12 text-center">
      <p className="text-base font-bold text-white mb-2">אין נתונים עדיין</p>
      <p className="text-sm text-gray-500">
        הנתונים יתעדכנו בסנכרון הבא, או לחץ &quot;סנכרן עכשיו&quot; בדף הסקירה
      </p>
    </div>
  );
}
