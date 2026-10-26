"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import PullToRefresh from "@/components/ui/PullToRefresh";
import { confirmDanger } from "@/components/ui/ConfirmSheet";
import { createDebtorMutationGuard, debtorRowKey, hasDebtorSnapshot, moveDebtor, type DebtorLists, type DismissedDebtor } from "@/lib/debtor-dismissal";

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
  const [debtorLists, setDebtorLists] = useState<DebtorLists>({ terminalDebtors: [], settledDebtors: [], dismissedDebtors: [] });
  const { terminalDebtors, settledDebtors, dismissedDebtors } = debtorLists;
  const [pendingKeys, setPendingKeys] = useState<string[]>([]);
  const [mutations] = useState(() => createDebtorMutationGuard(setPendingKeys));
  const [showDismissed, setShowDismissed] = useState(false);
  const [snapshotUpdatedAt, setSnapshotUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const autoRefreshed = useRef(false);

  const refreshFromCardcom = useCallback(async (silent = false) => {
    const revision = mutations.snapshot();
    setRefreshing(true);
    try {
      const res = await fetch("/api/finance/debtors/refresh", { method: "POST" });
      if (!res.ok) throw new Error();
      const json = await res.json();
      if (mutations.canCommit(revision)) {
        setDebtorLists({ terminalDebtors: json.terminalDebtors ?? [], settledDebtors: json.settledDebtors ?? [], dismissedDebtors: json.dismissedDebtors ?? [] });
        setSnapshotUpdatedAt(json.snapshotUpdatedAt ?? null);
      }
      if (!silent) toast.success("עודכן מול קארדקום");
    } catch {
      if (!silent) toast.error("שגיאה ברענון מול קארדקום");
    } finally {
      setRefreshing(false);
    }
  }, [mutations]);

  const fetchData = useCallback(async () => {
    const revision = mutations.snapshot();
    try {
      const res = await fetch("/api/finance/debtors");
      if (!res.ok) throw new Error();
      const json = await res.json();
      setProblemCharges(json.problemCharges ?? []);
      setInactiveOrders(json.inactiveOrders ?? []);
      if (mutations.canCommit(revision)) {
        setDebtorLists({ terminalDebtors: json.terminalDebtors ?? [], settledDebtors: json.settledDebtors ?? [], dismissedDebtors: json.dismissedDebtors ?? [] });
        setSnapshotUpdatedAt(json.snapshotUpdatedAt ?? null);
      }

      // Self-updating: a snapshot older than an hour silently re-pulls from
      // Cardcom on entry, so the screen shows the debt as it is NOW rather
      // than as it was at the 05:30 cron. Once per mount — not per re-render.
      const updated = json.snapshotUpdatedAt ? new Date(json.snapshotUpdatedAt).getTime() : 0;
      if (!autoRefreshed.current && Date.now() - updated > 60 * 60 * 1000) {
        autoRefreshed.current = true;
        refreshFromCardcom(true);
      }
    } catch {
      toast.error("שגיאה בטעינת דוח חייבים");
    } finally {
      setLoading(false);
    }
  }, [refreshFromCardcom, mutations]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const setDebtorDismissed = async (d: DismissedDebtor, dismissed: boolean): Promise<boolean> => {
    let savedDebtor = d;
    try {
      return await mutations.run(debtorRowKey(d), async () => {
        if (dismissed && !await confirmDanger({
          title: `להסתיר את ${d.name}?`,
          message: "החייב יועבר לרשימת המוסתרים וההתראות עליו ייפסקו. ההסתרה לא מוחקת את החוב ולא משנה חיובים בקארדקום. אפשר לשחזר בכל עת.",
          confirmLabel: "הסתר והפסק התראות",
          cancelLabel: "השאר ברשימה",
          dangerous: false,
        })) return false;
        const res = await fetch("/api/finance/debtors/dismiss", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: debtorRowKey(d), dismissed }),
        });
        if (!res.ok) throw new Error();
        const json = await res.json();
        // A sweep may have settled this row while the page was open.
        savedDebtor = json.debtor ?? d;
      }, () => {
        setDebtorLists((prev) => moveDebtor(prev, savedDebtor, dismissed));
        if (dismissed) {
          toast((t) => (
            <div dir="rtl" className="flex items-center gap-3">
              <span>{d.name} הוסתר. החוב לא נמחק.</span>
              <button
                className="font-bold text-cyan underline whitespace-nowrap"
                onClick={() => void setDebtorDismissed(savedDebtor, false).then((saved) => { if (saved) toast.dismiss(t.id); })}
              >
                בטל הסתרה
              </button>
            </div>
          ), { duration: 10_000 });
        } else toast.success(hasDebtorSnapshot(savedDebtor) ? "שוחזר לרשימה" : "ההסתרה הוסרה; אין נתון עדכני בחלון הסריקה");
      });
    } catch {
      toast.error("השמירה נכשלה. הרשימה לא השתנתה — אפשר לנסות שוב.");
      return false;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-pink border-t-transparent rounded-full" />
      </div>
    );
  }

  const clean =
    problemCharges.length === 0 && inactiveOrders.length === 0 && terminalDebtors.length === 0 && dismissedDebtors.length === 0;
  const totalDebt = terminalDebtors.reduce((s, d) => s + d.amount, 0);

  return (
    <PullToRefresh onRefresh={fetchData}>
      <div dir="rtl" className="p-4 md:p-6 max-w-5xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">דוח חייבים</h1>
            <p className="text-sm text-gray-400 mt-1">
              מתעדכן אוטומטית: סנכרון יומי (05:30), רענון בכניסה למסך כשהנתונים
              בני יותר משעה, ועדכוני webhook בזמן אמת.
            </p>
          </div>
          <button
            onClick={() => refreshFromCardcom()}
            disabled={refreshing || pendingKeys.length > 0}
            className="flex items-center gap-2 px-4 py-2 border border-gray-700 hover:border-cyan text-gray-300 hover:text-cyan rounded-lg transition-colors text-sm font-medium disabled:opacity-50"
          >
            <svg
              className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {refreshing ? "מרענן מול קארדקום..." : "רענן מול קארדקום"}
          </button>
        </div>

        {dismissedDebtors.length > 0 && (
          <section className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-amber-300">חייבים מוסתרים ({dismissedDebtors.length})</h2>
                <p className="text-sm text-gray-300 mt-1">הסתרה מפסיקה התראות בלבד. היא לא מעידה שהחוב שולם. אפשר לשחזר כל חייב בנפרד.</p>
              </div>
              <button
                onClick={() => setShowDismissed((v) => !v)}
                aria-expanded={showDismissed}
                aria-controls="dismissed-debtors"
                className="px-4 py-2 rounded-lg bg-amber-500/15 text-amber-200 hover:bg-amber-500/25 font-medium text-sm"
              >
                {showDismissed ? "סגור רשימת מוסתרים" : "הצג מוסתרים ושחזור"}
              </button>
            </div>
            {showDismissed && (
              <div id="dismissed-debtors" className="mt-4 overflow-x-auto rounded-lg border border-gray-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-800 text-right text-gray-300">
                      <th className="px-3 py-2 font-medium">שם בכרטיס</th>
                      <th className="px-3 py-2 font-medium">נתון אחרון בחלון הסריקה</th>
                      <th className="px-3 py-2 font-medium">פעולה</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dismissedDebtors.map((d) => (
                      <tr key={debtorRowKey(d)} className="border-t border-gray-800">
                        <td className="px-3 py-3 text-white">
                          {d.name}
                          {d.idNumber ? <span className="text-gray-400 text-xs mr-2">({d.idNumber})</span> : null}
                        </td>
                        <td className="px-3 py-3 text-gray-300">
                          {hasDebtorSnapshot(d) ? (
                            d.settledAt
                              ? `נסגר בתשלום ב-${fmtDate(d.settledAt)}`
                              : `חוב ₪${fmtNum(d.amount)} · ניסיון אחרון ${fmtDate(d.lastAttempt)}`
                          ) : "אין נתון עדכני בחלון הסריקה"}
                        </td>
                        <td className="px-3 py-3">
                          <button
                            onClick={() => void setDebtorDismissed(d, false)}
                            disabled={pendingKeys.includes(debtorRowKey(d))}
                            className="px-3 py-2 rounded-lg border border-cyan/40 text-cyan hover:bg-cyan/10 disabled:opacity-50 whitespace-nowrap"
                          >
                            {pendingKeys.includes(debtorRowKey(d)) ? "שומר..." : "שחזר לרשימה"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {clean ? (
          <div className="rounded-2xl border border-green-500/30 bg-green-500/5 p-8 text-center">
            <div className="text-3xl mb-2">✅</div>
            <p className="text-green-400 font-bold">אין חובות פתוחים</p>
            <p className="text-sm text-gray-400 mt-1">
              כל החיובים עברו וכל הוראות הקבע שקארדקום מכירה פעילות.
            </p>
          </div>
        ) : null}

        {terminalDebtors.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-bold text-white mb-1">
              חובות בגבייה אוטומטית{" "}
              <span className="text-sm font-normal text-gray-400">
                ({terminalDebtors.length} חייבים · ₪{fmtNum(totalDebt)})
              </span>
            </h2>
            <p className="text-xs text-gray-500 mb-3">
              סריקה רוחבית של כל הטרמינל — כולל הוראות קבע שנוצרו ידנית בדשבורד קארדקום.
              {snapshotUpdatedAt ? ` עודכן ${new Date(snapshotUpdatedAt).toLocaleString("he-IL")}.` : ""}
            </p>
            <div className="overflow-x-auto rounded-lg border border-gray-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-800 border-b border-gray-700 text-right text-gray-400">
                    <th className="px-3 py-2.5 font-medium">שם בכרטיס</th>
                    <th className="px-3 py-2.5 font-medium">חוב מצטבר (₪)</th>
                    <th className="px-3 py-2.5 font-medium">ניסיונות (45 יום)</th>
                    <th className="px-3 py-2.5 font-medium">ניסיון אחרון</th>
                    <th className="px-3 py-2.5 font-medium">סיבת הדחייה</th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {terminalDebtors.map((d) => (
                    <tr key={`${d.idNumber ?? d.name}`} className="border-b border-gray-800 hover:bg-gray-800/50 group">
                      <td className="px-3 py-2 text-white">
                        {d.name}
                        {d.idNumber ? <span className="text-gray-500 text-xs mr-2">({d.idNumber})</span> : null}
                      </td>
                      <td className="px-3 py-2 font-mono text-red-400 font-bold">{fmtNum(d.amount)}</td>
                      <td className="px-3 py-2 font-mono text-gray-300">{d.attempts}</td>
                      <td className="px-3 py-2 text-gray-300">{fmtDate(d.lastAttempt)}</td>
                      <td className="px-3 py-2 text-gray-400 text-xs max-w-[280px]">
                        {d.reason || `קוד ${d.responseCode}`}
                      </td>
                      <td className="px-2 py-2">
                        <button
                          onClick={() => void setDebtorDismissed(d, true)}
                          disabled={pendingKeys.includes(debtorRowKey(d))}
                          className="text-sm text-gray-300 hover:text-amber-300 px-3 py-2 rounded-lg border border-gray-700 hover:border-amber-500/50 transition-colors disabled:opacity-50 whitespace-nowrap"
                          aria-label={`הסתר את ${d.name} והפסק התראות`}
                        >
                          {pendingKeys.includes(debtorRowKey(d)) ? "שומר..." : "הסתר חייב"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {settledDebtors.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-bold text-white mb-1">
              נסגרו לאחרונה{" "}
              <span className="text-sm font-normal text-gray-400">
                ({settledDebtors.length})
              </span>
            </h2>
            <p className="text-xs text-gray-500 mb-3">
              היו בחוב, ואז נכנס תשלום מוצלח אחרי הניסיון הכושל האחרון. יוצגו כאן עד שהחוב
              הישן ייצא מחלון 45 הימים.
            </p>
            <div className="overflow-x-auto rounded-lg border border-gray-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-800/60 border-b border-gray-800 text-right text-gray-400">
                    <th className="px-3 py-2.5 font-medium">שם בכרטיס</th>
                    <th className="px-3 py-2.5 font-medium">שולם (₪)</th>
                    <th className="px-3 py-2.5 font-medium">תאריך תשלום</th>
                    <th className="px-3 py-2.5 font-medium">החוב שהיה</th>
                  </tr>
                </thead>
                <tbody>
                  {settledDebtors.map((d) => (
                    <tr key={`${d.idNumber ?? d.name}`} className="border-b border-gray-800/60">
                      <td className="px-3 py-2 text-gray-300">
                        {d.name}
                        {d.idNumber ? <span className="text-gray-600 text-xs mr-2">({d.idNumber})</span> : null}
                      </td>
                      <td className="px-3 py-2 font-mono text-green-400 font-bold">
                        {fmtNum(d.settledAmount ?? d.amount)}
                      </td>
                      <td className="px-3 py-2 text-gray-400">{fmtDate(d.settledAt ?? null)}</td>
                      <td className="px-3 py-2 font-mono text-gray-500 line-through">
                        {fmtNum(d.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}


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
