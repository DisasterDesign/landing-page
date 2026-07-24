"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

interface JobRow {
  id: string;
  client: { id: string; name: string; number: number };
  title: string;
  amount: number;
  vatIncluded: boolean;
  cardcomFee: boolean;
  status: "PENDING" | "PAID";
  closedAt: string;
  paymentTermsDays: number;
  paidAt: string | null;
  expectedPaidAt: string;
  overdue: boolean;
  notes: string | null;
  gross: number;
  net: number;
  vat: number;
  fee: number;
  profit: number;
}

interface PerClient {
  clientId: string;
  name: string;
  number: number;
  outstanding: number;
  received: number;
  jobCount: number;
}

interface PerMonth {
  month: string;
  billedGross: number;
  receivedGross: number;
  receivedNet: number;
}

interface Totals {
  outstandingGross: number;
  receivedThisMonthGross: number;
  receivedThisMonthNet: number;
  openCount: number;
  overdueCount: number;
}

interface Payload {
  rows: JobRow[];
  perClient: PerClient[];
  perMonth: PerMonth[];
  totals: Totals;
}

interface ClientOption {
  id: string;
  name: string;
  number: number;
}

const fmt = (n: number | null | undefined) =>
  n != null ? n.toLocaleString("he-IL", { maximumFractionDigits: 0 }) : "";

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("he-IL", { day: "numeric", month: "short", year: "2-digit" }) : "—";

const monthLabel = (m: string) => {
  const [y, mo] = m.split("-");
  return new Date(Number(y), Number(mo) - 1, 1).toLocaleDateString("he-IL", { month: "long", year: "numeric" });
};

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const EMPTY_FORM = {
  clientId: "",
  clientName: "",
  newClient: false,
  title: "",
  amount: "",
  vatIncluded: false,
  cardcomFee: false,
  closedAt: todayISO(),
  paymentTermsDays: "60",
  notes: "",
};

