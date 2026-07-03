"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";

interface Commission {
  amount: number;
  status: "PENDING" | "PAID";
  briefTaskId: string | null;
}

interface Deal {
  id: string;
  tier: string | null;
  monthlyPrice: number;
  customerName: string;
  businessName: string | null;
  phone: string;
  status: string;
  paymentStatus: string;
  signToken: string;
  paidAmount: number | null;
  createdAt: string;
  commission: Commission | null;
}

const fmt = (n: number) => n.toLocaleString("he-IL", { maximumFractionDigits: 0 });

const PAYMENT_LABEL: Record<string, string> = {
  PENDING: "טרם שולם",
  SENT: "נשלח לתשלום",
  COMPLETED: "שולם ✓",
  FAILED: "נכשל",
  CANCELLED: "בוטל",
};

export default function SellerSalesPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/seller/agreements", { cache: "no-store" });
      if (res.ok) setDeals((await res.json()).data ?? []);
    } catch {
      toast.error("שגיאה בטעינה");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const copySign = async (token: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/agreement/${token}`);
      toast.success("קישור החתימה הועתק");
    } catch {
      toast.error("העתקה נכשלה");
    }
  };

  return (
    <div dir="rtl" className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">העסקאות שלי</h1>
        <button onClick={load} className="text-sm text-gray-400 hover:text-white border border-gray-700 rounded-xl px-3 py-1.5">
          רענן
        </button>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-16">טוען...</div>
      ) : deals.length === 0 ? (
        <div className="text-center text-gray-500 py-16">
          עדיין אין עסקאות. <Link href="/seller/agreements/new" className="text-pink hover:underline">הוצא חוזה ראשון</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {deals.map((d) => {
            const paid = d.paymentStatus === "COMPLETED";
            return (
              <div key={d.id} className="bg-gray-900 border border-gray-700 rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-bold text-white">
                      {d.customerName}
                      {d.businessName ? <span className="text-gray-500 font-normal"> · {d.businessName}</span> : null}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {fmt(d.monthlyPrice)} ₪ / חודש · {new Date(d.createdAt).toLocaleDateString("he-IL")}
                    </div>
                  </div>
                  <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold ${paid ? "bg-green-500/15 text-green-400" : "bg-gray-700 text-gray-300"}`}>
                    {PAYMENT_LABEL[d.paymentStatus] ?? d.paymentStatus}
                  </span>
                </div>

                {paid && d.commission ? (
                  <div className="flex items-center justify-between gap-3 flex-wrap border-t border-gray-800 pt-3">
                    <div className="text-sm">
                      <span className="text-gray-400">עמלה: </span>
                      <span className="font-mono font-bold text-pink">{fmt(d.commission.amount)} ₪</span>
                      <span className={`mr-2 text-[11px] px-2 py-0.5 rounded-full ${d.commission.status === "PAID" ? "bg-green-500/15 text-green-400" : "bg-amber-500/15 text-amber-400"}`}>
                        {d.commission.status === "PAID" ? "שולם לך" : "ממתין לתשלום"}
                      </span>
                    </div>
                    {d.commission.briefTaskId ? (
                      <span className="text-xs font-bold text-green-400">דוח למפתח נשלח ✓</span>
                    ) : (
                      <Link
                        href={`/seller/report/${d.id}`}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-pink hover:bg-pink-dark text-white transition-colors"
                      >
                        📋 מלא דוח למפתח
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 border-t border-gray-800 pt-3">
                    <button
                      onClick={() => copySign(d.signToken)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-gray-800 text-white hover:bg-gray-700 transition-colors"
                    >
                      העתק קישור חתימה
                    </button>
                    <a
                      href={`https://wa.me/${d.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`היי, קישור לחתימה על ההסכם: ${typeof window !== "undefined" ? window.location.origin : ""}/agreement/${d.signToken}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-green-600/20 text-green-400 hover:bg-green-600/30 transition-colors"
                    >
                      שלח ללקוח
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
