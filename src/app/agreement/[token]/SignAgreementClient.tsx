"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  token: string;
  content: string;
  initial: {
    customerName: string;
    businessName: string | null;
    idNumber: string | null;
    phone: string;
    email: string;
  };
}

export default function SignAgreementClient({ token, content, initial }: Props) {
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
  const [done, setDone] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Scale for retina
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
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בחתימה");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div dir="rtl" className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center px-6">
        <div className="max-w-md text-center bg-gray-900 border border-gray-800 rounded-2xl p-10">
          <div className="text-6xl mb-4">✓</div>
          <h1 className="text-2xl font-bold mb-3">ההסכם נחתם בהצלחה</h1>
          <p className="text-gray-400">תודה! עותק חתום נשמר במערכת.</p>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="min-h-screen bg-gray-950 text-gray-100">
      <header className="bg-gray-900 border-b border-gray-800 py-4 px-6 text-center">
        <h1 className="text-lg font-bold">חתימה על הסכם — Fuzion Webz</h1>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        <article
          className="bg-white text-black rounded-2xl overflow-hidden border border-gray-300"
          style={{ minHeight: "60vh" }}
        >
          <iframe
            srcDoc={content}
            sandbox=""
            title="הסכם"
            className="w-full"
            style={{ height: "70vh", border: "0" }}
          />
        </article>

        <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
          <h2 className="text-xl font-bold">פרטי החותם</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">שם מלא *</label>
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-pink"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">שם העסק</label>
              <input
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-pink"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">ח.פ. / ת.ז.</label>
              <input
                value={idNumber}
                onChange={(e) => setIdNumber(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-pink"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">טלפון *</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                inputMode="tel"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-pink"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-400 mb-1">אימייל *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm outline-none focus:border-pink"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-gray-400">חתימה *</label>
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
              className="w-full bg-white rounded-xl border-2 border-dashed border-gray-700 touch-none cursor-crosshair"
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
            <span>קראתי את ההסכם במלואו ואני מסכים/ה לכל התנאים המפורטים בו.</span>
          </label>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !hasSignature || !agreed}
            className="w-full bg-pink hover:bg-pink-light disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors"
          >
            {submitting ? "חותם..." : "חתום על ההסכם"}
          </button>
        </form>
      </main>
    </div>
  );
}
