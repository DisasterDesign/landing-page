"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FinanceBookSelect, { type SelectableFinanceBook, FinanceBookBadge } from "@/components/admin/FinanceBookSelect";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  CATEGORY_LABELS,
  FREQUENCY_LABELS,
  USD_TO_ILS,
  EUR_TO_ILS,
} from "@/lib/finance";

interface FinanceSource {
  key: string;
  name: string;
  configured: boolean;
  kind: string;
  stale: boolean;
  state: { status: string; lastSuccessAt: string | null; error?: string | null } | null;
}

interface ExpenseRow {
  id: string;
  financeBook?: string;
  sharedBasisPoints?: number | null;
  allocationOnly?: boolean;
  paidById?: string | null;
  paidBy?: { name?: string };
  name: string;
  vendor: string;
  category: string;
  isFixed: boolean;
  amount: number;
  currency: string;
  frequency: string;
  clientId: string | null;
  client: { id: string; name: string; number: number } | null;
  notes: string | null;
  active: boolean;
  monthlyIls: number;
  amountIls: number;
}

interface ClientPnl {
  id: string;
  number: number;
  name: string;
  mrr: number;
  vat: number;
  cardcomFee: number;
  directExpenses: number;
  net: number;
  marginPct: number;
}

interface FinancePayload {
  viewer?: { isOwner: boolean };
  forecastUnvaluedCount?: number;
  books?: { personal?: { profit: number }; fuzion?: { profit: number } };
  personalProfit?: number;
  myProfit?: number;
  actualAllocation?: {myProfit:number;recordedPaymentCount?:number;unrecordedExpenseCount?:number;incomplete?:boolean;expenseCoverage?:string};
  oneOffAllocation?: {myProfit:number};
  actual?: { gross: number; profit: number; count: number; unvaluedCount: number };
  sync?: { status?: string; stale?: boolean; lastSuccessAt?: string | null };
  snapshotAt: string;
  bottomLine: {
    totalMrr: number;
    totalVat: number;
    totalCardcomFee: number;
    grossProfit: number;
    fixedMonthly: number;
    variableMonthly: number;
    totalExpensesMonthly: number;
    oneOffIncomeThisMonth: number;
    oneOffOutstanding: number;
    netProfit: number;
    partnerShareBeforeExpenses: number;
    partnerShareAfterExpenses: number;
    clientCount: number;
  };
  byCategory: Record<
    string,
    { total: number; fixed: number; variable: number; count: number }
  >;
  perClient: ClientPnl[];
  unknownAmounts: { id: string; name: string; vendor: string; notes: string | null }[];
  expenses: ExpenseRow[];
}

interface ClientOption {
  products?: { id: string; name: string; financeBook?: string }[];
  id: string;
  name: string;
  number: number;
}

const fmt = (n: number | null | undefined) =>
  n != null
    ? n.toLocaleString("he-IL", { minimumFractionDigits: 0, maximumFractionDigits: 0 })
    : "";

const CURRENCY_SIGN: Record<string, string> = { ILS: "₪", USD: "$", EUR: "€" };

const CATEGORY_COLORS: Record<string, string> = {
  LLM_API: "bg-purple-500",
  SERVERS: "bg-orange-500",
  HOSTING: "bg-blue-500",
  DOMAINS: "bg-teal-500",
  SAAS: "bg-cyan-600",
  PAYMENTS: "bg-yellow-500",
  ADVERTISING: "bg-red-500",
  PROFESSIONAL: "bg-lime-600",
  OTHER: "bg-gray-500",
};

const EMPTY_FORM = {
  name: "",
  vendor: "",
  category: "OTHER",
  isFixed: true,
  amount: "",
  currency: "ILS",
  frequency: "MONTHLY",
  clientId: "",
  clientProductId: "",
  financeBook: "SHARED" as SelectableFinanceBook,
  mixed: false,
  sharedPercent: "100",
  notes: "",
};

