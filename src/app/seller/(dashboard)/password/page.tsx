"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function SellerPasswordPage() {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 8) {
      toast.error("הסיסמה החדשה חייבת להיות באורך 8 תווים לפחות");
      return;
    }
    if (next !== confirm) {
      toast.error("אימות הסיסמה אינו תואם");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/seller/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "שגיאה בהחלפת הסיסמה");
      toast.success("הסיסמה הוחלפה! 🎉");
      router.push("/seller");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה");
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-pink";

  return (
    <div dir="rtl" className="max-w-md mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">החלפת סיסמה</h1>
        <p className="text-sm text-gray-400 mt-1">
          בחר/י סיסמה אישית חדשה (לפחות 8 תווים) במקום סיסמת ההתחלה.
        </p>
      </div>

      <form onSubmit={submit} className="bg-gray-900 border border-gray-700 rounded-2xl p-6 space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-1">סיסמה נוכחית</label>
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
            autoComplete="current-password"
            className={inputClass}
            dir="ltr"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">סיסמה חדשה</label>
          <input
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className={inputClass}
            dir="ltr"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-400 mb-1">אימות סיסמה חדשה</label>
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            className={inputClass}
            dir="ltr"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-pink hover:bg-pink-dark text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50"
        >
          {submitting ? "מחליף..." : "החלף סיסמה"}
        </button>
      </form>
    </div>
  );
}
