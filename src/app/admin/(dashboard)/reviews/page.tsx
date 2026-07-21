"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

interface FeaturedReview {
  author: string;
  rating: number;
  text: string;
  relativeTime: string;
}

const blank = (): FeaturedReview => ({ author: "", rating: 5, text: "", relativeTime: "" });

export default function ReviewsAdminPage() {
  const [reviews, setReviews] = useState<FeaturedReview[]>([]);
  const [live, setLive] = useState<{ rating?: number; count?: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [fRes, pRes] = await Promise.all([
          fetch("/api/reviews/featured", { cache: "no-store" }),
          fetch("/api/reviews", { cache: "no-store" }),
        ]);
        if (fRes.ok) setReviews((await fRes.json()).reviews ?? []);
        if (pRes.ok) {
          const p = await pRes.json();
          if (p.available) {
            setLive({ rating: p.rating, count: p.count });
            setFetchedAt(p.fetchedAt ?? null);
          }
        }
      } catch {
        toast.error("שגיאה בטעינה");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const refreshFromGoogle = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/reviews/refresh", { method: "POST" });
      if (!res.ok) throw new Error();
      const p = await res.json();
      const changed = p.count !== live?.count || p.rating !== live?.rating;
      setLive({ rating: p.rating, count: p.count });
      setFetchedAt(p.fetchedAt ?? null);
      toast.success(changed ? `עודכן: ${p.count} ביקורות, דירוג ${p.rating}` : "אין שינוי בגוגל");
    } catch {
      toast.error("שגיאה במשיכה מגוגל");
    } finally {
      setRefreshing(false);
    }
  };

  const update = (i: number, patch: Partial<FeaturedReview>) =>
    setReviews((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const remove = (i: number) => setReviews((prev) => prev.filter((_, idx) => idx !== i));

  const save = async () => {
    const clean = reviews
      .map((r) => ({ ...r, author: r.author.trim(), text: r.text.trim(), relativeTime: r.relativeTime.trim() }))
      .filter((r) => r.author && r.text);
    setSaving(true);
    try {
      const res = await fetch("/api/reviews/featured", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviews: clean }),
      });
      if (!res.ok) throw new Error();
      setReviews(clean);
      toast.success("נשמר — יופיע בדף הבית");
    } catch {
      toast.error("שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="h-64 bg-gray-900 border border-gray-700 rounded-2xl animate-pulse" />;
  }

  return (
    <div dir="rtl" className="space-y-5 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-white">ביקורות נבחרות</h1>
        <p className="text-sm text-gray-400 mt-1 leading-relaxed">
          הציון ({live?.rating ?? "?"}) ומספר הביקורות ({live?.count ?? "?"}) נמשכים חיים מגוגל.
          את הביקורות שמוצגות בכרטיסים בדף הבית בוחרים כאן ידנית — גוגל לא מספקת את
          הטקסטים דרך ה-API לכרטיס הזה. העתק ביקורות אמיתיות מהעמוד שלך בגוגל.
        </p>

        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <button
            onClick={refreshFromGoogle}
            disabled={refreshing}
            className="text-sm px-4 py-2 rounded-xl bg-gray-800 border border-gray-700 text-white hover:border-pink transition-colors disabled:opacity-50"
          >
            {refreshing ? "מושך מגוגל…" : "משוך מגוגל עכשיו"}
          </button>
          <span className="text-xs text-gray-500">
            {fetchedAt
              ? `עודכן ${new Date(fetchedAt).toLocaleString("he-IL")}.`
              : ""}{" "}
            הנתון מתרענן לבד כל שעה. אחרי שנכנסת ביקורת חדשה, לחץ כאן כדי שתופיע מיד.
          </span>
        </div>
      </div>

      <div className="space-y-4">
        {reviews.map((r, i) => (
          <div key={i} className="bg-gray-900 border border-gray-700 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <input
                value={r.author}
                onChange={(e) => update(i, { author: e.target.value })}
                placeholder="שם הכותב"
                className="flex-1 min-w-[140px] bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-pink"
              />
              <select
                value={r.rating}
                onChange={(e) => update(i, { rating: Number(e.target.value) })}
                className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-pink"
              >
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>
                    {"★".repeat(n)}
                  </option>
                ))}
              </select>
              <input
                value={r.relativeTime}
                onChange={(e) => update(i, { relativeTime: e.target.value })}
                placeholder="לפני חודש (אופציונלי)"
                className="w-40 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-pink"
              />
              <button
                onClick={() => remove(i)}
                className="text-gray-500 hover:text-red-400 transition-colors p-2"
                aria-label="הסר ביקורת"
              >
                ✕
              </button>
            </div>
            <textarea
              value={r.text}
              onChange={(e) => update(i, { text: e.target.value })}
              placeholder="תוכן הביקורת..."
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-pink resize-y"
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => setReviews((prev) => [...prev, blank()])}
          className="px-4 py-2 border border-gray-700 hover:border-cyan text-gray-300 hover:text-cyan rounded-lg transition-colors text-sm font-medium"
        >
          + הוסף ביקורת
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="px-5 py-2 bg-pink text-white rounded-lg hover:bg-pink/85 transition-colors text-sm font-bold disabled:opacity-50"
        >
          {saving ? "שומר..." : "שמור"}
        </button>
      </div>
    </div>
  );
}
