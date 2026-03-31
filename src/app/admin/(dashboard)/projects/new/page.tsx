"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";

const statusOptions = [
  { value: "ACTIVE", label: "פעיל" },
  { value: "ON_HOLD", label: "בהמתנה" },
  { value: "COMPLETED", label: "הושלם" },
  { value: "ARCHIVED", label: "בארכיון" },
];

export default function NewProjectPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("ACTIVE");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("שם פרויקט הוא שדה חובה");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          client: client.trim() || undefined,
          description: description.trim() || undefined,
          status,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "שגיאה ביצירת הפרויקט");
      }

      toast.success("הפרויקט נוצר בהצלחה!");
      router.push("/admin/projects");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "שגיאה ביצירת הפרויקט";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6" dir="rtl">
      <Toaster position="top-center" />

      <div className="flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <h2 className="text-2xl font-bold">פרויקט חדש</h2>
      </div>

      <form onSubmit={handleSubmit} className="bg-gray-900 rounded-2xl border border-gray-700 p-6 space-y-5">
        {/* Name */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            שם פרויקט <span className="text-pink">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="למשל: אתר לחברת XYZ"
            required
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 outline-none focus:border-pink transition-colors"
          />
        </div>

        {/* Client */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">לקוח</label>
          <input
            type="text"
            value={client}
            onChange={(e) => setClient(e.target.value)}
            placeholder="שם הלקוח"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 outline-none focus:border-pink transition-colors"
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">תיאור</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="תיאור קצר של הפרויקט..."
            rows={4}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 outline-none focus:border-pink transition-colors resize-none"
          />
        </div>

        {/* Status */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">סטטוס</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:border-pink transition-colors"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-3 bg-pink hover:bg-pink-dark text-white font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "יוצר..." : "צור פרויקט"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-xl transition-colors"
          >
            ביטול
          </button>
        </div>
      </form>
    </div>
  );
}
