"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

interface Row {
  id: string;
  sellerId: string;
  sellerName: string;
  agreementId: string;
  clientName: string;
  amount: number;
  status: "PENDING" | "PAID";
  paidAt: string | null;
  briefTaskId: string | null;
  createdAt: string;
}

interface SellerSummary {
  sellerId: string;
  sellerName: string;
  pending: number;
  paid: number;
  count: number;
}

const fmt = (n: number) => n.toLocaleString("he-IL", { maximumFractionDigits: 0 });

export default function AdminSellersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [sellers, setSellers] = useState<SellerSummary[]>([]);
  const [totalPending, setTotalPending] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/sellers/commissions", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setRows(json.rows ?? []);
      setSellers(json.sellers ?? []);
      setTotalPending(json.totalPending ?? 0);
    } catch {
      toast.error("שגיאה בטעינת העמלות");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = async (row: Row) => {
    const next = row.status === "PAID" ? "PENDING" : "PAID";
    setBusy(row.id);
    try {
      const res = await fetch(`/api/sellers/commissions/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error();
      toast.success(next === "PAID" ? "סומן כשולם" : "הוחזר לממתין");
      load();
    } catch {
      toast.error("שגיאה");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div dir="rtl" className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">מוכרים — עמלות</h1>
        <p className="text-xs text-gray-500 mt-1 max-w-xl">
          עמלה = התשלום החודשי של החודש הראשון, נרשמת אוטומטית כשעסקה של מוכר/ת
          מאושרת בתשלום. סמן &quot;שולם&quot; אחרי שהעברת את העמלה.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-2xl p-4 border bg-pink/15 border-pink/40">
          <div className="text-[11px] text-gray-400 mb-1">סה״כ לתשלום למוכרים</div>
          <div className="text-2xl font-bold font-mono text-pink">{fmt(totalPending)} ₪</div>
        </div>
        {sellers.map((s) => (
          <div key={s.sellerId} className="rounded-2xl p-4 border bg-gray-900 border-gray-700">
            <div className="text-[11px] text-gray-400 mb-1 truncate">{s.sellerName}</div>
            <div className="text-xl font-bold font-mono text-white">{fmt(s.pending)} ₪</div>
            <div className="text-[10px] text-gray-500 mt-0.5">ממתין · {s.count} עסקאות</div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-12 text-center text-sm text-gray-500">טוען...</div>
      ) : rows.length === 0 ? (
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-12 text-center text-sm text-gray-500">
          אין עדיין עמלות רשומות
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-700">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-800 border-b border-gray-700 text-gray-400">
                <th className="text-right font-medium px-3 py-2.5">מוכר/ת</th>
                <th className="text-right font-medium px-3 py-2.5">לקוח</th>
                <th className="text-right font-medium px-3 py-2.5 w-28">עמלה (₪)</th>
                <th className="text-right font-medium px-3 py-2.5 w-28">תאריך</th>
                <th className="text-right font-medium px-3 py-2.5 w-20">בריף</th>
                <th className="text-right font-medium px-3 py-2.5 w-32">סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-800 hover:bg-gray-800/40">
                  <td className="px-3 py-2 text-white">{r.sellerName}</td>
                  <td className="px-3 py-2 text-gray-300">{r.clientName}</td>
                  <td className="px-3 py-2 font-mono text-pink">{fmt(r.amount)}</td>
                  <td className="px-3 py-2 text-gray-400 text-xs">{new Date(r.createdAt).toLocaleDateString("he-IL")}</td>
                  <td className="px-3 py-2">
                    {r.briefTaskId ? (
                      <a href={`/admin/tasks/${r.briefTaskId}`} className="text-cyan hover:underline text-xs">פתח</a>
                    ) : (
                      <span className="text-gray-600 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => toggle(r)}
                      disabled={busy === r.id}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 ${
                        r.status === "PAID"
                          ? "bg-green-500/15 text-green-400 hover:bg-green-500/25"
                          : "bg-amber-500/15 text-amber-400 hover:bg-amber-500/25"
                      }`}
                    >
                      {r.status === "PAID" ? "שולם ✓" : "סמן כשולם"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
