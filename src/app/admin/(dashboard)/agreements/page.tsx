"use client";

import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";

type Tier = "BASIC" | "ADVANCED" | "PREMIUM";
type Status = "DRAFT" | "SENT" | "SIGNED" | "CANCELLED";

interface Agreement {
  id: string;
  tier: Tier | null;
  monthlyPrice: number;
  oneTimeFee: number | null;
  customerName: string;
  businessName: string | null;
  idNumber: string | null;
  phone: string;
  email: string;
  status: Status;
  signedAt: string | null;
  signToken: string;
  content: string;
  createdAt: string;
  client?: { id: string; name: string } | null;
}

const TIER_LABEL: Record<Tier, string> = {
  BASIC: "בסיס",
  ADVANCED: "מתקדם",
  PREMIUM: "פרימיום",
};

const TIER_VARIANT: Record<Tier, "cyan" | "pink" | "yellow"> = {
  BASIC: "cyan",
  ADVANCED: "pink",
  PREMIUM: "yellow",
};

const STATUS_LABEL: Record<Status, string> = {
  DRAFT: "טיוטה",
  SENT: "נשלח",
  SIGNED: "נחתם",
  CANCELLED: "בוטל",
};

const STATUS_VARIANT: Record<Status, "gray" | "cyan" | "green" | "red"> = {
  DRAFT: "gray",
  SENT: "cyan",
  SIGNED: "green",
  CANCELLED: "red",
};

const TIER_PRICE: Record<Tier, number> = {
  BASIC: 99,
  ADVANCED: 199,
  PREMIUM: 299,
};

