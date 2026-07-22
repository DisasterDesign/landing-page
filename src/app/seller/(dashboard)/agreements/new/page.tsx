"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";

type Tier = "LANDING" | "BASIC" | "ADVANCED" | "PREMIUM";
type TierChoice = Tier | "CUSTOM";

const TIER_LABEL: Record<Tier, string> = {
  LANDING: "דף נחיתה",
  BASIC: "בסיס",
  ADVANCED: "מתקדם",
  PREMIUM: "פרימיום",
};
const TIER_PRICE: Record<Tier, number> = {
  LANDING: 59,
  BASIC: 99,
  ADVANCED: 199,
  PREMIUM: 599,
};

interface Created {
  id: string;
  signToken: string;
  customerName: string;
}

export default function SellerNewAgreementPage() {
  const [tierChoice, setTierChoice] = useState<TierChoice>("ADVANCED");
  const [monthlyPrice, setMonthlyPrice] = useState(String(TIER_PRICE.ADVANCED));
  const [oneTimeFee, setOneTimeFee] = useState("");
  const [services, setServices] = useState<string[]>([]);
  const [newClause, setNewClause] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [leadId, setLeadId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);

  // Prefill from the lead (query params) without needing a Suspense boundary.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get("name")) setCustomerName(p.get("name")!);
    if (p.get("phone")) setPhone(p.get("phone")!);
    if (p.get("email")) setEmail(p.get("email")!);
    if (p.get("business")) setBusinessName(p.get("business")!);
    if (p.get("lead")) setLeadId(p.get("lead"));
  }, []);

  const pickTier = (t: TierChoice) => {
    setTierChoice(t);
    setMonthlyPrice(t === "CUSTOM" ? "" : String(TIER_PRICE[t]));
  };

  const addClause = () => {
    const v = newClause.trim();
    if (!v) return;
    setServices((s) => [...s, v]);
    setNewClause("");
  };

  const signUrl = created
    ? `${window.location.origin}/agreement/${created.signToken}`
    : "";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(signUrl);
      toast.success("הקישור הועתק");
    } catch {
      toast.error("העתקה נכשלה — סמן ידנית");
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const monthly = parseFloat(monthlyPrice);
    if (!Number.isFinite(monthly) || monthly <= 0) {
      toast.error("הזן מחיר חודשי תקין");
      return;
    }
    if (!customerName.trim() || phone.trim().length < 9 || !email.trim()) {
      toast.error("מלא שם, טלפון ואימייל תקינים");
      return;
    }
    const setup = oneTimeFee.trim() ? parseFloat(oneTimeFee) : null;
    setSubmitting(true);
    try {
      const res = await fetch("/api/seller/agreements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tier: tierChoice === "CUSTOM" ? null : tierChoice,
          additionalServices: services,
          monthlyPrice: monthly,
          oneTimeFee: setup,
          customerName: customerName.trim(),
          businessName: businessName.trim() || undefined,
          phone: phone.trim(),
          email: email.trim(),
          leadId: leadId || undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "שגיאה ביצירת החוזה");
      }
      setCreated((await res.json()) as Created);
      toast.success("החוזה נוצר!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה");
    } finally {
      setSubmitting(false);
    }
  };

  if (created) {
    const wa = phone
      ? `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(
          `היי, מצרף קישור לחתימה על ההסכם: ${signUrl}`
        )}`
      : null;
    return (
      <div dir="rtl" className="max-w-xl mx-auto space-y-5">
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 text-center space-y-4">
          <div className="text-3xl">✅</div>
          <h1 className="text-xl font-bold text-white">החוזה ל{created.customerName} נוצר</h1>
          <p className="text-sm text-gray-400">
            שלח/י את הקישור ללקוח לחתימה ותשלום. ברגע שהתשלום מאושר — העמלה נרשמת
            אוטומטית על שמך ותיפתח אפשרות לשלוח בריף לאלעד.
          </p>
          <div className="bg-gray-800 rounded-xl p-3 text-xs text-gray-300 break-all" dir="ltr">
            {signUrl}
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            <button onClick={copyLink} className="px-4 py-2 rounded-xl bg-pink hover:bg-pink-dark text-white font-bold text-sm">
              העתק קישור
            </button>
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-xl bg-green-600/20 text-green-400 hover:bg-green-600/30 font-bold text-sm">
                שלח בוואטסאפ
              </a>
            )}
            <Link href="/seller/sales" className="px-4 py-2 rounded-xl bg-gray-800 text-white hover:bg-gray-700 font-bold text-sm">
              לעסקאות שלי
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const inputClass =
    "w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-pink";

  return (
    <div dir="rtl" className="max-w-xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold text-white">הוצאת חוזה חדש</h1>

      <form onSubmit={submit} className="bg-gray-900 border border-gray-700 rounded-2xl p-6 space-y-5">
        <div>
          <label className="block text-sm text-gray-400 mb-2">מסלול</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {(["LANDING", "BASIC", "ADVANCED", "PREMIUM", "CUSTOM"] as TierChoice[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => pickTier(t)}
                className={`px-3 py-3 rounded-xl border text-sm font-bold transition-colors ${
                  tierChoice === t ? "border-pink bg-pink/15 text-white" : "border-gray-700 text-gray-400 hover:border-gray-600"
                }`}
              >
                <div>{t === "CUSTOM" ? "מותאם" : TIER_LABEL[t]}</div>
                <div className="text-xs font-normal opacity-80 mt-0.5">
                  {t === "CUSTOM" ? "הזן מחיר" : `${TIER_PRICE[t]} ₪`}
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">תשלום חודשי לפני מע״מ (₪)</label>
            <input value={monthlyPrice} onChange={(e) => setMonthlyPrice(e.target.value)} inputMode="numeric" className={inputClass} placeholder="199" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">דמי הקמה (אופציונלי)</label>
            <input value={oneTimeFee} onChange={(e) => setOneTimeFee(e.target.value)} inputMode="numeric" className={inputClass} placeholder="—" />
          </div>
        </div>
        <p className="text-[11px] text-gray-500 -mt-2">
          העמלה שלך = התשלום החודשי של החודש הראשון. אפשר להעלות את המחיר (אפסייל) ולהוסיף סעיפים.
        </p>

        <div>
          <label className="block text-sm text-gray-400 mb-1">סעיפי אפסייל / שירותים נוספים</label>
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
              placeholder="לדוגמה: דף נחיתה נוסף, אינטגרציה למערכת"
              className={`${inputClass} flex-1`}
            />
            <button type="button" onClick={addClause} className="shrink-0 px-3 rounded-xl bg-cyan/20 text-cyan font-bold text-sm">
              + הוסף
            </button>
          </div>
          {services.length > 0 && (
            <ul className="mt-2 space-y-1">
              {services.map((s, i) => (
                <li key={i} className="flex items-center gap-2 px-3 py-2 bg-gray-800/60 border border-gray-700 rounded-xl text-sm text-white">
                  <span className="flex-1">• {s}</span>
                  <button type="button" onClick={() => setServices((arr) => arr.filter((_, j) => j !== i))} className="text-gray-500 hover:text-red-400 text-xs">
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-400 mb-1">שם הלקוח *</label>
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">שם העסק</label>
            <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">טלפון *</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" required className={inputClass} dir="ltr" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">אימייל *</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className={inputClass} dir="ltr" />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-pink hover:bg-pink-dark text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50"
        >
          {submitting ? "יוצר..." : "צור חוזה וקבל קישור לשליחה"}
        </button>
      </form>
    </div>
  );
}
