"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { exportCsv } from "@/lib/csv-export";

interface QueryRow {
  id: string;
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  topPage: string | null;
}

type SortKey = "query" | "clicks" | "impressions" | "ctr" | "position";

function shortPath(url: string | null, max = 36): string {
  if (!url) return "—";
  try {
    return new URL(url).pathname.slice(0, max);
  } catch {
    return url.slice(0, max);
  }
}

function positionColor(pos: number): string {
  if (pos < 4) return "text-green-400";
  if (pos < 11) return "text-yellow-400";
  if (pos <= 20) return "text-orange-400";
  return "text-red-400";
}

export default function KeywordsPage() {
  const [rows, setRows] = useState<QueryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("clicks");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page2only, setPage2only] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/seo/queries?limit=200&sort=clicks&order=desc", {
          cache: "no-store",
        });
        if (!res.ok) throw new Error();
        setRows((await res.json()).queries ?? []);
      } catch {
        toast.error("שגיאה בטעינת המילים");
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

  const filtered = useMemo(() => {
    let list = rows;
    if (page2only) {
      list = list.filter((r) => r.position >= 11 && r.position <= 20);
    }
    return [...list].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDir, page2only]);

  const handleExport = () => {
    exportCsv(
      ["מילה", "קליקים", "הופעות", "CTR", "מיקום", "דף"],
      filtered.map((r) => [
        r.query,
        r.clicks,
        r.impressions,
        (r.ctr * 100).toFixed(2) + "%",
        r.position.toFixed(1),
        r.topPage || "",
      ]),
      `keywords-${new Date().toISOString().slice(0, 10)}.csv`
    );
  };

  if (loading) {
    return <div className="h-64 bg-gray-900 border border-gray-700 rounded-2xl animate-pulse" />;
  }

  return (
    <div dir="rtl" className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold">מילות חיפוש</h2>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={page2only}
              onChange={(e) => setPage2only(e.target.checked)}
              className="w-4 h-4 accent-pink"
            />
            רק הזדמנויות (עמוד 2)
          </label>
          <button
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="text-xs text-cyan hover:text-cyan/80 disabled:opacity-50 underline-offset-2 hover:underline"
          >
            ייצוא CSV
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="bg-gray-900 border border-gray-700 rounded-2xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-800/50 border-b border-gray-700">
              <tr>
                <Th label="מילה" k="query" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <Th label="קליקים" k="clicks" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <Th label="הופעות" k="impressions" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <Th label="CTR" k="ctr" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <Th label="מיקום" k="position" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <th className="text-right text-gray-400 font-medium px-3 py-2.5">דף</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/30">
                  <td className="px-3 py-2 text-white">{r.query}</td>
                  <td className="px-3 py-2 text-gray-300 font-mono">{r.clicks.toLocaleString("he-IL")}</td>
                  <td className="px-3 py-2 text-gray-300 font-mono">{r.impressions.toLocaleString("he-IL")}</td>
                  <td className="px-3 py-2 text-gray-300 font-mono">{(r.ctr * 100).toFixed(1)}%</td>
                  <td className={`px-3 py-2 font-mono ${positionColor(r.position)}`}>
                    {r.position.toFixed(1)}
                  </td>
                  <td className="px-3 py-2 text-gray-500 text-xs">{shortPath(r.topPage)}</td>
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