export default function JobsPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs", { cache: "no-store" });
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      toast.error("שגיאה בטעינת העבודות");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    (async () => {
      try {
        const res = await fetch("/api/clients", { cache: "no-store" });
        if (res.ok) {
          const json = await res.json();
          const list = (Array.isArray(json) ? json : json.data ?? []) as ClientOption[];
          setClients(
            list.map((c) => ({ id: c.id, name: c.name, number: c.number })).sort((a, b) => a.name.localeCompare(b.name, "he"))
          );
        }
      } catch {
        /* dropdown optional */
      }
    })();
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(form.amount);
    if (!form.title.trim() || isNaN(amount) || amount < 0) {
      toast.error("תיאור וסכום תקין — חובה");
      return;
    }
    if (!form.newClient && !form.clientId) {
      toast.error("בחר לקוח או הוסף חדש");
      return;
    }
    if (form.newClient && !form.clientName.trim()) {
      toast.error("שם הלקוח החדש חובה");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: form.newClient ? null : form.clientId,
          clientName: form.newClient ? form.clientName.trim() : null,
          title: form.title.trim(),
          amount,
          vatIncluded: form.vatIncluded,
          cardcomFee: form.cardcomFee,
          closedAt: form.closedAt,
          paymentTermsDays: parseInt(form.paymentTermsDays, 10) || 60,
          notes: form.notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error || "שגיאה בהוספת העבודה");
      }
      toast.success("העבודה נוספה");
      setForm({ ...EMPTY_FORM });
      setShowAdd(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה בהוספת העבודה");
    } finally {
      setSaving(false);
    }
  };

  const markPaid = async (job: JobRow, paid: boolean) => {
    try {
      const res = await fetch(`/api/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paid ? { paidAt: todayISO() } : { paidAt: null }),
      });
      if (!res.ok) throw new Error();
      toast.success(paid ? "סומן כשולם — נכנס לחודש הנוכחי" : "הוחזר לחוב");
      await load();
    } catch {
      toast.error("שגיאה בעדכון");
    }
  };

  const deleteJob = async (job: JobRow) => {
    if (!confirm(`למחוק את "${job.title}" של ${job.client.name}?`)) return;
    try {
      const res = await fetch(`/api/jobs/${job.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("נמחק");
      await load();
    } catch {
      toast.error("שגיאה במחיקה");
    }
  };

  const rowsByClient = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, { client: JobRow["client"]; jobs: JobRow[] }>();
    for (const r of data.rows) {
      const g = map.get(r.client.id) ?? { client: r.client, jobs: [] };
      g.jobs.push(r);
      map.set(r.client.id, g);
    }
    // Client with most outstanding first
    return [...map.values()].sort((a, b) => {
      const ao = a.jobs.filter((j) => j.status === "PENDING").reduce((s, j) => s + j.gross, 0);
      const bo = b.jobs.filter((j) => j.status === "PENDING").reduce((s, j) => s + j.gross, 0);
      return bo - ao;
    });
  }, [data]);

  const t = data?.totals;

  if (loading) {
    return (
      <div dir="rtl" className="bg-gray-900 border border-gray-700 rounded-2xl p-12 text-center text-sm text-gray-500">
        טוען עבודות...
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">עבודות חד-פעמיות</h1>
          <p className="text-xs text-gray-500 mt-1 leading-relaxed max-w-2xl">
            עבודות בתשלום אחד ללקוחות שלא במנוי חודשי (כמו סולל בונה). כל עבודה
            נכנסת לחודש שבו התשלום מתקבל בפועל. הסכומים לפני מע״מ (נטו); הלקוח
            משלם + 18% מע״מ. תנאי תשלום שוטף+60 כברירת מחדל.
          </p>
        </div>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="bg-pink hover:bg-pink-dark text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors"
        >
          {showAdd ? "סגור" : "+ עבודה חדשה"}
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card label="סה״כ חייבים לנו (כולל מע״מ)" value={t?.outstandingGross} accent />
        <Card label="נכנס החודש (כולל מע״מ)" value={t?.receivedThisMonthGross} />
        <Card label="רווח נטו החודש (עבודות)" value={t?.receivedThisMonthNet} highlight />
        <Card label="עבודות פתוחות" value={t?.openCount} int sub={t?.overdueCount ? `${t.overdueCount} באיחור` : undefined} />
      </div>

      {/* Add form */}
      {showAdd && (
        <form onSubmit={submit} className="bg-gray-900 border border-gray-700 rounded-2xl p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-1">
              <label className={labelCls}>לקוח</label>
              {/* Explicit segmented toggle — the old 11px text link was
                  invisible enough that the feature was reported missing. */}
              <div className="flex gap-1 mb-2">
                {([
                  [false, "לקוח קיים"],
                  [true, "+ לקוח חדש"],
                ] as const).map(([isNew, label]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setForm({ ...form, newClient: isNew, clientId: "", clientName: "" })}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${
                      form.newClient === isNew
                        ? "border-cyan bg-cyan/10 text-white"
                        : "border-gray-700 bg-gray-800 text-gray-400 hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {form.newClient ? (
                <input
                  value={form.clientName}
                  onChange={(e) => setForm({ ...form, clientName: e.target.value })}
                  placeholder="שם לקוח חדש (למשל סולל בונה)"
                  className={inputCls}
                />
              ) : (
                <select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} className={inputCls}>
                  <option value="">— בחר לקוח —</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>#{c.number} {c.name}</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className={labelCls}>תיאור העבודה</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="דף נחיתה / וידאו..." className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>סכום (לפני מע״מ, ₪)</label>
              <input type="number" step="1" min="0" dir="ltr" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={inputCls} />
              {form.amount && !form.vatIncluded && (
                <span className="text-[10px] text-gray-500 block mt-0.5">
                  ללקוח: ₪{fmt(parseFloat(form.amount) * 1.18)} כולל מע״מ
                </span>
              )}
            </div>
            <div>
              <label className={labelCls}>תאריך סגירת העבודה</label>
              <input type="date" value={form.closedAt} onChange={(e) => setForm({ ...form, closedAt: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>תנאי תשלום (ימים אחרי סוף החודש)</label>
              <input type="number" step="1" min="0" dir="ltr" value={form.paymentTermsDays} onChange={(e) => setForm({ ...form, paymentTermsDays: e.target.value })} className={inputCls} />
            </div>
            <div className="flex items-end gap-4 pb-1">
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input type="checkbox" checked={form.vatIncluded} onChange={(e) => setForm({ ...form, vatIncluded: e.target.checked })} className="accent-pink" />
                הסכום כולל מע״מ
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input type="checkbox" checked={form.cardcomFee} onChange={(e) => setForm({ ...form, cardcomFee: e.target.checked })} className="accent-pink" />
                דרך קארדקום (2%)
              </label>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-3">
              <label className={labelCls}>הערות</label>
              <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={inputCls} />
            </div>
            <div className="flex items-end">
              <button type="submit" disabled={saving} className="w-full bg-pink hover:bg-pink-dark text-white font-bold py-2.5 rounded-xl transition-colors disabled:opacity-50">
                {saving ? "שומר..." : "הוסף עבודה"}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Per-client jobs */}
      {rowsByClient.length === 0 ? (
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-12 text-center text-sm text-gray-500">
          אין עבודות עדיין. הוסף את הראשונה עם ״עבודה חדשה״.
        </div>
      ) : (
        <div className="space-y-5">
          {rowsByClient.map(({ client, jobs }) => {
            const outstanding = jobs.filter((j) => j.status === "PENDING").reduce((s, j) => s + j.gross, 0);
            const received = jobs.filter((j) => j.status === "PAID").reduce((s, j) => s + j.gross, 0);
            return (
              <div key={client.id} className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-gray-800 bg-gray-800/40">
                  <h3 className="font-bold text-white">{client.name}</h3>
                  <div className="flex gap-4 text-xs">
                    <span className="text-gray-400">חייב: <span className="font-mono font-bold text-amber-400">₪{fmt(outstanding)}</span></span>
                    <span className="text-gray-400">שולם: <span className="font-mono text-green-400">₪{fmt(received)}</span></span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[760px]">
                    <thead>
                      <tr className="text-[11px] text-gray-500 border-b border-gray-800">
                        <th className="text-right font-medium px-4 py-2">עבודה</th>
                        <th className="text-right font-medium px-4 py-2 w-24">נטו (₪)</th>
                        <th className="text-right font-medium px-4 py-2 w-28">ללקוח (כולל מע״מ)</th>
                        <th className="text-right font-medium px-4 py-2 w-24">נסגרה</th>
                        <th className="text-right font-medium px-4 py-2 w-28">צפי תשלום</th>
                        <th className="text-right font-medium px-4 py-2 w-28">סטטוס</th>
                        <th className="text-right font-medium px-4 py-2 w-32">פעולות</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobs.map((j) => (
                        <tr key={j.id} className="border-b border-gray-800/70 hover:bg-gray-800/30">
                          <td className="px-4 py-2.5">
                            <div className="text-white">{j.title}</div>
                            {j.notes && <div className="text-[11px] text-gray-500">{j.notes}</div>}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-gray-200">{fmt(j.net)}</td>
                          <td className="px-4 py-2.5 font-mono text-gray-400">{fmt(j.gross)}</td>
                          <td className="px-4 py-2.5 text-xs text-gray-400">{fmtDate(j.closedAt)}</td>
                          <td className="px-4 py-2.5 text-xs">
                            {j.status === "PAID" ? (
                              <span className="text-green-400">שולם {fmtDate(j.paidAt)}</span>
                            ) : (
                              <span className={j.overdue ? "text-red-400 font-bold" : "text-gray-400"}>
                                {fmtDate(j.expectedPaidAt)}{j.overdue ? " ⚠" : ""}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            {j.status === "PAID" ? (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 font-bold">שולם ✓</span>
                            ) : (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 font-bold">ממתין לתשלום</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex gap-1.5">
                              {j.status === "PENDING" ? (
                                <button onClick={() => markPaid(j, true)} className="text-[11px] px-2 py-1 rounded-lg bg-green-500/15 text-green-400 hover:bg-green-500/25 font-bold">
                                  התקבל תשלום
                                </button>
                              ) : (
                                <button onClick={() => markPaid(j, false)} className="text-[11px] px-2 py-1 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700">
                                  החזר לחוב
                                </button>
                              )}
                              <button onClick={() => deleteJob(j)} className="text-[11px] px-2 py-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20">
                                מחק
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Per-month breakdown */}
      {data && data.perMonth.length > 0 && (
        <section className="bg-gray-900 border border-gray-700 rounded-2xl p-5">
          <h2 className="text-base font-bold text-white mb-3">תמונה חודשית</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr className="text-[11px] text-gray-500 border-b border-gray-800">
                  <th className="text-right font-medium px-3 py-2">חודש</th>
                  <th className="text-right font-medium px-3 py-2">נסגר (חויב, כולל מע״מ)</th>
                  <th className="text-right font-medium px-3 py-2">התקבל (כולל מע״מ)</th>
                  <th className="text-right font-medium px-3 py-2">רווח נטו שהתקבל</th>
                </tr>
              </thead>
              <tbody>
                {data.perMonth.map((m) => (
                  <tr key={m.month} className="border-b border-gray-800/70">
                    <td className="px-3 py-2 text-gray-300">{monthLabel(m.month)}</td>
                    <td className="px-3 py-2 font-mono text-gray-400">{m.billedGross ? `₪${fmt(m.billedGross)}` : "—"}</td>
                    <td className="px-3 py-2 font-mono text-green-400">{m.receivedGross ? `₪${fmt(m.receivedGross)}` : "—"}</td>
                    <td className="px-3 py-2 font-mono text-pink">{m.receivedNet ? `₪${fmt(m.receivedNet)}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-gray-500 mt-3">
            ה״רווח נטו שהתקבל״ נכנס אוטומטית ל<a href="/admin/finance" className="text-cyan hover:underline">לוח הפיננסים</a> כהכנסה חד-פעמית בחודש שבו התקבל התשלום.
          </p>
        </section>
      )}
    </div>
  );
}

const inputCls =
  "w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-pink";
const labelCls = "block text-[11px] text-gray-400 mb-1";

function Card({
  label,
  value,
  highlight,
  accent,
  int,
  sub,
}: {
  label: string;
  value: number | undefined;
  highlight?: boolean;
  accent?: boolean;
  int?: boolean;
  sub?: string;
}) {
  const v = value ?? 0;
  return (
    <div className={`rounded-2xl border p-4 ${highlight ? "bg-pink/15 border-pink/40" : accent ? "bg-amber-500/10 border-amber-500/30" : "bg-gray-900 border-gray-700"}`}>
      <div className="text-[11px] text-gray-400 mb-1 leading-tight">{label}</div>
      <div className={`font-bold font-mono text-xl md:text-2xl ${highlight ? "text-pink" : accent ? "text-amber-400" : "text-white"}`}>
        {int ? fmt(v) : `₪${fmt(v)}`}
      </div>
      {sub && <div className="text-[10px] text-red-400 mt-0.5">{sub}</div>}
    </div>
  );
}
