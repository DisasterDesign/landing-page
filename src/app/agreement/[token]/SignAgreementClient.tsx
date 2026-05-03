"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { withVat } from "@/lib/vat";

interface PriceInfo {
  tier: string | null;
  tierLabel: string | null;
  monthlyPrice: number;
  oneTimeFee: number | null;
}

interface Props {
  token: string;
  content: string;
  priceInfo: PriceInfo;
  initial: {
    customerName: string;
    businessName: string | null;
    idNumber: string | null;
    phone: string;
    email: string;
  };
}

const fmtNum = (n: number) => n.toLocaleString("he-IL", { maximumFractionDigits: 0 });

export default function SignAgreementClient({ token, content, priceInfo, initial }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [hasSignature, setHasSignature] = useState(false);

  const [customerName, setCustomerName] = useState(initial.customerName);
  const [businessName, setBusinessName] = useState(initial.businessName ?? "");
  const [idNumber, setIdNumber] = useState(initial.idNumber ?? "");
  const [phone, setPhone] = useState(initial.phone);
  const [email, setEmail] = useState(initial.email);
  const [agreed, setAgreed] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Post-sign state machine. "form" until the user signs.
  const [postSignState, setPostSignState] = useState<
    "form" | "preparing-payment" | "payment-failed" | "no-payment-needed"
  >("form");
  const [paymentRetrying, setPaymentRetrying] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    ctx.scale(ratio, ratio);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#0f172a";
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, rect.width, rect.height);
  }, []);

  const getPoint = (e: PointerEvent | MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;
    if ("touches" in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ("changedTouches" in e && e.changedTouches.length > 0) {
      clientX = e.changedTouches[0].clientX;
      clientY = e.changedTouches[0].clientY;
    } else {
      clientX = (e as MouseEvent).clientX;
      clientY = (e as MouseEvent).clientY;
    }
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const point = getPoint(e.nativeEvent);
    drawingRef.current = true;
    lastPointRef.current = point;
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    const last = lastPointRef.current;
    if (!ctx || !last) return;
    const point = getPoint(e.nativeEvent);
    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPointRef.current = point;
    if (!hasSignature) setHasSignature(true);
  };

  const endDraw = () => {
    drawingRef.current = false;
    lastPointRef.current = null;
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    setHasSignature(false);
  };

  // Try to fetch the Cardcom payment URL via the dedicated endpoint and
  // redirect on success. Returns true on success (and triggers redirect),
  // false on failure (caller decides retry / surface error).
  const fetchAndRedirectToPayment = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(`/api/agreements/sign/${token}/payment`, {
        method: "POST",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.url) {
        setPaymentError(typeof json.error === "string" ? json.error : "שגיאה ביצירת לינק תשלום");
        return false;
      }
      window.location.href = json.url;
      return true;
    } catch {
      setPaymentError("שגיאה ביצירת לינק תשלום");
      return false;
    }
  }, [token]);

  // Auto-retry on entering "preparing-payment". Up to 3 attempts at
  // 0s / 2s / 6s. If all fail we surface the manual retry button.
  useEffect(() => {
    if (postSignState !== "preparing-payment") return;
    let cancelled = false;
    const delays = [0, 2000, 6000];
    (async () => {
      for (let i = 0; i < delays.length; i++) {
        if (cancelled) return;
        if (delays[i] > 0) await new Promise((r) => setTimeout(r, delays[i]));
        if (cancelled) return;
        const ok = await fetchAndRedirectToPayment();
        if (ok || cancelled) return; // redirect happened, leave state alone
      }
      if (!cancelled) setPostSignState("payment-failed");
    })();
    return () => {
      cancelled = true;
    };
  }, [postSignState, fetchAndRedirectToPayment]);

  const manualRetryPayment = useCallback(async () => {
    setPaymentRetrying(true);
    setPaymentError(null);
    const ok = await fetchAndRedirectToPayment();
    if (!ok) setPaymentRetrying(false);
  }, [fetchAndRedirectToPayment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!hasSignature || !canvasRef.current) {
      setError("נא לחתום בחתימה");
      return;
    }
    if (!agreed) {
      setError("נא לאשר את התנאים");
      return;
    }

    setSubmitting(true);
    try {
      const signatureData = canvasRef.current.toDataURL("image/png");
      const res = await fetch(`/api/agreements/sign/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: customerName.trim(),
          businessName: businessName.trim() || undefined,
          idNumber: idNumber.trim() || undefined,
          phone: phone.trim(),
          email: email.trim(),
          signatureData,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "שגיאה בחתימה");
      }
      const json = (await res.json().catch(() => ({}))) as { paymentUrl?: string };

      // Fast path: server already has a Cardcom URL. Redirect immediately.
      if (json.paymentUrl) {
        window.location.href = json.paymentUrl;
        return;
      }
      // No URL came back — agreement is signed, but Cardcom call didn't
      // complete in the sign request. Show "preparing payment" view; the
      // useEffect retries against the dedicated endpoint with backoff.
      const hasMonthly = priceInfo.monthlyPrice > 0;
      const hasSetup = (priceInfo.oneTimeFee ?? 0) > 0;
      if (!hasMonthly && !hasSetup) {
        setPostSignState("no-payment-needed");
      } else {
        setPostSignState("preparing-payment");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בחתימה");
    } finally {
      setSubmitting(false);
    }
  };

  const pdfDownload = (
    <a
      href={`/agreement/${token}/pdf`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 text-cyan hover:text-cyan/80 text-sm hover:underline"
    >
      הורד PDF של ההסכם החתום ↓
    </a>
  );

  if (postSignState === "preparing-payment") {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-md text-center bg-white/5 border border-white/10 backdrop-blur-sm rounded-2xl p-10 space-y-5">
          <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-pink to-cyan flex items-center justify-center text-3xl">
            ✓
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">ההסכם נחתם בהצלחה</h1>
          <div className="flex items-center justify-center gap-3 text-gray-300">
            <div className="w-5 h-5 border-2 border-pink border-t-transparent rounded-full animate-spin" />
            <span>מכין דף תשלום…</span>
          </div>
          <p className="text-xs text-gray-500">
            מיד תועבר/י לתשלום מאובטח דרך CardCom.
          </p>
          <div className="pt-2">{pdfDownload}</div>
        </div>
      </div>
    );
  }

  if (postSignState === "payment-failed") {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-md text-center bg-white/5 border border-white/10 backdrop-blur-sm rounded-2xl p-10 space-y-5">
          <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-pink to-cyan flex items-center justify-center text-3xl">
            ✓
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">ההסכם נחתם בהצלחה</h1>
          <p className="text-sm text-gray-300">
            כעת נותר רק להשלים את התשלום הראשון. הלינק לתשלום מוכן.
          </p>
          {paymentError && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-xs rounded-xl px-3 py-2">
              {paymentError}
            </div>
          )}
          <button
            onClick={manualRetryPayment}
            disabled={paymentRetrying}
            className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-pink to-cyan text-black font-bold px-8 py-3 rounded-full hover:shadow-[0_0_30px_rgba(229,3,162,0.4)] transition-shadow disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {paymentRetrying ? "מנסה שוב…" : "מעבר לתשלום"}
            <span>←</span>
          </button>
          <div className="text-xs text-gray-500 space-y-2 pt-2">
            <div>{pdfDownload}</div>
            <div>
              נתקלת בבעיה?{" "}
              <a href="https://www.fuzionwebz.com/contact" className="text-cyan hover:underline">
                צור קשר
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (postSignState === "no-payment-needed") {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="max-w-md text-center bg-white/5 border border-white/10 backdrop-blur-sm rounded-2xl p-10 space-y-5">
          <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-pink to-cyan flex items-center justify-center text-3xl">
            ✓
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">ההסכם נחתם בהצלחה</h1>
          <p className="text-sm text-gray-300">תודה! אין צורך בתשלום במסלול זה.</p>
          <div className="pt-2">{pdfDownload}</div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Brand header */}
      <header className="px-6 pt-10 pb-6 text-center">
        <h1
          dir="ltr"
          className="text-3xl md:text-5xl font-extrabold tracking-[-0.04em]"
        >
          FUZION <span className="text-gray-500">WEBZ</span>
        </h1>
        <div className="w-24 h-[2px] mx-auto mt-4 bg-gradient-to-r from-pink to-cyan" />
        <p className="mt-4 text-[10px] sm:text-xs tracking-[0.35em] uppercase text-gray-500">
          Digital Agreement · חתימה דיגיטלית מאובטחת
        </p>
      </header>

      <main className="max-w-3xl mx-auto px-4 pb-16 space-y-8">
        {/* Pricing summary card */}
        <section className="bg-white/5 border border-white/10 backdrop-blur-sm rounded-2xl p-6 md:p-8">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="text-[10px] tracking-[0.3em] uppercase text-gray-500">מסלול שירות</div>
              <div className="text-xl md:text-2xl font-bold mt-1">
                {priceInfo.tierLabel ? `מסלול ${priceInfo.tierLabel}` : "חבילה מותאמת אישית"}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] tracking-[0.3em] uppercase text-gray-500">תשלום חודשי</div>
              <div className="text-2xl md:text-3xl font-extrabold mt-1">
                {fmtNum(priceInfo.monthlyPrice)}
                <span className="text-base text-gray-400 mr-1">₪</span>
                <span className="text-sm text-gray-500"> + מע״מ</span>
              </div>
              <div className="text-[11px] text-gray-500 mt-1">
                סה״כ לחיוב: <span className="font-mono text-gray-300">{fmtNum(withVat(priceInfo.monthlyPrice))} ₪</span>
              </div>
            </div>
          </div>
          {priceInfo.oneTimeFee ? (
            <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between text-sm">
              <span className="text-gray-400">סכום הקמה חד-פעמי</span>
              <div className="text-left">
                <div className="font-mono">
                  {fmtNum(priceInfo.oneTimeFee)} ₪ <span className="text-xs text-gray-500">+ מע״מ</span>
                </div>
                <div className="text-[10px] text-gray-500 mt-0.5">
                  סה״כ לחיוב: <span className="font-mono">{fmtNum(withVat(priceInfo.oneTimeFee))} ₪</span>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        {/* Agreement preview */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs tracking-[0.3em] uppercase text-gray-500">תוכן ההסכם</h2>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>גלול בתוך המסמך לקריאה מלאה</span>
              <svg className="w-3.5 h-3.5 animate-bounce text-pink" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
          </div>
          <article
            className="bg-white text-black rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
          >
            <iframe
              srcDoc={content}
              sandbox=""
              title="הסכם"
              className="w-full"
              style={{ height: "70vh", border: "0" }}
            />
          </article>
        </section>

        {/* Sign form */}
        <form onSubmit={handleSubmit} className="bg-white/5 border border-white/10 backdrop-blur-sm rounded-2xl p-6 md:p-8 space-y-5">
          <div>
            <h2 className="text-xl font-bold">פרטי החותם</h2>
            <p className="text-sm text-gray-400 mt-1">אנא ודא שכל הפרטים נכונים. הם יופיעו על ההסכם החתום.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs tracking-wide text-gray-400 mb-1">שם מלא *</label>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-pink"
              />
            </div>
            <div>
              <label className="block text-xs tracking-wide text-gray-400 mb-1">שם העסק</label>
              <input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-pink"
              />
            </div>
            <div>
              <label className="block text-xs tracking-wide text-gray-400 mb-1">ח.פ. / ע.מ.</label>
              <input
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-pink"
              />
            </div>
            <div>
              <label className="block text-xs tracking-wide text-gray-400 mb-1">טלפון *</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                inputMode="tel"
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-pink"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs tracking-wide text-gray-400 mb-1">אימייל *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-pink"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs tracking-wide text-gray-400">חתימה *</label>
              <button
                type="button"
                onClick={clearSignature}
                className="text-xs text-cyan hover:underline"
              >
                נקה חתימה
              </button>
            </div>
            <canvas
              ref={canvasRef}
              className="w-full bg-white rounded-xl border-2 border-dashed border-white/20 touch-none cursor-crosshair"
              style={{ height: 160 }}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={endDraw}
            />
          </div>

          <label className="flex items-start gap-3 text-sm text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 w-4 h-4 accent-pink"
            />
            <span>
              קראתי את ההסכם במלואו ואני מסכים/ה לכל התנאים, לרבות תקופת ההתקשרות, התמורה ומסירת ההסכם בחתימה דיגיטלית בהתאם לחוק חתימה אלקטרונית, התשס״א-2001.
            </span>
          </label>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !hasSignature || !agreed}
            className="w-full bg-gradient-to-r from-pink to-cyan text-black font-extrabold py-3.5 rounded-full hover:shadow-[0_0_40px_rgba(229,3,162,0.45)] disabled:opacity-40 disabled:cursor-not-allowed transition-shadow"
          >
            {submitting ? "חותם..." : "אישור וחתימה על ההסכם"}
          </button>

          <p className="text-[11px] text-center text-gray-500">
            על ידי לחיצה על &quot;אישור וחתימה&quot; אתה מאשר שקראת את ההסכם והבנת את תוכנו.
            <br />
            ייאספו וייתועדו: מועד החתימה, כתובת ה-IP שלך וזיהוי הדפדפן, לצורך תיעוד משפטי.
          </p>
        </form>

        <footer className="text-center text-xs text-gray-600 pt-6">
          <a href="https://www.fuzionwebz.com" className="hover:text-cyan">
            fuzionwebz.com
          </a>
        </footer>
      </main>
    </>
  );
}