export default function FinancePage() {
  const requestGeneration = useRef(0);
  const [data, setData] = useState<FinancePayload | null>(null);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [book, setBook] = useState("");
  const [loadError, setLoadError] = useState(false);
  const isOwner = data?.viewer?.isOwner === true;
  const [paymentExpense, setPaymentExpense] = useState<ExpenseRow | null>(null);
  const [paymentForm, setPaymentForm] = useState({ paymentKey: "", amountIls: "", paidDate: "", reference: "" });
  const [paymentSaving, setPaymentSaving] = useState(false);
  const openPayment = (expense: ExpenseRow) => {
    const today = new Date();
    const paidDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    setPaymentExpense(expense);
    setPaymentForm({ paymentKey: crypto.randomUUID(), amountIls: "", paidDate, reference: "" });
  };
  const [sources, setSources] = useState<FinanceSource[]>([]);
  const [sourcesError, setSourcesError] = useState(false);
  const [refreshingSource, setRefreshingSource] = useState<string | null>(null);
  const loadSources = useCallback(async () => {
    try {
      const response = await fetch("/api/finance/sources", { cache: "no-store" });
      if (!response.ok) throw new Error();
      setSources((await response.json()).sources ?? []);
      setSourcesError(false);
    } catch { setSourcesError(true); }
  }, []);
  useEffect(() => { if (isOwner) void loadSources(); }, [isOwner, loadSources]);
  const refreshSource = async (key: string) => {
    setRefreshingSource(key);
    try {
      const response = await fetch("/api/finance/sources", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key }) });
      if (!response.ok) toast.error("עדכון המקור נכשל. מוצגים הנתונים האחרונים שנשמרו.");
      await loadSources();
    } catch { toast.error("לא ניתן לעדכן את המקור כרגע"); }
    finally { setRefreshingSource(null); }
  };

  const load = useCallback(async () => {
    const generation = ++requestGeneration.current;
    try {
      const res = await fetch(`/api/finance${book ? `?book=${book}` : ""}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const payload = await res.json();
      if (generation !== requestGeneration.current) return;
      setData(payload);
      setLoadError(false);
    } catch {
      if (generation !== requestGeneration.current) return;
      setLoadError(true);
      toast.error("שגיאה בטעינת נתוני הפיננסים");
    } finally {
      if (generation === requestGeneration.current) setLoading(false);
    }
  }, [book]);

  useEffect(() => {
    load();
    // Client list for the attribution dropdown
    (async () => {
      try {
        const res = await fetch("/api/clients", { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          const list = (Array.isArray(json) ? json : json.data ?? []) as ClientOption[];
          setClients(
            list
              .map((c) => ({ id: c.id, name: c.name, number: c.number, products: c.products }))
              .sort((a, b) => a.name.localeCompare(b.name, "he"))
          );
        }
      } catch {
        /* dropdown stays empty — attribution optional */
      }
    })();
  }, [load]);

  const submitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!form.name.trim() || !form.vendor.trim() || isNaN(amount) || amount < 0) {
      toast.error("שם, ספק וסכום תקין — חובה");
      return;
    }
    const sharedBasisPoints = Math.round(Number(form.sharedPercent) * 100);
    if (isOwner && form.mixed && (!Number.isFinite(sharedBasisPoints) || sharedBasisPoints < 0 || sharedBasisPoints > 10000)) {
      toast.error("אחוז משותף חייב להיות בין 0 ל־100");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          vendor: form.vendor.trim(),
          category: form.category,
          isFixed: form.isFixed,
          amount,
          currency: form.currency,
          frequency: form.frequency,
          clientId: form.clientId || null,
          clientProductId: form.clientProductId || null,
          ...(isOwner ? { financeBook: form.clientId ? form.financeBook : "SHARED", ...(form.mixed ? { sharedBasisPoints } : {}) } : {}),
          notes: form.notes.trim() || null,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("ההוצאה נוספה");
      setForm({ ...EMPTY_FORM });
      setShowAdd(false);
      await load();
    } catch {
      toast.error("שגיאה בהוספת ההוצאה");
    } finally {
      setSaving(false);
    }
  };

  const patchExpense = async (id: string, patch: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/expenses/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
      await load();
    } catch {
      toast.error("שגיאה בעדכון");
    }
  };

  const deleteExpense = async (id: string, name: string) => {
    if (!confirm(`למחוק את "${name}"?`)) return;
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("נמחק");
      await load();
    } catch {
      toast.error("שגיאה במחיקה");
    }
  };

  const submitPayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!paymentExpense) return;
    const amountIls = Number(paymentForm.amountIls);
    const paidAt = new Date(`${paymentForm.paidDate}T12:00:00`);
    if (!Number.isFinite(amountIls) || amountIls <= 0 || Number.isNaN(paidAt.getTime())) {
      toast.error("הזן סכום ששולם בפועל ותאריך תשלום תקין");
      return;
    }
    setPaymentSaving(true);
    try {
      const response = await fetch(`/api/expenses/${paymentExpense.id}/payments`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentKey: paymentForm.paymentKey, amountIls, paidAt: paidAt.toISOString(), reference: paymentForm.reference.trim() || undefined }),
      });
      if (!response.ok) {
        toast.error(response.status === 409 ? "מזהה התשלום כבר נשמר עם פרטים אחרים. בדוק את הרישום לפני ניסיון נוסף." : "רישום התשלום נכשל. בדוק את הסכום והתאריך ונסה שוב.");
        return;
      }
      const result = await response.json();
      toast.success(result.replay ? "התשלום כבר נרשם — לא נוצר רישום נוסף" : "התשלום נרשם");
      setPaymentExpense(null);
      await load();
    } catch { toast.error("לא התקבלה תשובה. אפשר לנסות שוב באותו טופס ללא רישום כפול."); }
    finally { setPaymentSaving(false); }
  };

  const bl = data?.bottomLine;

  const categoryRows = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.byCategory)
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.total - a.total);
  }, [data]);

  const maxCategory = categoryRows[0]?.total ?? 1;

  const pnlRows = useMemo(
    () => (data ? [...data.perClient].sort((a, b) => b.net - a.net) : []),
    [data]
  );

  if (loading) {
    return (
      <div dir="rtl" className="bg-gray-900 border border-gray-700 rounded-2xl p-12 text-center text-sm text-gray-500">
        טוען נתוני פיננסים...
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">פיננסים — הכנסות מול הוצאות</h1>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed max-w-2xl">
            תחזית חודשית לפי מוצרים פעילים, בנפרד מכסף שהתקבל בפועל. רווח משותף לאחר הוצאות מתחלק שווה בשווה. המרת מט״ח משוערת: $1 = ₪{USD_TO_ILS} · €1 = ₪{EUR_TO_ILS} (כולל עמלות המרה).
          </p>
        </div>
        <Link
          href="/admin/finance/debtors"
          className="px-4 py-2 border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors text-sm font-medium"
        >
          דוח חייבים
        </Link>
      </div>

      {isOwner && <label className="flex items-center gap-3 text-sm text-gray-400">תצוגה
        <select value={book || "combined"} onChange={(event) => setBook(event.target.value)} className={inputCls + " max-w-xs"}>
          <option value="combined">הכול</option><option value="personal">שלי בלבד</option><option value="fuzion">השותפות</option><option value="mine">החלק שלי</option>
        </select>
      </label>}
      {loadError && <p role="alert" className="text-sm text-amber-300">העדכון נכשל. {data ? "מוצגים הנתונים האחרונים שהתקבלו." : "אין נתונים זמינים כרגע."}</p>}
      {data?.sync && (data.sync.stale === true || data.sync.status !== "SUCCESS") && <p className="text-sm text-amber-300">התקבולים טרם סונכרנו במלואם. סנכרון מוצלח אחרון: {data.sync.lastSuccessAt ? new Date(data.sync.lastSuccessAt).toLocaleString("he-IL") : "טרם הושלם"}</p>}
      {data?.actual && <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card label="התקבל בפועל החודש (ברוטו)" value={data.actual.gross} />
        <Card label="תקבולים פחות מע״מ ועמלת סליקה משוערת" value={data.actual.profit} />
        {isOwner && <Card label="הרווח האישי הצפוי (שלי בלבד)" value={data.personalProfit} />}
        <Card label="הרווח החודשי הצפוי שלי" value={data.myProfit} highlight />
      </div>}
      {data?.actualAllocation && <div className="grid grid-cols-2 gap-3 mt-3">
        <Card label="החלק שלי מתקבולים לאחר תשלומי הוצאות מתועדים" value={data.actualAllocation.myProfit} />
        <Card label="החלק שלי מעבודות חד־פעמיות לאחר הוצאות" value={data.oneOffAllocation?.myProfit} />
      </div>}
      {data?.actualAllocation && <p className="text-xs text-gray-400">החלוקה כוללת רק הוצאות עם תשלום מתועד בפועל בחודש זה. התחזית החודשית נשארת בנפרד. עמלת הסליקה משוערת.</p>}
      {data?.actualAllocation && <p className="text-xs text-gray-400">תשלומי הוצאות מתועדים בחודש: {data.actualAllocation.recordedPaymentCount ?? "—"}{(data.actualAllocation.unrecordedExpenseCount ?? 0) > 0 && <span className="text-amber-300"> · ל־{data.actualAllocation.unrecordedExpenseCount} הוצאות טרם תועד תשלום; התמונה חלקית.</span>}</p>}
      {(data?.actual?.unvaluedCount ?? 0) > 0 && <p className="text-sm text-amber-300">{data?.actual?.unvaluedCount} תקבולים ללא שווי בשקלים אינם נכללים בסכומים. הדוח חלקי.</p>}
      {(data?.forecastUnvaluedCount ?? 0) > 0 && <p className="text-sm text-amber-300">{data?.forecastUnvaluedCount} מוצרים ללא סכום חודשי בשקלים אינם נכללים בתחזית. התחזית חלקית.</p>}
      {/* ===== Bottom line ===== */}
      <section className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card label={`תחזית הכנסות (MRR, ${bl?.clientCount ?? "—"} לקוחות)`} value={bl?.totalMrr} />
          <Card label="מע״מ + עמלת סליקה 2%" value={bl ? bl.totalVat + bl.totalCardcomFee : undefined} negative />
          <Card label="הוצאות חודשיות (קבועות + משתנות)" value={bl?.totalExpensesMonthly} negative />
          <Card label="רווח נקי צפוי / חודש" value={bl?.netProfit} highlight />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card small label="הוצאות קבועות" value={bl?.fixedMonthly} negative />
          <Card small label="הוצאות משתנות" value={bl?.variableMonthly} negative />
          <Card small label="מחצית הרווח המשותף לפני הוצאות" value={bl?.partnerShareBeforeExpenses} />
          <Card small label="מחצית הרווח המשותף אחרי הוצאות" value={bl?.partnerShareAfterExpenses} highlight />
        </div>
        {((bl?.oneOffIncomeThisMonth ?? 0) > 0 || (bl?.oneOffOutstanding ?? 0) > 0) && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card small label="הכנסה חד-פעמית שהתקבלה החודש (נטו)" value={bl?.oneOffIncomeThisMonth} />
            <Card small label="עבודות חד-פעמיות שחייבים לנו" value={bl?.oneOffOutstanding} />
            <a
              href="/admin/jobs"
              className="md:col-span-2 flex items-center justify-center rounded-2xl border border-gray-700 bg-gray-900 hover:border-pink text-sm text-gray-300 hover:text-white transition-colors p-4"
            >
              נהל עבודות חד-פעמיות ← כלול ברווח הנקי ובחלוקת השותפים
            </a>
          </div>
        )}
        {data && data.unknownAmounts.length > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/40 rounded-2xl p-4 text-sm text-amber-300">
            <span className="font-bold">⚠️ הוצאות עם סכום לא ידוע (לא נכללות בשורה התחתונה): </span>
            {data.unknownAmounts.map((u) => `${u.name} (${u.vendor})`).join(" · ")}
            <span className="text-amber-300/70"> — עדכן סכום בטבלה למטה כשיהיה בידך.</span>
          </div>
        )}
      </section>

      {isOwner && <section className="bg-gray-900 border border-gray-700 rounded-2xl p-5 space-y-3">
        <h2 className="font-bold text-white">מקורות הוצאות</h2>
        <p className="text-xs text-gray-500">נתוני שימוש משוערים מוצגים בנפרד מחשבוניות. מקור שלא מחובר דורש הזנת חשבונית ידנית.</p>
        {sourcesError && <p role="alert" className="text-sm text-amber-300">לא ניתן לטעון את מצב המקורות כרגע.</p>}
        <div className="grid md:grid-cols-2 gap-3">{sources.map((source) => <div key={source.key} className="border border-gray-800 rounded-xl p-3 space-y-1">
          <div className="flex items-center justify-between gap-2"><span className="text-sm text-white">{source.name}</span>{source.configured && <button disabled={refreshingSource !== null} onClick={() => refreshSource(source.key)} className="text-xs text-pink disabled:opacity-50">{refreshingSource === source.key ? "מעדכן…" : "עדכן"}</button>}</div>
          <p className={`text-xs ${(source.stale || (source.state && source.state.status !== "SUCCESS")) ? "text-amber-300" : "text-gray-400"}`}>{!source.configured || source.kind === "MANUAL_INVOICE" ? "לא מחובר — חשבונית ידנית" : source.stale || (source.state && source.state.status !== "SUCCESS") ? "נדרש עדכון — הנתונים האחרונים נשמרו" : "מעודכן"}</p>
          <p className="text-[11px] text-gray-500">{source.kind === "USAGE" ? "אומדן שימוש" : source.kind === "BILLING_HISTORY" ? "חשבוניות" : "נתוני ספק"} · עדכון מוצלח: {source.state?.lastSuccessAt ? new Date(source.state.lastSuccessAt).toLocaleString("he-IL") : "טרם הושלם"}</p>
          {source.state?.error && <p className="text-xs text-amber-300">העדכון האחרון נכשל</p>}
        </div>)}</div>
      </section>}
      {/* ===== Expense breakdown by category ===== */}
      <section className="bg-gray-900 border border-gray-700 rounded-2xl p-5 space-y-4">
        <h2 className="text-base font-bold text-white">פירוק הוצאות לפי קטגוריה (₪ / חודש)</h2>
        {categoryRows.length === 0 ? (
          <p className="text-sm text-gray-500">{data ? "אין הוצאות פעילות" : "נתוני ההוצאות אינם זמינים"}</p>
        ) : (
          <div className="space-y-2.5">
            {categoryRows.map((c) => (
              <div key={c.key} className="flex items-center gap-3">
                <div className="w-40 shrink-0 text-sm text-gray-300 truncate">
                  {CATEGORY_LABELS[c.key] ?? c.key}
                  <span className="text-[10px] text-gray-500 mr-1">({c.count})</span>
                </div>
                <div className="flex-1 h-5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${CATEGORY_COLORS[c.key] ?? "bg-gray-500"}`}
                    style={{ width: `${Math.max(2, (c.total / maxCategory) * 100)}%` }}
                  />
                </div>
                <div className="w-28 shrink-0 text-left font-mono text-sm text-gray-200">
                  ₪{fmt(c.total)}
                  {c.variable > 0 && c.fixed > 0 && (
                    <span className="block text-[10px] text-gray-500">
                      {fmt(c.fixed)} קבוע + {fmt(c.variable)} משתנה
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ===== Per-client P&L ===== */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-bold text-white">רווחיות פר פרויקט</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            הוצאות ישירות בלבד (שרתים, שירותים שמשויכים ללקוח). תקורה כללית של הסטודיו
            (Claude Max, Vercel וכו׳) לא מחולקת פר לקוח — היא מופיעה בשורה התחתונה למעלה.
          </p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-gray-700">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="bg-gray-800 border-b border-gray-700">
                <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-10">#</th>
                <th className="text-right text-gray-400 font-medium px-3 py-2.5">לקוח</th>
                <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-24">MRR (₪)</th>
                <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-24">מע״מ + 2%</th>
                <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-28">הוצאות ישירות</th>
                <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-24">נקי (₪)</th>
                <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-20">שוליים</th>
              </tr>
            </thead>
            <tbody>
              {pnlRows.map((r) => (
                <tr key={r.id} className="border-b border-gray-800 hover:bg-gray-800/40">
                  <td className="px-3 py-2 text-gray-500 font-mono text-xs">#{r.number}</td>
                  <td className="px-3 py-2 text-white">
                    {r.name}
                    {r.directExpenses > 0 && (
                      <span className="mr-2 text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-400">
                        שרת/שירות משויך
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono">{fmt(r.mrr)}</td>
                  <td className="px-3 py-2 font-mono text-gray-400">{fmt(r.vat + r.cardcomFee)}</td>
                  <td className="px-3 py-2 font-mono text-gray-400">
                    {r.directExpenses > 0 ? fmt(r.directExpenses) : "—"}
                  </td>
                  <td className="px-3 py-2 font-mono">
                    <span className={r.net >= 0 ? "text-green-400" : "text-red-400"}>{fmt(r.net)}</span>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">
                    <span className={r.marginPct >= 50 ? "text-green-400" : r.marginPct >= 0 ? "text-amber-400" : "text-red-400"}>
                      {r.marginPct.toFixed(0)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {paymentExpense && <form onSubmit={submitPayment} className="bg-gray-900 border border-cyan/40 rounded-2xl p-5 space-y-4">
        <div><h2 className="text-base font-bold text-white">רשום תשלום — {paymentExpense.name}</h2><p className="text-xs text-gray-400 mt-1">תיעוד תשלום שכבר בוצע בפועל. הסכום בשקלים נשמר בנפרד מתחזית ההוצאה.</p></div>
        <div className="grid md:grid-cols-4 gap-3">
          <Field label="סכום ששולם בפועל (₪)"><input autoFocus aria-label="סכום ששולם בפועל בשקלים" required type="number" min="0.01" max="21474836.47" step="0.01" value={paymentForm.amountIls} onChange={(event) => setPaymentForm({ ...paymentForm, amountIls: event.target.value })} className={inputCls} /></Field>
          <Field label="תאריך תשלום"><input aria-label="תאריך תשלום" required type="date" value={paymentForm.paidDate} onChange={(event) => setPaymentForm({ ...paymentForm, paidDate: event.target.value })} className={inputCls} /></Field>
          <Field label="אסמכתא (אופציונלי)"><input aria-label="אסמכתא לתשלום" maxLength={500} value={paymentForm.reference} onChange={(event) => setPaymentForm({ ...paymentForm, reference: event.target.value })} className={inputCls} /></Field>
          <Field label="שולם על ידי"><p className="text-sm text-gray-300 py-2">{paymentExpense.paidBy?.name ?? (paymentExpense.paidById ? "המשלם הרשום בהוצאה" : "המשתמש שרושם את התשלום")}</p></Field>
        </div>
        <div className="flex gap-3"><button type="submit" disabled={paymentSaving} className="bg-cyan/20 text-cyan border border-cyan/40 rounded-xl px-4 py-2 text-sm disabled:opacity-50">{paymentSaving ? "רושם…" : "שמור תשלום"}</button><button type="button" disabled={paymentSaving} onClick={() => setPaymentExpense(null)} className="text-sm text-gray-400">סגור</button></div>
      </form>}
      {/* ===== Expense management ===== */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white">ניהול הוצאות ({data?.expenses.length ?? 0})</h2>
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="bg-pink hover:bg-pink-dark text-white text-sm font-bold px-4 py-2 rounded-xl transition-colors"
          >
            {showAdd ? "סגור" : "+ הוצאה חדשה"}
          </button>
        </div>

        {showAdd && (
          <form onSubmit={submitAdd} className="bg-gray-900 border border-gray-700 rounded-2xl p-5 grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="שם ההוצאה *">
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="Claude Max 20x" />
            </Field>
            <Field label="ספק *">
              <input value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} className={inputCls} placeholder="Anthropic" />
            </Field>
            <Field label="קטגוריה">
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputCls}>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="סוג">
              <select value={form.isFixed ? "fixed" : "variable"} onChange={(e) => setForm({ ...form, isFixed: e.target.value === "fixed" })} className={inputCls}>
                <option value="fixed">קבועה</option>
                <option value="variable">משתנה</option>
              </select>
            </Field>
            <Field label="סכום *">
              <input type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={inputCls} dir="ltr" />
            </Field>
            <Field label="מטבע">
              <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className={inputCls}>
                <option value="ILS">₪ ILS</option>
                <option value="USD">$ USD</option>
                <option value="EUR">€ EUR</option>
              </select>
            </Field>
            <Field label="תדירות">
              <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} className={inputCls}>
                {Object.entries(FREQUENCY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="שיוך ללקוח (אופציונלי)">
              <select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value, clientProductId: "", financeBook: "SHARED" })} className={inputCls}>
                <option value="">— תקורה כללית —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>#{c.number} {c.name}</option>
                ))}
              </select>
            </Field>
            {form.clientId && <Field label="מוצר / פרויקט">
              <select value={form.clientProductId} onChange={(event) => {
                const product = clients.find((client) => client.id === form.clientId)?.products?.find((item) => item.id === event.target.value);
                setForm({ ...form, clientProductId: event.target.value, financeBook: product?.financeBook === "PRIVATE" ? "PRIVATE" : "SHARED" });
              }} className={inputCls}>
                <option value="">ללא מוצר — בחר שיוך במפורש</option>
                {clients.find((client) => client.id === form.clientId)?.products?.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
              </select>
            </Field>}
            {isOwner && form.clientId && <FinanceBookSelect value={form.financeBook} disabled={!!form.clientProductId} onChange={(financeBook) => setForm({ ...form, financeBook })} />}
            {isOwner && <div className="space-y-2 text-sm text-gray-300">
              <label className="flex gap-2"><input type="checkbox" checked={form.mixed} onChange={(event) => setForm({ ...form, mixed: event.target.checked })} />חשבונית מעורבת</label>
              {form.mixed && <Field label="החלק שמיוחס לשותפות (%)"><input type="number" min="0" max="100" step="0.01" value={form.sharedPercent} onChange={(event) => setForm({ ...form, sharedPercent: event.target.value })} className={inputCls} /></Field>}
            </div>}
            {!form.clientId && <p className="text-xs text-gray-500">תקורה כללית משויכת לשותפות.</p>}
            <div className="col-span-2 md:col-span-3">
              <Field label="הערות">
                <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputCls} />
              </Field>
            </div>
            <div className="flex items-end">
              <button type="submit" disabled={saving} className="w-full bg-pink hover:bg-pink-dark text-white font-bold py-2.5 rounded-xl transition-colors disabled:opacity-50">
                {saving ? "שומר..." : "הוסף"}
              </button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto rounded-lg border border-gray-700">
          <table className="w-full text-sm min-w-[860px]">
            <thead>
              <tr className="bg-gray-800 border-b border-gray-700">
                <th className="text-right text-gray-400 font-medium px-3 py-2.5">הוצאה</th>
                <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-28">קטגוריה</th>
                <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-16">סוג</th>
                <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-28">סכום</th>
                <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-24">₪ / חודש</th>
                <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-32">שיוך</th>
                <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-24">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {(data?.expenses ?? []).map((e) => (
                <tr key={e.id} className={`border-b border-gray-800 hover:bg-gray-800/40 ${!e.active ? "opacity-45" : ""}`}>
                  <td className="px-3 py-2">
                    <div className="text-white">{e.name} {isOwner && <FinanceBookBadge book={e.financeBook} />}</div>
                    <div className="text-[11px] text-gray-500">
                      {e.vendor}
                      {e.notes ? ` · ${e.notes}` : ""}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-300">{CATEGORY_LABELS[e.category] ?? e.category}</td>
                  <td className="px-3 py-2 text-xs">
                    <span className={e.isFixed ? "text-blue-300" : "text-orange-300"}>
                      {e.isFixed ? "קבועה" : "משתנה"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <AmountEditor key={`${e.id}:${e.amount}`} expense={e} onSave={(amount) => patchExpense(e.id, { amount })} />
                    <span className="text-[10px] text-gray-500 block">
                      {FREQUENCY_LABELS[e.frequency] ?? e.frequency}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-mono text-gray-200">
                    {e.active && e.frequency !== "ONE_TIME" ? `₪${fmt(e.monthlyIls)}` : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-400">
                    {e.client ? `#${e.client.number} ${e.client.name}` : "תקורה כללית"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1.5 flex-wrap">
                      {!e.allocationOnly && (e.financeBook === "PRIVATE" || e.financeBook === "SHARED") && (isOwner || (e.financeBook === "SHARED" && (e.sharedBasisPoints == null || e.sharedBasisPoints === 10000))) && <button onClick={() => openPayment(e)} className="text-[11px] px-2 py-1 rounded-lg bg-cyan/10 text-cyan hover:bg-cyan/20">רשום תשלום</button>}
                      <button
                        onClick={() => patchExpense(e.id, { active: !e.active })}
                        className="text-[11px] px-2 py-1 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700"
                        title={e.active ? "השבת (לא ייכלל בחישוב)" : "הפעל"}
                      >
                        {e.active ? "השבת" : "הפעל"}
                      </button>
                      <button
                        onClick={() => deleteExpense(e.id, e.name)}
                        className="text-[11px] px-2 py-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20"
                      >
                        מחק
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

const inputCls =
  "w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-pink";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );
}

function AmountEditor({
  expense,
  onSave,
}: {
  expense: ExpenseRow;
  onSave: (amount: number) => void;
}) {
  const [val, setVal] = useState(String(expense.amount));
  return (
    <span className="font-mono text-gray-200 inline-flex items-center gap-1" dir="ltr">
      {CURRENCY_SIGN[expense.currency] ?? expense.currency}
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => {
          const n = parseFloat(val);
          if (!isNaN(n) && n >= 0 && n !== expense.amount) onSave(n);
          else setVal(String(expense.amount));
        }}
        className="w-20 bg-transparent border-b border-transparent hover:border-gray-600 focus:border-pink outline-none text-sm font-mono"
      />
    </span>
  );
}

function Card({
  label,
  value,
  highlight,
  negative,
  small,
}: {
  label: string;
  value: number | undefined;
  highlight?: boolean;
  negative?: boolean;
  small?: boolean;
}) {
  const v = value ?? 0;
  return (
    <div className={`rounded-2xl border p-4 ${highlight ? "bg-pink/15 border-pink/40" : "bg-gray-900 border-gray-700"}`}>
      <div className="text-[11px] text-gray-400 mb-1 leading-tight">{label}</div>
      <div
        className={`font-bold font-mono ${small ? "text-lg" : "text-xl md:text-2xl"} ${
          highlight
            ? v >= 0 ? "text-pink" : "text-red-400"
            : negative
              ? "text-red-300"
              : "text-white"
        }`}
      >
        {value == null ? "—" : `${negative && v > 0 ? "−" : v < 0 ? "−" : ""}₪${fmt(Math.abs(v))}`}
      </div>
    </div>
  );
}
