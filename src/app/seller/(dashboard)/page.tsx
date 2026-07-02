"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";

interface CommissionSummary {
  count: number;
  totalPending: number;
  totalPaid: number;
  total: number;
}

interface AgreementLite {
  id: string;
  paymentStatus: string;
}

const fmt = (n: number) => n.toLocaleString("he-IL", { maximumFractionDigits: 0 });

export default function SellerDashboard() {
  const [summary, setSummary] = useState<CommissionSummary | null>(null);
  const [openDeals, setOpenDeals] = useState(0);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [cRes, aRes, meRes] = await Promise.all([
          fetch("/api/seller/commissions", { cache: "no-store" }),
          fetch("/api/seller/agreements", { cache: "no-store" }),
          fetch("/api/seller/me", { cache: "no-store" }),
        ]);
        if (cRes.ok) setSummary((await cRes.json()).summary);
        if (aRes.ok) {
          const { data } = (await aRes.json()) as { data: AgreementLite[] };
          // "Open" = still actionable (awaiting payment), not failed/cancelled/paid.
          setOpenDeals(
            data.filter((a) => a.paymentStatus === "PENDING" || a.paymentStatus === "SENT").length
          );
        }
        if (meRes.ok) {
          setMustChangePassword((await meRes.json()).mustChangePassword ?? false);
        }
      } catch {
        toast.error("שגיאה בטעינת הנתונים");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div dir="rtl" className="space-y-6">
      {mustChangePassword && (
        <Link
          href="/seller/password"
          className="block bg-amber-500/15 border border-amber-500/40 rounded-2xl p-4 hover:bg-amber-500/25 transition-colors"
        >
          <span className="font-bold text-amber-400">🔑 את/ה עדיין על סיסמת ההתחלה</span>
          <span className="text-sm text-amber-300/80 mr-2">
            לחצו כאן לבחירת סיסמה אישית חדשה
          </span>
        </Link>
      )}

      <div>
        <h1 className="text-2xl font-bold text-white">שלום 👋</h1>
        <p className="text-sm text-gray-400 mt-1">
          קח ליד מהרשימה, סגור עסקה והוצא חוזה — והעמלה נרשמת אוטומטית כשהלקוח משלם.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card label="עמלות שנסגרו" value={summary ? fmt(summary.total) + " ₪" : "—"} loading={loading} />
        <Card label="ממתין לתשלום" value={summary ? fmt(summary.totalPending) + " ₪" : "—"} accent loading={loading} />
        <Card label="כבר שולם לי" value={summary ? fmt(summary.totalPaid) + " ₪" : "—"} loading={loading} />
        <Card label="עסקאות פתוחות" value={loading ? "—" : String(openDeals)} loading={loading} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link
          href="/seller/leads"
          className="bg-pink hover:bg-pink-dark text-white font-bold rounded-2xl p-5 text-center transition-colors"
        >
          📋 לטיפול בלידים
        </Link>
        <Link
          href="/seller/agreements/new"
          className="bg-gray-900 hover:bg-gray-800 border border-gray-700 text-white font-bold rounded-2xl p-5 text-center transition-colors"
        >
          📝 הוצאת חוזה חדש
        </Link>
        <Link
          href="/seller/sales"
          className="bg-gray-900 hover:bg-gray-800 border border-gray-700 text-white font-bold rounded-2xl p-5 text-center transition-colors"
        >
          💰 העסקאות שלי
        </Link>
      </div>
    </div>
  );
}

function Card({
  label,
  value,
  accent,
  loading,
}: {
  label: string;
  value: string;
  accent?: boolean;
  loading?: boolean;
}) {
  return (
    <div className={`rounded-2xl p-4 border ${accent ? "bg-pink/15 border-pink/40" : "bg-gray-900 border-gray-700"}`}>
      <div className="text-[11px] text-gray-400 mb-1">{label}</div>
      <div className={`text-xl md:text-2xl font-bold font-mono ${accent ? "text-pink" : "text-gray-100"}`}>
        {loading ? <span className="inline-block w-16 h-6 bg-gray-800 rounded animate-pulse" /> : value}
      </div>
    </div>
  );
}
