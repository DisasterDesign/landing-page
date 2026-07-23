"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";

interface Commission {
  amount: number;
  status: "PENDING" | "PAID";
  briefTaskId: string | null;
}

interface DealBase {
  id: string;
  tier: string | null;
  monthlyPrice: number;
  customerName: string;
  businessName: string | null;
  status: string;
  paymentStatus: string;
  paidAmount: number | null;
  createdAt: string;
  commission: Commission | null;
  lead: {
    id: string;
    intentLevel: "OUTBOUND" | "AD_RESPONSE" | "INBOUND" | null;
    sourceKey: string | null;
    stage: string | null;
  } | null;
}

type Deal = DealBase &
  (
    | { canManage: true; phone: string; signToken: string }
    | {
        canManage: false;
        phone?: never;
        signToken?: never;
      }
  );

const fmt = (n: number) => n.toLocaleString("he-IL", { maximumFractionDigits: 0 });

const PAYMENT_LABEL: Record<string, string> = {
  PENDING: "טרם שולם",
  SENT: "נשלח לתשלום",
  COMPLETED: "שולם ✓",
  FAILED: "נכשל",
  CANCELLED: "בוטל",
};

const INTENT_LABEL = {
  OUTBOUND: "פנייה קרה",
  AD_RESPONSE: "תגובה לפרסומת",
  INBOUND: "פנייה יזומה",
} as const;

export default function SellerSalesPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [markingSentId, setMarkingSentId] = useState<string | null>(null);

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
    setFocusId(new URLSearchParams(window.location.search).get("focus"));
    void load();
  }, [load]);

  useEffect(() => {
    if (!focusId || loading) return;
    requestAnimationFrame(() => {
      document
        .getElementById(`agreement-${focusId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [deals, focusId, loading]);

  const copySign = async (token: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/agreement/${token}`);
      toast.success("קישור החתימה הועתק");
    } catch {
      toast.error("העתקה נכשלה");
    }
  };

  const markSent = async (agreementId: string) => {
    setMarkingSentId(agreementId);
    try {
      const response = await fetch(`/api/agreements/${agreementId}/sent`, {
        method: "POST",
      });
      if (!response.ok) throw new Error();
      toast.success("החוזה סומן כנשלח");
      await load();
    } catch {
      toast.error("סימון השליחה נכשל");
    } finally {
      setMarkingSentId(null);
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
          עדיין אין עסקאות.{" "}
          <Link href="/seller/leads" className="text-pink hover:underline">
            המשך מליד מוכשר
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {deals.map((d) => {
            const paid = d.paymentStatus === "COMPLETED";
            return (
              <div
                id={`agreement-${d.id}`}
                key={d.id}
                className={`bg-gray-900 border rounded-2xl p-4 space-y-3 ${
                  focusId === d.id
                    ? "border-pink ring-2 ring-pink/30"
                    : "border-gray-700"
                }`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-bold text-white">
                      {d.customerName}
                      {d.businessName ? <span className="text-gray-500 font-normal"> · {d.businessName}</span> : null}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {fmt(d.monthlyPrice)} ₪ / חודש · {new Date(d.createdAt).toLocaleDateString("he-IL")}
                    </div>
                    {d.canManage && d.lead && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                        {d.lead.intentLevel && (
                          <span className="rounded-full bg-cyan/15 px-2 py-0.5 font-bold text-cyan">
                            {INTENT_LABEL[d.lead.intentLevel]}
                          </span>
                        )}
                        {d.lead.sourceKey && (
                          <span className="text-gray-500">{d.lead.sourceKey}</span>
                        )}
                        {d.lead.stage && (
                          <span className="text-gray-400">{d.lead.stage}</span>
                        )}
                        <Link
                          href={`/seller/leads/${d.lead.id}`}
                          className="font-bold text-pink hover:underline"
                        >
                          פתח ליד
                        </Link>
                      </div>
                    )}
                  </div>
                  <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold ${paid ? "bg-green-500/15 text-green-400" : "bg-gray-700 text-gray-300"}`}>
                    {PAYMENT_LABEL[d.paymentStatus] ?? d.paymentStatus}
                  </span>
                  {!d.canManage && (
                    <span className="text-[11px] rounded-full bg-gray-800 px-2.5 py-1 font-bold text-gray-400">
                      לצפייה בלבד
                    </span>
                  )}
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
                ) : d.canManage ? (
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
                    {d.status === "DRAFT" && (
                      <button
                        type="button"
                        disabled={markingSentId === d.id}
                        onClick={() => markSent(d.id)}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold border border-cyan/40 bg-cyan/10 text-cyan hover:bg-cyan/20 transition-colors disabled:opacity-50"
                      >
                        {markingSentId === d.id
                          ? "מסמן..."
                          : "סמן כנשלח"}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="border-t border-gray-800 pt-3 text-xs text-gray-500">
                    הטיפול בהסכם עבר לבעלים הנוכחי של הליד.
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
