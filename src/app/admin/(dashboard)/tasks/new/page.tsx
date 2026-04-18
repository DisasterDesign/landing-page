"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";

interface User {
  id: string;
  name: string;
}

const statusOptions = [
  { value: "TODO", label: "לביצוע" },
  { value: "IN_PROGRESS", label: "בביצוע" },
  { value: "REVIEW", label: "לבדיקה" },
  { value: "DONE", label: "הושלם" },
];

export default function NewTaskPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("TODO");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await fetch("/api/users");
        if (!res.ok) {
          throw new Error(`status ${res.status}`);
        }
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.users || [];
        setUsers(list);
      } catch (err) {
        console.error("Failed to fetch users:", err);
        toast.error("שגיאה בטעינת רשימת המשתמשים");
      } finally {
        setLoadingUsers(false);
      }
    }
    fetchUsers();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!title.trim()) {
      toast.error("כותרת היא שדה חובה");
      return;
    }

    if (!assigneeId) {
      toast.error("יש לבחור משתמש לשיוך");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          status,
          assigneeId,
          dueDate: dueDate || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "שגיאה ביצירת המשימה");
      }

      toast.success("המשימה נוצרה בהצלחה!");
      router.push("/admin/tasks");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "שגיאה ביצירת המשימה";
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
        <h2 className="text-2xl font-bold">משימה חדשה</h2>
      </div>

      <form onSubmit={handleSubmit} className="bg-gray-900 rounded-2xl border border-gray-700 p-6 space-y-5">
        {/* Title */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            כותרת <span className="text-pink">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="למשל: עיצוב דף הבית"
            required
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 outline-none focus:border-pink transition-colors"
          />
        </div>

        {/* Description */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">תיאור</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="תיאור המשימה..."
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

        {/* Assignee */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">
            משויך ל <span className="text-pink">*</span>
          </label>
          <select
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            required
            disabled={loadingUsers}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:border-pink transition-colors disabled:opacity-50"
          >
            <option value="">{loadingUsers ? "טוען..." : "בחר משתמש"}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          {!loadingUsers && users.length === 0 && (
            <p className="text-xs text-red-400">לא נטענו משתמשים — בדוק חיבור לשרת.</p>
          )}
        </div>

        {/* Due Date */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-300">תאריך יעד</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white outline-none focus:border-pink transition-colors"
          />
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-3 bg-pink hover:bg-pink-dark text-white font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "יוצר..." : "צור משימה"}
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