export default function AgreementsPage() {
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewing, setViewing] = useState<Agreement | null>(null);
  const [creating, setCreating] = useState(false);

  const [tier, setTier] = useState<Tier>("ADVANCED");
  const [monthlyPrice, setMonthlyPrice] = useState<string>(String(TIER_PRICE.ADVANCED));
  const [oneTimeFee, setOneTimeFee] = useState<string>("");
  const [additionalServices, setAdditionalServices] = useState<string[]>([]);
  const [newClause, setNewClause] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const fetchList = useCallback(async () => {
    try {
      const res = await fetch("/api/agreements");
      if (!res.ok) throw new Error();
      const json = await res.json();
      setAgreements(json.data || []);
    } catch {
      toast.error("שגיאה בטעינת הסכמים");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const resetForm = () => {
    setTier("ADVANCED");
    setMonthlyPrice(String(TIER_PRICE.ADVANCED));
    setOneTimeFee("");
    setAdditionalServices([]);
    setNewClause("");
    setCustomerName("");
    setBusinessName("");
    setIdNumber("");
    setPhone("");
    setEmail("");
  };

  const pickTier = (next: Tier) => {
    setTier(next);
    setMonthlyPrice(String(TIER_PRICE[next]));
  };

  const addClause = () => {
    const trimmed = newClause.trim();
    if (!trimmed) return;
    if (additionalServices.length >= 30) {
      toast.error("ניתן להוסיף עד 30 סעיפים");
      return;
    }
    setAdditionalServices([...additionalServices, trimmed]);
    setNewClause("");
  };

  const removeClause = (index: number) => {
    setAdditionalServices(additionalServices.filter((_, i) => i !== index));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const monthly = parseFloat(monthlyPrice);
      if (!Number.isFinite(monthly) || monthly <= 0) {
        toast.error("הזן מחיר חודשי תקין");
        setCreating(false);
        return;
      }
      const setup = oneTimeFee.trim() ? parseFloat(oneTimeFee) : null;
      if (setup !== null && (!Number.isFinite(setup) || setup <= 0)) {
        toast.error("סכום הקמה לא תקין");
        setCreating(false);
        return;
      }

      const res = await fetch("/api/agreements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier,
          additionalServices,
          monthlyPrice: monthly,
          oneTimeFee: setup,
          customerName: customerName.trim(),
          businessName: businessName.trim() || undefined,
          idNumber: idNumber.trim() || undefined,
          phone: phone.trim(),
          email: email.trim(),
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "שגיאה");
      }
      toast.success("ההסכם נוצר");
      setCreateOpen(false);
      resetForm();
      fetchList();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה ביצירת הסכם");
    } finally {
      setCreating(false);
    }
  };

  const copyLink = async (token: string) => {
    const url = `${window.location.origin}/agreement/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("הקישור הועתק");
    } catch {
      toast.error("שגיאה בהעתקה");
    }
  };

  const handleDelete = async (a: Agreement) => {
    if (!confirm(`למחוק את ההסכם של ${a.customerName}?`)) return;
    try {
      const res = await fetch(`/api/agreements/${a.id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "שגיאה");
      }
      toast.success("נמחק");
      fetchList();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה במחיקה");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-pink border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">הסכמים</h1>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-pink hover:bg-pink-light text-white rounded-xl text-sm font-bold transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          הסכם חדש
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-800 border-b border-gray-700">
              <th className="text-right text-gray-400 font-medium px-3 py-2.5 min-w-[160px]">שם הלקוח</th>
              <th className="text-right text-gray-400 font-medium px-3 py-2.5 min-w-[140px]">שם עסק</th>
              <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-32">מסלול</th>
              <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-28">מחיר/חודש</th>
              <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-28">הקמה</th>
              <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-24">סטטוס</th>
              <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-32">תאריך יצירה</th>
              <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-32">תאריך חתימה</th>
              <th className="text-right text-gray-400 font-medium px-3 py-2.5 w-44 sticky left-0 bg-gray-800 z-10 border-l border-gray-700 md:static md:border-l-0">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {agreements.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center text-gray-500 py-12">
                  עוד לא יצרת הסכמים
                </td>
              </tr>
            ) : (
              agreements.map((a) => (
                <tr key={a.id} className="border-b border-gray-800 hover:bg-gray-800/50 group/row">
                  <td className="px-3 py-2.5 text-white">{a.customerName}</td>
                  <td className="px-3 py-2.5 text-gray-300">{a.businessName || "—"}</td>
                  <td className="px-3 py-2.5">
                    {a.tier ? (
                      <Badge variant={TIER_VARIANT[a.tier]}>{TIER_LABEL[a.tier]}</Badge>
                    ) : (
                      <Badge variant="gray">מותאם</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-white">{a.monthlyPrice} ₪</td>
                  <td className="px-3 py-2.5 font-mono text-gray-300">{a.oneTimeFee ? `${a.oneTimeFee} ₪` : "—"}</td>
                  <td className="px-3 py-2.5">
                    <Badge variant={STATUS_VARIANT[a.status]}>{STATUS_LABEL[a.status]}</Badge>
                  </td>
                  <td className="px-3 py-2.5 text-gray-400 text-xs">
                    {new Date(a.createdAt).toLocaleDateString("he-IL")}
                  </td>
                  <td className="px-3 py-2.5 text-gray-400 text-xs">
                    {a.signedAt ? new Date(a.signedAt).toLocaleDateString("he-IL") : "—"}
                  </td>
                  <td className="px-3 py-2.5 sticky left-0 bg-gray-950 group-hover/row:bg-gray-800 z-10 border-l border-gray-800 md:static md:border-l-0 md:bg-transparent">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => copyLink(a.signToken)}
                        className="text-cyan hover:text-cyan/80 text-xs underline-offset-2 hover:underline"
                      >
                        העתק קישור
                      </button>
                      <button
                        onClick={() => setViewing(a)}
                        className="text-gray-300 hover:text-white text-xs underline-offset-2 hover:underline"
                      >
                        צפה
                      </button>
                      <a
                        href={`/api/agreements/${a.id}/download`}
                        className="text-pink hover:text-pink/80 text-xs underline-offset-2 hover:underline"
                      >
                        הורד
                      </a>
                      {a.status === "DRAFT" && (
                        <button
                          onClick={() => handleDelete(a)}
                          className="text-red-400 hover:text-red-300 text-xs underline-offset-2 hover:underline"
                        >
                          מחק
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="הסכם חדש">
        <form onSubmit={handleCreate} className="space-y-4" dir="rtl">
          <div>
            <label className="block text-sm text-gray-400 mb-2">מסלול בסיס *</label>
            <div className="grid grid-cols-3 gap-2">
              {(["BASIC", "ADVANCED", "PREMIUM"] as Tier[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => pickTier(t)}
                  className={`px-3 py-3 rounded-xl border text-sm font-bold transition-colors ${
                    tier === t
                      ? "border-pink bg-pink/15 text-white"
                      : "border-gray-700 text-gray-400 hover:border-gray-600"
                  }`}
                >
                  <div>{TIER_LABEL[t]}</div>
                  <div className="text-xs font-normal mt-0.5 opacity-80">{TIER_PRICE[t]} ₪</div>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-500 mt-2">
              בחר את המסלול הסטנדרטי, ולמטה אפשר להוסיף סעיפים נוספים שיוסיפו לתוכן ההסכם.
            </p>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">סעיפים נוספים בהסכם</label>
            <div className="flex gap-2">
              <input
                value={newClause}
                onChange={(e) => setNewClause(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addClause();
                  }
                }}
                placeholder="לדוגמה: אינטגרציה עם מערכת CRM של הלקוח"
                className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-pink"
              />
              <button
                type="button"
                onClick={addClause}
                className="px-3 py-2 bg-cyan/20 hover:bg-cyan/30 text-cyan text-sm font-bold rounded-xl transition-colors"
              >
                + הוסף סעיף
              </button>
            </div>
            {additionalServices.length > 0 && (
              <ul className="mt-2 space-y-1">
                {additionalServices.map((clause, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 px-3 py-2 bg-gray-800/60 border border-gray-700 rounded-xl text-sm text-white"
                  >
                    <span className="flex-1">• {clause}</span>
                    <button
                      type="button"
                      onClick={() => removeClause(i)}
                      className="shrink-0 text-gray-500 hover:text-red-400 text-xs"
                      aria-label="הסר סעיף"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">תשלום חודשי (₪) *</label>
              <input
                value={monthlyPrice}
                onChange={(e) => setMonthlyPrice(e.target.value)}
                required
                inputMode="numeric"
                placeholder="1500"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-pink"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">סכום הקמה חד-פעמי (₪)</label>
              <input
                value={oneTimeFee}
                onChange={(e) => setOneTimeFee(e.target.value)}
                inputMode="numeric"
                placeholder="אופציונלי"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-pink"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">שם מלא *</label>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              required
              minLength={1}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-pink"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">שם העסק</label>
              <input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-pink"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">ח.פ. / ע.מ.</label>
              <input
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-pink"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">טלפון *</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                minLength={9}
                inputMode="tel"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-pink"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">אימייל *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-pink"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={creating || !customerName.trim() || !phone.trim() || !email.trim() || !monthlyPrice.trim()}
              className="flex-1 bg-pink hover:bg-pink-light disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition-colors"
            >
              {creating ? "יוצר..." : "צור הסכם"}
            </button>
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="px-4 border border-gray-700 hover:border-gray-600 text-gray-300 rounded-xl"
            >
              ביטול
            </button>
          </div>
        </form>
      </Modal>

      {/* View modal */}
      <Modal
        isOpen={viewing !== null}
        onClose={() => setViewing(null)}
        title={viewing ? `הסכם — ${viewing.customerName}` : ""}
      >
        {viewing && (
          <iframe
            srcDoc={viewing.content}
            sandbox=""
            title="תצוגת הסכם"
            className="w-full bg-white rounded-xl border border-gray-700"
            style={{ height: "60vh" }}
          />
        )}
      </Modal>
    </div>
  );
}
