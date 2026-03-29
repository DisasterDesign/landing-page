"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import toast, { Toaster } from "react-hot-toast";

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  assignee?: { name: string } | null;
}

interface ProjectDetail {
  id: string;
  name: string;
  client: string | null;
  description: string | null;
  status: string;
  tasks: Task[];
}

const statusOptions = [
  { value: "ACTIVE", label: "פעיל" },
  { value: "ON_HOLD", label: "בהמתנה" },
  { value: "COMPLETED", label: "הושלם" },
  { value: "ARCHIVED", label: "בארכיון" },
];

const taskStatusLabels: Record<string, string> = {
  TODO: "לביצוע",
  IN_PROGRESS: "בביצוע",
  REVIEW: "לבדיקה",
  DONE: "הושלם",
};

const priorityLabels: Record<string, { label: string; color: string }> = {
  LOW: { label: "נמוכה", color: "bg-gray-600 text-gray-300" },
  MEDIUM: { label: "בינונית", color: "bg-blue-900/60 text-blue-300" },
  HIGH: { label: "גבוהה", color: "bg-orange-900/60 text-orange-300" },
  URGENT: { label: "דחופה", color: "bg-red-900/60 text-red-300" },
};

const toastStyle = {
  background: "#1A1A1A",
  color: "#fff",
  border: "1px solid #3A3A3A",
};

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("ACTIVE");

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (res.ok) {
        const p = await res.json();
        setProject(p);
        setName(p.name);
        setClient(p.client || "");
        setDescription(p.description || "");
        setStatus(p.status);
      }
    } catch (err) {
      console.error("Failed to fetch project:", err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          client: client || null,
          description: description || null,
          status,
        }),
      });

      if (res.ok) {
        toast.success("הפרויקט עודכן בהצלחה", { style: toastStyle });
        fetchProject();
      } else {
        toast.error("שגיאה בעדכון הפרויקט", { style: toastStyle });
      }
    } catch {
      toast.error("שגיאה בעדכון הפרויקט", { style: toastStyle });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="h-8 w-48 bg-gray-800 rounded animate-pulse" />
        <div className="bg-gray-900 rounded-2xl border border-gray-700 p-6 h-60 animate-pulse" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400 text-lg">הפרויקט לא נמצא</p>
        <button
          onClick={() => router.push("/admin/projects")}
          className="mt-4 text-pink hover:underline"
        >
          חזרה לפרויקטים
        </button>
      </div>
    );
  }

  const selectClasses =
    "w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-pink transition-colors";
  const labelClasses = "block text-sm text-gray-400 mb-1.5";

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Toaster position="top-center" />

      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push("/admin/projects")}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          חזרה לפרויקטים
        </button>
      </div>

      {/* Project Info */}
      <div className="bg-gray-900 rounded-2xl border border-gray-700 p-6 space-y-5">
        <h2 className="text-xl font-bold">פרטי פרויקט</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClasses}>שם הפרויקט</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={selectClasses}
            />
          </div>

          <div>
            <label className={labelClasses}>לקוח</label>
            <input
              type="text"
              value={client}
              onChange={(e) => setClient(e.target.value)}
              className={selectClasses}
            />
          </div>

          <div>
            <label className={labelClasses}>סטטוס</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className={selectClasses}
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelClasses}>תיאור</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className={`${selectClasses} resize-none`}
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-pink hover:bg-pink-dark text-white font-bold rounded-xl transition-colors disabled:opacity-50 text-sm"
        >
          {saving ? "שומר..." : "שמור שינויים"}
        </button>
      </div>

      {/* Tasks for this project */}
      <div className="bg-gray-900 rounded-2xl border border-gray-700 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">משימות הפרויקט</h3>
          <Link
            href={`/admin/tasks?project=${id}`}
            className="flex items-center gap-2 px-3 py-1.5 bg-pink/20 hover:bg-pink/30 text-pink font-bold rounded-xl transition-colors text-xs"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            הוסף משימה
          </Link>
        </div>

        {project.tasks && project.tasks.length > 0 ? (
          <div className="space-y-2">
            {project.tasks.map((task) => {
              const pInfo = priorityLabels[task.priority] || priorityLabels.MEDIUM;
              return (
                <Link
                  key={task.id}
                  href={`/admin/tasks/${task.id}`}
                  className="flex items-center justify-between bg-gray-800 rounded-xl p-4 hover:bg-gray-750 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-white">
                      {task.title}
                    </span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${pInfo.color}`}
                    >
                      {pInfo.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">
                      {taskStatusLabels[task.status] || task.status}
                    </span>
                    {task.assignee && (
                      <div className="w-6 h-6 rounded-full bg-cyan/20 text-cyan flex items-center justify-center text-[10px] font-bold">
                        {task.assignee.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-500 py-4">
            אין משימות בפרויקט זה עדיין
          </p>
        )}
      </div>
    </div>
  );
}
