"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const CATEGORIES = [
  { value: "serif", label: "סריף" },
  { value: "sans", label: "סאנס" },
  { value: "display", label: "דיספליי" },
  { value: "script", label: "סקריפט" },
  { value: "mono", label: "מונו" },
];

export default function NewFontPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    description: "",
    designer: "",
    category: "",
    previewUrl: "",
    tags: "",
    featured: false,
    published: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/fonts/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          tags: form.tags
            ? form.tags.split(",").map((t) => t.trim()).filter(Boolean)
            : [],
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create font");
      }

      const font = await res.json();
      router.push(`/admin/fonts/${font.id}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה ביצירת הפונט");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-white">הוסף פונט חדש</h1>
        <p className="text-gray-400 text-sm mt-1">
          צור משפחת פונט חדשה בחנות
        </p>
      </div>

      {error && (
        <div className="bg-red-900/30 border border-red-800 text-red-300 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              שם הפונט *
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-pink/50 transition-colors"
              placeholder="לדוגמה: Alef Bold"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              תיאור
            </label>
            <textarea
              rows={3}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-pink/50 transition-colors resize-none"
              placeholder="תיאור קצר על הפונט..."
            />
          </div>

          {/* Designer */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              מעצב
            </label>
            <input
              type="text"
              value={form.designer}
              onChange={(e) => setForm({ ...form, designer: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-pink/50 transition-colors"
              placeholder="שם המעצב"
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              קטגוריה
            </label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-pink/50 transition-colors"
            >
              <option value="">בחר קטגוריה</option>
              {CATEGORIES.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>

          {/* Preview Image URL */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              תמונת תצוגה (URL)
            </label>
            <input
              type="text"
              value={form.previewUrl}
              onChange={(e) => setForm({ ...form, previewUrl: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-pink/50 transition-colors"
              placeholder="https://..."
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              תגיות (מופרדות בפסיק)
            </label>
            <input
              type="text"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-pink/50 transition-colors"
              placeholder="עברית, מודרני, כותרות"
            />
          </div>

          {/* Toggles */}
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) =>
                  setForm({ ...form, featured: e.target.checked })
                }
                className="accent-pink w-4 h-4"
              />
              <span className="text-sm text-gray-300">מומלץ</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.published}
                onChange={(e) =>
                  setForm({ ...form, published: e.target.checked })
                }
                className="accent-pink w-4 h-4"
              />
              <span className="text-sm text-gray-300">פרסם</span>
            </label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={loading}
            className="bg-pink hover:bg-pink/80 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? "שומר..." : "צור פונט"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/admin/fonts")}
            className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-6 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            ביטול
          </button>
        </div>
      </form>
    </div>
  );
}
