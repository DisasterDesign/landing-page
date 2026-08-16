"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

/**
 * One-time project quotes, rendered inside /admin/jobs.
 *
 * Owner-only. The gate is /api/quotes (requireOwner); this component simply
 * renders nothing on 403, so a partner never sees the section exists. The UI
 * check is cosmetic — never the enforcement point.
 */

interface QuoteRow {
  id: string;
  title: string;
  customer: { name: string };
  amount: number;
  gross: number;
  net: number;
  fee: number;
  profit: number;
  status: "PENDING" | "PAID";
  agreementStatus: "DRAFT" | "SENT" | "SIGNED" | "CANCELLED";
  paymentStatus: string;
  signToken: string;
  phone: string;
  signedAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

const EMPTY = {
  projectTitle: "",
  customerName: "",
  businessName: "",
  idNumber: "",
  phone: "",
  email: "",
  oneTimeFee: "",
  scopeOfWork: "",
  foreign: false,
};

const inputCls =
  "w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-pink";
const labelCls = "block text-[11px] text-gray-400 mb-1";

const fmt = (n: number | null | undefined) =>
  n != null ? n.toLocaleString("he-IL", { maximumFractionDigits: 0 }) : "";
const fmtDate = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("he-IL", {
        day: "numeric",
        month: "short",
        year: "2-digit",
      })
    : "—";

function stageLabel(q: QuoteRow): { text: string; cls: string } {
  if (q.agreementStatus === "CANCELLED")
    return { text: "בוטלה", cls: "bg-gray-700 text-gray-300" };
  if (q.status === "PAID") return { text: "שולם ✓", cls: "bg-green-900 text-green-300" };
  if (q.agreementStatus === "SIGNED")
    return { text: "נחתם — ממתין לתשלום", cls: "bg-yellow-900 text-yellow-300" };
  if (q.agreementStatus === "SENT") return { text: "נשלחה", cls: "bg-blue-900 text-blue-300" };
  return { text: "טיוטה", cls: "bg-gray-700 text-gray-300" };
}

export default function QuotesSection() {
  const [rows, setRows] = useState<QuoteRow[] | null>(null);
  const [allowed, setAllowed] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [showCancelled, setShowCancelled] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/quotes", { cache: "no-store" });
    if (res.status === 403 || res.status === 401) {
      setAllowed(false);
      return;
    }
    if (!res.ok) return;
    const json = await res.json();
    setRows(json.data ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectTitle: form.projectTitle,
          customerName: form.customerName,
          businessName: form.businessName || undefined,
          idNumber: form.idNumber || undefined,
          phone: form.phone,
          email: form.email,
          oneTimeFee: parseFloat(form.oneTimeFee),
          scopeOfWork: form.scopeOfWork,
          // Foreign client = English document + Cardcom page, and zero-rated
          // VAT (export of services, sec. 30(a)(5)). One toggle, two fields —
          // the same pattern the subscription-agreement form uses.
          locale: form.foreign ? "en" : "he",
          vatExempt: form.foreign,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error === "Validation failed" ? "יש שדות חסרים" : "השמירה נכשלה");
        return;
      }
      await copyLink(json.data.signToken);
      toast.success("ההצעה נוצרה והלינק הועתק");
      setForm({ ...EMPTY });
      setShowAdd(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  /**
   * Quotes are cancelled, never deleted. An agreement is a legal record and
   * writer-boundary.test.ts blocks destructive writes to it — but a quote that
   * was never signed is a proposal that went nowhere, so cancelling clears it
   * from the working list while the row and its reason survive.
   */
  async function cancel(q: QuoteRow) {
    const reason = window.prompt(
      `ביטול "${q.title}" — למה? (נשמר בהיסטוריה)`,
      "לא רלוונטי",
    );
    if (reason === null) return;
    if (reason.trim().length < 3) {
      toast.error("צריך סיבה בת 3 תווים לפחות");
      return;
    }
    const res = await fetch(`/api/agreements/${q.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANCELLED", reason: reason.trim() }),
    });
    if (!res.ok) {
      toast.error("הביטול נכשל");
      return;
    }
    toast.success("ההצעה בוטלה");
    load();
  }

  async function copyLink(token: string) {
    const url = `${window.location.origin}/agreement/${token}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard is blocked in some contexts; showing the URL beats failing
      // silently, because the link is the entire deliverable here.
      window.prompt("העתק את הלינק:", url);
    }
  }

  if (!allowed) return null;

  const all = rows ?? [];
  const cancelledCount = all.filter((q) => q.agreementStatus === "CANCELLED").length;
  // Cancelled quotes stay in the database but leave the working list — the
  // point of cancelling is to stop looking at them.
  const visible = showCancelled
    ? all
    : all.filter((q) => q.agreementStatus !== "CANCELLED");
  const open = all.filter(
    (q) => q.status !== "PAID" && q.agreementStatus !== "CANCELLED",
  );
  const outstanding = open.reduce((s, q) => s + q.gross, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white">הצעות מחיר לפרויקטים</h2>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed max-w-2xl">
            עבודה חד-פעמית ללקוח שאינו במנוי. הלקוח חותם ומשלם בקארדקום דרך
            לינק — ולא נשמר כלקוח קבוע. הסכום לפני מע״מ.
            {open.length > 0 && (
              <>
                {" "}
                <span className="text-gray-400">
                  {open.length} פתוחות · ₪{fmt(outstanding)} כולל מע״מ.
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
        {cancelledCount > 0 && (
          <button
            onClick={() => setShowCancelled((v) => !v)}
            className="text-[11px] text-gray-500 hover:text-gray-300 hover:underline"
          >
            {showCancelled ? "הסתר מבוטלות" : `הצג ${cancelledCount} מבוטלות`}
          </button>
        )}
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="bg-pink hover:bg-pink-dark text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors"
        >
          {showAdd ? "סגור" : "+ הצעת מחיר חדשה"}
        </button>
        </div>
      </div>

      {showAdd && (
        <form
          onSubmit={submit}
          className="bg-gray-900 border border-gray-700 rounded-2xl p-5 space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className={labelCls}>כותרת הפרויקט *</label>
              <input
                required
                className={inputCls}
                placeholder="עיצוב לוגו ומיתוג"
                value={form.projectTitle}
                onChange={(e) => setForm({ ...form, projectTitle: e.target.value })}
              />
            </div>
            <div>
              <label className={labelCls}>סכום לפני מע״מ *</label>
              <input
                required
                type="number"
                min="1"
                step="any"
                className={inputCls}
                placeholder="3500"
                value={form.oneTimeFee}
                onChange={(e) => setForm({ ...form, oneTimeFee: e.target.value })}
              />
            </div>
            <div>
              <label className={labelCls}>שם הלקוח *</label>
              <input
                required
                className={inputCls}
                value={form.customerName}
                onChange={(e) => setForm({ ...form, customerName: e.target.value })}
              />
            </div>
            <div>
              <label className={labelCls}>שם העסק</label>
              <input
                className={inputCls}
                value={form.businessName}
                onChange={(e) => setForm({ ...form, businessName: e.target.value })}
              />
            </div>
            <div>
              <label className={labelCls}>ח.פ / ת.ז</label>
              <input
                className={inputCls}
                value={form.idNumber}
                onChange={(e) => setForm({ ...form, idNumber: e.target.value })}
              />
            </div>
            <div>
              <label className={labelCls}>טלפון *</label>
              <input
                required
                className={inputCls}
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>אימייל *</label>
              <input
                required
                type="email"
                className={inputCls}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="md:col-span-3 flex flex-wrap items-center gap-4 pt-1">
              <label className="flex items-center gap-2 text-sm text-gray-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="accent-pink w-4 h-4"
                  checked={form.foreign}
                  onChange={(e) => setForm({ ...form, foreign: e.target.checked })}
                />
                לקוח מחו״ל — הצעה באנגלית, ללא מע״מ
              </label>
              {form.oneTimeFee && !Number.isNaN(parseFloat(form.oneTimeFee)) && (
                <span className="text-[11px] text-gray-500">
                  {form.foreign
                    ? `הלקוח ישלם ₪${fmt(parseFloat(form.oneTimeFee))} — ללא מע״מ (סעיף 30(א)(5))`
                    : `הלקוח ישלם ₪${fmt(parseFloat(form.oneTimeFee) * 1.18)} כולל מע״מ`}
                </span>
              )}
            </div>
            <div className="md:col-span-3">
              <label className={labelCls}>
                תיאור העבודה * — זה הגוף המשפטי של ההצעה שהלקוח חותם עליה
                {form.foreign && " (באנגלית)"}
              </label>
              <textarea
                required
                rows={6}
                className={inputCls}
                placeholder={form.foreign ? "Logo design, three concepts\nShort brand guide\nSource files" : "עיצוב לוגו בשלוש גרסאות\nמדריך מותג קצר\nקבצי מקור"}
                value={form.scopeOfWork}
                onChange={(e) => setForm({ ...form, scopeOfWork: e.target.value })}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="bg-pink hover:bg-pink-dark disabled:opacity-50 text-white text-sm font-bold px-5 py-2.5 rounded-xl"
          >
            {saving ? "שומר…" : "צור והעתק לינק"}
          </button>
        </form>
      )}

      {rows === null ? (
        <p className="text-xs text-gray-500">טוען…</p>
      ) : visible.length === 0 ? (
        <p className="text-xs text-gray-500">
          {rows.length === 0 ? "אין עדיין הצעות מחיר." : "כל ההצעות בוטלו."}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] text-gray-400 text-right">
                <th className="py-2 px-3 font-normal">פרויקט</th>
                <th className="py-2 px-3 font-normal">לקוח</th>
                <th className="py-2 px-3 font-normal">נטו</th>
                <th className="py-2 px-3 font-normal">כולל מע״מ</th>
                <th className="py-2 px-3 font-normal">רווח</th>
                <th className="py-2 px-3 font-normal">סטטוס</th>
                <th className="py-2 px-3 font-normal">תאריך</th>
                <th className="py-2 px-3 font-normal"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((q) => {
                const s = stageLabel(q);
                return (
                  <tr key={q.id} className="border-t border-gray-800 text-white">
                    <td className="py-2.5 px-3">{q.title}</td>
                    <td className="py-2.5 px-3 text-gray-300">{q.customer.name}</td>
                    <td className="py-2.5 px-3">₪{fmt(q.net)}</td>
                    <td className="py-2.5 px-3 text-gray-300">₪{fmt(q.gross)}</td>
                    <td className="py-2.5 px-3 text-gray-300">₪{fmt(q.profit)}</td>
                    <td className="py-2.5 px-3">
                      <span className={`text-[11px] px-2 py-1 rounded-lg ${s.cls}`}>
                        {s.text}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-gray-400 text-xs">
                      {fmtDate(q.paidAt ?? q.signedAt ?? q.createdAt)}
                    </td>
                    <td className="py-2.5 px-3">
                      {q.agreementStatus !== "CANCELLED" && q.status !== "PAID" && (
                        <div className="flex gap-3">
                          <button
                            onClick={() => {
                              copyLink(q.signToken);
                              toast.success("הלינק הועתק");
                            }}
                            className="text-[11px] text-pink hover:underline"
                          >
                            העתק לינק
                          </button>
                          <button
                            onClick={() => cancel(q)}
                            className="text-[11px] text-gray-500 hover:text-red-400 hover:underline"
                          >
                            בטל
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
