"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import PushNotificationToggle from "@/components/admin/PushNotificationToggle";

interface CommissionSummary {
  count: number;
  totalPending: number;
  totalPaid: number;
  total: number;
}

interface AgreementLite {
  id: string;
  customerName: string;
  paymentStatus: string;
  commission: { briefTaskId: string | null } | null;
}

interface DueFollowUp {
  id: string;
  dueAt: string;
  reason: string;
  leadId: string;
  leadName: string;
  url: string;
}

const fmt = (n: number) => n.toLocaleString("he-IL", { maximumFractionDigits: 0 });

export default function SellerDashboard() {
  const [summary, setSummary] = useState<CommissionSummary | null>(null);
  const [openDeals, setOpenDeals] = useState(0);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [pendingReports, setPendingReports] = useState<AgreementLite[]>([]);
  const [dueFollowUps, setDueFollowUps] = useState<DueFollowUp[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [cRes, aRes, meRes, followUpsRes] = await Promise.all([
          fetch("/api/seller/commissions", { cache: "no-store" }),
          fetch("/api/seller/agreements", { cache: "no-store" }),
          fetch("/api/seller/me", { cache: "no-store" }),
          fetch("/api/seller/follow-ups", { cache: "no-store" }),
        ]);
        if (cRes.ok) setSummary((await cRes.json()).summary);
        if (aRes.ok) {
          const { data } = (await aRes.json()) as { data: AgreementLite[] };
          // "Open" = still actionable (awaiting payment), not failed/cancelled/paid.
          setOpenDeals(
            data.filter((a) => a.paymentStatus === "PENDING" || a.paymentStatus === "SENT").length
          );
          // Paid deals still waiting for the developer report
          setPendingReports(
            data.filter((a) => a.paymentStatus === "COMPLETED" && a.commission && !a.commission.briefTaskId)
          );
        }
        if (meRes.ok) {
          setMustChangePassword((await meRes.json()).mustChangePassword ?? false);
        }
        if (followUpsRes.ok) {
          setDueFollowUps((await followUpsRes.json()).followUps ?? []);
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

      {pendingReports.map((a) => (
        <Link
          key={a.id}
          href={`/seller/report/${a.id}`}
          className="block bg-pink/15 border border-pink/40 rounded-2xl p-4 hover:bg-pink/25 transition-colors"
        >
          <span className="font-bold text-pink">📋 העסקה עם {a.customerName} שולמה!</span>
          <span className="text-sm text-pink/80 mr-2">לחצו כאן למילוי דוח למפתח — כדי שאלעד יתחיל לעבוד</span>
        </Link>
      ))}

      {dueFollowUps.length > 0 && (
        <section className="rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4">
          <h2 className="font-bold text-amber-200">
            פולואפים שהגיע זמנם ({dueFollowUps.length})
          </h2>
          <div className="mt-3 space-y-2">
            {dueFollowUps.slice(0, 5).map((followUp) => (
              <Link
                key={followUp.id}
                href={followUp.url}
                className="flex flex-col gap-1 rounded-xl border border-amber-400/20 bg-gray-900/60 p-3 transition hover:border-amber-300/40 sm:flex-row sm:items-center sm:justify-between"
              >
                <span>
                  <strong className="text-white">{followUp.leadName}</strong>
                  <span className="mr-2 text-sm text-gray-300">
                    {followUp.reason}
                  </span>
                </span>
                <time className="text-xs text-amber-200">
                  {new Date(followUp.dueAt).toLocaleString("he-IL")}
                </time>
              </Link>
            ))}
          </div>
        </section>
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
          href="/seller/leads"
          className="bg-gray-900 hover:bg-gray-800 border border-gray-700 text-white font-bold rounded-2xl p-5 text-center transition-colors"
        >
          📝 המשך מליד מוכשר לחוזה
        </Link>
        <Link
          href="/seller/sales"
          className="bg-gray-900 hover:bg-gray-800 border border-gray-700 text-white font-bold rounded-2xl p-5 text-center transition-colors"
        >
          💰 העסקאות שלי
        </Link>
      </div>

      {/* Push notifications — get pinged on every new lead */}
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-5">
        <h2 className="text-base font-bold text-white mb-1">🔔 התראות על לידים חדשים</h2>
        <p className="text-xs text-gray-400 mb-3">
          הפעילו התראות במכשיר הזה כדי לקבל פוש ברגע שנכנס ליד חדש.
        </p>
        <PushNotificationToggle />
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
