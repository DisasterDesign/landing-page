"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Signature + sign-off block for the Ormat proposal. Posts to the existing
 * public sign endpoint (/api/agreements/sign/[token]) — same flow as the
 * standard agreement, so the Cardcom first charge, webhook and audit trail all
 * work unchanged — but styled for the dark proposal page. On success it
 * redirects to Cardcom; if the URL isn't ready yet it retries the dedicated
 * payment endpoint with backoff (mirrors SignAgreementClient).
 */
export default function OrmatSignBlock({
  token,
  firstPaymentLabel,
}: {
  token: string;
  firstPaymentLabel: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [hasSignature, setHasSignature] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [businessName, setBusinessName] = useState("Ormat Technologies");
  const [idNumber, setIdNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [agreed, setAgreed] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<"form" | "preparing" | "failed" | "done">("form");
  const [retrying, setRetrying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

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

  const point = (e: PointerEvent | MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    let cx: number, cy: number;
    if ("touches" in e && e.touches.length) {
      cx = e.touches[0].clientX;
      cy = e.touches[0].clientY;
    } else if ("changedTouches" in e && e.changedTouches.length) {
      cx = e.changedTouches[0].clientX;
      cy = e.changedTouches[0].clientY;
    } else {
      cx = (e as MouseEvent).clientX;
      cy = (e as MouseEvent).clientY;
    }
    return { x: cx - rect.left, y: cy - rect.top };
  };
  const start = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    drawing.current = true;
    last.current = point(e.nativeEvent);
  };
  const move = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    const l = last.current;
    if (!ctx || !l) return;
    const p = point(e.nativeEvent);
    ctx.beginPath();
    ctx.moveTo(l.x, l.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (!hasSignature) setHasSignature(true);
  };
  const end = () => {
    drawing.current = false;
    last.current = null;
  };
  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, rect.width, rect.height);
    setHasSignature(false);
  };

  const fetchPayment = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch(`/api/agreements/sign/${token}/payment`, { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.url) {
        setPayError(typeof json.error === "string" ? json.error : "שגיאה ביצירת לינק תשלום");
        return false;
      }
      window.location.href = json.url;
      return true;
    } catch {
      setPayError("שגיאה ביצירת לינק תשלום");
      return false;
    }
  }, [token]);

  useEffect(() => {
    if (state !== "preparing") return;
    let cancelled = false;
    const delays = [0, 2000, 6000];
    (async () => {
      for (let i = 0; i < delays.length; i++) {
        if (cancelled) return;
        if (delays[i] > 0) await new Promise((r) => setTimeout(r, delays[i]));
        if (cancelled) return;
        if (await fetchPayment()) return;
      }
      if (!cancelled) setState("failed");
    })();
    return () => {
      cancelled = true;
    };
  }, [state, fetchPayment]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!hasSignature || !canvasRef.current) return setError("נא לחתום בחתימה");
    if (!agreed) return setError("נא לאשר את התנאים");
    if (!customerName.trim()) return setError("נא להזין את שם החותם");
    if (phone.replace(/\D/g, "").length < 9) return setError("נא להזין מספר טלפון תקין");
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
        const msg =
          res.status === 400
            ? "אחד הפרטים שהוזנו אינו תקין. אנא בדקו את השדות ונסו שוב."
            : json.error || "שגיאה בחתימה";
        throw new Error(msg);
      }
      const json = (await res.json().catch(() => ({}))) as { paymentUrl?: string };
      if (json.paymentUrl) {
        window.location.href = json.paymentUrl;
        return;
      }
      setState("preparing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בחתימה");
    } finally {
      setSubmitting(false);
    }
  };

  const retry = async () => {
    setRetrying(true);
    setPayError(null);
    if (!(await fetchPayment())) setRetrying(false);
  };

  if (state === "preparing" || state === "failed") {
    return (
      <div className="max-w-md mx-auto text-center bg-white/5 border border-white/10 backdrop-blur-sm rounded-2xl p-10 space-y-5">
        <div className="w-16 h-16 mx-auto rounded-full bg-gradient-to-br from-pink to-cyan flex items-center justify-center text-3xl text-black">
          ✓
        </div>
        <h3 className="text-2xl font-extrabold tracking-tight">ההצעה נחתמה בהצלחה</h3>
        {state === "preparing" ? (
          <div className="flex items-center justify-center gap-3 text-gray-300">
            <div className="w-5 h-5 border-2 border-pink border-t-transparent rounded-full animate-spin" />
            <span>מכין דף תשלום מאובטח…</span>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-300">נותר רק להשלים את התשלום הראשון. הלינק מוכן.</p>
            {payError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-xs rounded-xl px-3 py-2">
                {payError}
              </div>
            )}
            <button
              onClick={retry}
              disabled={retrying}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-pink to-cyan text-black font-bold px-8 py-3 rounded-full disabled:opacity-60"
            >
              {retrying ? "מנסה שוב…" : "מעבר לתשלום"} <span aria-hidden>←</span>
            </button>
          </>
        )}
      </div>
    );
  }

  const inputCls =
    "w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-pink text-white";

  return (
    <form onSubmit={submit} className="max-w-2xl mx-auto bg-white/5 border border-white/10 backdrop-blur-sm rounded-3xl p-6 md:p-8 space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">שם החותם *</label>
          <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} required className={inputCls} />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">שם החברה</label>
          <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">ח.פ. / מספר חברה</label>
          <input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">טלפון *</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} required inputMode="tel" className={inputCls} />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs text-gray-400 mb-1">אימייל *</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputCls} />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-gray-400">חתימה *</label>
          <button type="button" onClick={clear} className="text-xs text-cyan hover:underline">
            נקה חתימה
          </button>
        </div>
        <canvas
          ref={canvasRef}
          className="w-full bg-white rounded-xl border-2 border-dashed border-white/20 touch-none cursor-crosshair"
          style={{ height: 160 }}
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        />
      </div>

      <label className="flex items-start gap-3 text-sm text-gray-300 cursor-pointer">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-1 w-4 h-4 accent-pink" />
        <span>
          קראתי את ההצעה במלואה ואני מסכים/ה לכל התנאים, לרבות התמורה ותנאי התשלום, ומסירת ההסכם בחתימה
          דיגיטלית בהתאם לחוק חתימה אלקטרונית, התשס״א-2001.
        </span>
      </label>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-xl px-4 py-3">{error}</div>
      )}

      <button
        type="submit"
        disabled={submitting || !hasSignature || !agreed}
        className="w-full bg-gradient-to-r from-pink to-cyan text-black font-extrabold py-4 rounded-full hover:shadow-[0_0_40px_rgba(229,3,162,0.45)] disabled:opacity-40 disabled:cursor-not-allowed transition-shadow"
      >
        {submitting ? "חותם…" : `אישור, חתימה ומעבר לתשלום · ${firstPaymentLabel}`}
      </button>
      <p className="text-[11px] text-center text-gray-500">
        בלחיצה על אישור וחתימה ייאספו מועד החתימה, כתובת ה-IP ומזהה הדפדפן לצורך תיעוד משפטי.
      </p>
    </form>
  );
}
