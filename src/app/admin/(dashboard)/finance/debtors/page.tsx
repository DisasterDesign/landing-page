"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import PullToRefresh from "@/components/ui/PullToRefresh";

interface ProblemCharge {
  id: string;
  amount: number;
  status: string | null;
  responseCode: number | null;
  billingAttempts: number | null;
  cardcomChargeDate: string | null;
  chargedAt: string;
  invoiceNumber: string | null;
  agreement: {
    id: string;
    customerName: string;
    businessName: string | null;
    monthlyPrice: number;
    cardcomIsActive: boolean | null;
    cardcomNextBillDate: string | null;
    client: { id: string; name: string; number: number } | null;
  };
}

interface InactiveOrder {
  id: string;
  customerName: string;
  businessName: string | null;
  monthlyPrice: number;
  cardcomNextBillDate: string | null;
  cardcomSyncedAt: string | null;
  client: { id: string; name: string; number: number; monthlyAmount: number | null } | null;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  DEBTAUTOBILLING: { label: "בגבייה אוטומטית", cls: "bg-amber-500/15 text-amber-400" },
  LOSTDEBT: { label: "חוב אבוד", cls: "bg-red-500/15 text-red-400" },
  ONHOLD: { label: "מוקפא", cls: "bg-orange-500/15 text-orange-400" },
  PAYBYOTHERE: { label: "שולם אחרת", cls: "bg-blue-500/15 text-blue-400" },
  PENDINGFORPROCESSING: { label: "ממתין לעיבוד", cls: "bg-gray-500/15 text-gray-300" },
  SUCCESSFUL: { label: "הצליח", cls: "bg-green-500/15 text-green-400" },
};

function statusChip(status: string | null, success?: boolean) {
  const s = status
    ? STATUS_LABEL[status] ?? { label: status, cls: "bg-gray-500/15 text-gray-300" }
    : success === false
      ? { label: "נכשל (webhook)", cls: "bg-red-500/15 text-red-400" }
      : { label: "-", cls: "text-gray-500" };
  return <span className={`inline-block text-[11px] px-2 py-0.5 rounded-full ${s.cls}`}>{s.label}</span>;
}

const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString("he-IL") : "-");
const fmtNum = (n: number) =>
  n.toLocaleString("he-IL", { minimumFractionDigits: 0, maximumFractionDigits: 1 });

export default function DebtorsPage() {
  const [problemCharges, setProblemCharges] = useState<ProblemCharge[]>([]);
  const [inactiveOrders, setInactiveOrders] = useState<InactiveOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/finance/debtors");
      if (!res.ok) throw new Error();
      const json = await res.json();
      setProblemCharges(json.problemCharges ?? []);
      setInactiveOrders(json.inactiveOrders ?? []);
    } catch {
      toast.error("שגיאה בטעינת דוח חייבים");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-pink border-t-transparent rounded-full" />
      </div>
    );
  }

  const clean = problemCharges.length === 0 && inactiveOrders.length === 0;

  return (
    <PullToRefresh onRefresh={fetchData}>
      <div dir="rtl" className="p-4 md:p-6 max-w-5xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">דוח חייבים</h1>
          <p className="text-sm text-gray-400 mt-1">
            מסונכרן מול קארדקום פעם ביום (05:30) + עדכונים בזמן אמת מה-webhook.
          </p>
        </div>

        {clean ? (
          <div className="rounded-2xl border border-green-500/30 bg-green-500/5 p-8 text-center">
            <div className="text-3xl mb-2">✅</div>
            <p className="text-green-400 font-bold">אין חובות פתוחים</p>
            <p className="text-sm text-gray-400 mt-1">
              כל החיובים עברו וכל הוראות הקבע שקארדקום מכירה פעילות.
            </p>
          </div>
        ) : null}

        {inactiveOrders.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-bold text-white mb-3">
              הוראות קבע לא פעילות{" "}
              <span className="text-sm font-normal text-gray-400">
                ({inactiveOrders.length}) — הלקוח בספרים אבל קארדקום לא תחייב אותו
              </span>
            </h2>
            <div className="overflow-x-auto rounded-lg border border-gray-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-800 border-b border-gray-700 text-right text-gray-400">
                    <th className="px-3 py-2.5 font-medium">לקוח</th>
                    <th className="px-3 py-2.5 font-medium">הסכם ע״ש</th>
                    <th className="px-3 py-2.5 font-medium">חודשי (₪)</th>
                    <th className="px-3 py-2.5 font-medium">חיוב הבא שתוכנן</th>
                    <th className="px-3 py-2.5 font-medium">נבדק לאחרונה</th>
                  </tr>
                </thead>
                <tbody>
                  {inactiveOrders.map((o) => (
                    <tr key={o.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                      <td className="px-3 py-2">
                        {o.client ? (
                          <Link href={`/admin/clients/${o.client.id}`} className="text-pink hover:underline">
                            #{o.client.number} {o.client.name}
                          </Link>
                        ) : (
                          <span className="text-gray-500">ללא לקוח</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-300">
                        {o.customerName}
                        {o.businessName ? ` · ${o.businessName}` : ""}
                      </td>
                      <td className="px-3 py-2 font-mono text-white">{fmtNum(o.monthlyPrice)}</td>
                      <td className="px-3 py-2 text-gray-300">{fmtDate(o.cardcomNextBillDate)}</td>
                      <td className="px-3 py-2 text-gray-500">{fmtDate(o.cardcomSyncedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {problemCharges.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-white mb-3">
              חיובים בעייתיים{" "}
              <span className="text-sm font-normal text-gray-400">({problemCharges.length})</span>
            </h2>
            <div className="overflow-x-auto rounded-lg border border-gray-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-800 border-b border-gray-700 text-right text-gray-400">
                    <th className="px-3 py-2.5 font-medium">לקוח</th>
                    <th className="px-3 py-2.5 font-medium">סכום (₪)</th>
                    <th className="px-3 py-2.5 font-medium">סטטוס</th>
                    <th className="px-3 py-2.5 font-medium">קוד דחייה</th>
                    <th className="px-3 py-2.5 font-medium">ניסיונות</th>
                    <th className="px-3 py-2.5 font-medium">תאריך חיוב</th>
                  </tr>
                </thead>
                <tbody>
                  {problemCharges.map((c) => (
                    <tr key={c.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                      <td className="px-3 py-2">
                        {c.agreement.client ? (
                          <Link
                            href={`/admin/clients/${c.agreement.client.id}`}
                            className="text-pink hover:underline"
                          >
                            #{c.agreement.client.number} {c.agreement.client.name}
                          </Link>
                        ) : (
                          <span className="text-gray-300">{c.agreement.customerName}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-white">{fmtNum(c.amount)}</td>
                      <td className="px-3 py-2">{statusChip(c.status, false)}</td>
                      <td className="px-3 py-2 font-mono text-gray-300">{c.responseCode ?? "-"}</td>
                      <td className="px-3 py-2 font-mono text-gray-300">{c.billingAttempts ?? "-"}</td>
                      <td className="px-3 py-2 text-gray-300">
                        {fmtDate(c.cardcomChargeDate ?? c.chargedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-gray-500 mt-2">
              טיפול בחוב (חיוב ידני, עדכון כרטיס, העברה לגבייה) נעשה בדשבורד קארדקום — הוראת
              קבע ← מעקב חייבים.
            </p>
          </section>
        )}
      </div>
    </PullToRefresh>
  );
}
