"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import AssigneePicker from "@/components/admin/AssigneePicker";

interface Comment {
  id: string;
  content: string;
  author: { id: string; name: string };
  createdAt: string;
}

interface TaskDetail {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  tags: string[];
  assignees: { id: string; name: string }[];
  comments: Comment[];
}

interface SelectOption {
  id: string;
  name: string;
}

const toastStyle = {
  background: "#1A1A1A",
  color: "#fff",
  border: "1px solid #3A3A3A",
};

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [users, setUsers] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [tags, setTags] = useState("");

  const fetchTask = useCallback(async () => {
    try {
      const [taskRes, usersRes] = await Promise.all([
        fetch(`/api/tasks/${id}`),
        fetch("/api/users"),
      ]);

      if (taskRes.ok) {
        const t = await taskRes.json();
        setTask(t);
        setTitle(t.title);
        setDescription(t.description || "");
        setAssigneeIds((t.assignees ?? []).map((a: { id: string }) => a.id));
        setDueDate(t.dueDate ? t.dueDate.slice(0, 10) : "");
        setTags(t.tags?.join(", ") || "");
      }

      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(Array.isArray(data) ? data : data.users || []);
      }
    } catch (err) {
      console.error("Failed to fetch task:", err);
      toast.error("שגיאה בטעינת המשימה", { style: toastStyle });
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTask();
  }, [fetchTask]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description: description || null,
          assigneeIds,
          dueDate: dueDate || null,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      });

      if (res.ok) {
        toast.success("המשימה עודכנה בהצלחה", { style: toastStyle });
        fetchTask();
      } else {
        toast.error("שגיאה בעדכון המשימה", { style: toastStyle });
      }
    } catch {
      toast.error("שגיאה בעדכון המשימה", { style: toastStyle });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("המשימה נמחקה", { style: toastStyle });
        router.push("/admin/tasks");
      } else {
        toast.error("שגיאה במחיקת המשימה", { style: toastStyle });
      }
    } catch {
      toast.error("שגיאה במחיקת המשימה", { style: toastStyle });
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      const res = await fetch(`/api/tasks/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newComment }),
      });

      if (res.ok) {
        setNewComment("");
        fetchTask();
        toast.success("תגובה נוספה", { style: toastStyle });
      }
    } catch {
      toast.error("שגיאה בהוספת תגובה", { style: toastStyle });
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="h-8 w-48 bg-gray-800 rounded animate-pulse" />
        <div className="bg-gray-900 rounded-2xl border border-gray-700 p-6 space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-800 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400 text-lg">המשימה לא נמצאה</p>
        <button
          onClick={() => router.push("/admin/tasks")}
          className="mt-4 text-pink hover:underline"
        >
          חזרה למשימות
        </button>
      </div>
    );
  }

  const selectClasses =
    "w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-pink transition-colors";
  const labelClasses = "block text-sm text-gray-400 mb-1.5";

  return (
    <div className="tasks-area max-w-3xl mx-auto space-y-6">
      <Toaster position="top-center" />

      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push("/admin/tasks")}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          חזרה למשימות
        </button>
      </div>

      {/* Task Form */}
      <div className="bg-gray-900 rounded-2xl border border-gray-700 p-6 space-y-5">
        <div>
          <label className={labelClasses}>כותרת</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={selectClasses}
          />
        </div>

        <div>
          <label className={labelClasses}>תיאור</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className={`${selectClasses} resize-none`}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClasses}>משויך ל</label>
            <AssigneePicker
              users={users}
              selectedIds={assigneeIds}
              onChange={setAssigneeIds}
            />
          </div>

          <div>
            <label className={labelClasses}>תאריך יעד</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={selectClasses}
              dir="ltr"
            />
          </div>

          <div>
            <label className={labelClasses}>תגיות (מופרדות בפסיק)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className={selectClasses}
              placeholder="עיצוב, פרונט, באג"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-pink hover:bg-pink-dark text-white font-bold rounded-xl transition-colors disabled:opacity-50 text-sm"
          >
            {saving ? "שומר..." : "שמור שינויים"}
          </button>

          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-6 py-2.5 bg-red-900/40 hover:bg-red-900/70 text-red-300 font-bold rounded-xl transition-colors text-sm"
          >
            מחק משימה
          </button>
        </div>
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-900 rounded-2xl border border-gray-700 p-6 max-w-sm w-full mx-4 space-y-4">
            <h3 className="text-lg font-bold">מחיקת משימה</h3>
            <p className="text-gray-400 text-sm">
              האם אתה בטוח שברצונך למחוק את המשימה &quot;{task.title}&quot;?
              פעולה זו בלתי הפיכה.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors text-sm flex-1"
              >
                מחק
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition-colors text-sm flex-1"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comments */}
      <div className="bg-gray-900 rounded-2xl border border-gray-700 p-6 space-y-4">
        <h3 className="text-lg font-bold">תגובות</h3>

        {task.comments && task.comments.length > 0 ? (
          <div className="space-y-4">
            {task.comments.map((comment) => (
              <div
                key={comment.id}
                className="bg-gray-800 rounded-xl p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-cyan/20 text-cyan flex items-center justify-center text-[10px] font-bold">
                      {comment.author.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)}
                    </div>
                    <span className="text-sm font-medium">
                      {comment.author.name}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(comment.createdAt).toLocaleDateString("he-IL")}
                  </span>
                </div>
                <p className="text-sm text-gray-300">{comment.content}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">אין תגובות עדיין</p>
        )}

        <form onSubmit={handleAddComment} className="flex gap-3">
          <input
            type="text"
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="הוסף תגובה..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-pink transition-colors"
          />
          <button
            type="submit"
            className="px-4 py-2.5 bg-cyan/20 hover:bg-cyan/30 text-cyan font-bold rounded-xl transition-colors text-sm"
          >
            שלח
          </button>
        </form>
      </div>
    </div>
  );
}
