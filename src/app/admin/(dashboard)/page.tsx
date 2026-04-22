"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import RevenueChart from "@/components/admin/RevenueChart";
import { success as hapticSuccess } from "@/lib/haptic";

interface DashboardStats {
  activeTasks: number;
  myOpen: number;
  dueThisWeek: number;
  newMessages: number;
}

interface MyTask {
  id: string;
  title: string;
  dueDate: string | null;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    activeTasks: 0,
    myOpen: 0,
    dueThisWeek: 0,
    newMessages: 0,
  });
  const [myTasks, setMyTasks] = useState<MyTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<Set<string>>(new Set());

  const markDone = async (task: MyTask) => {
    hapticSuccess();
    setCompleting((prev) => new Set(prev).add(task.id));
    setMyTasks((prev) => prev.filter((t) => t.id !== task.id));
    setStats((prev) => ({
      ...prev,
      myOpen: Math.max(0, prev.myOpen - 1),
      activeTasks: Math.max(0, prev.activeTasks - 1),
    }));
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "DONE" }),
      });
      if (!res.ok) throw new Error();
      toast.success("סומן כבוצע", { duration: 1500, style: { fontSize: "13px" } });
    } catch {
      toast.error("שגיאה בעדכון");
      setMyTasks((prev) => [...prev, task]);
      setStats((prev) => ({
        ...prev,
        myOpen: prev.myOpen + 1,
        activeTasks: prev.activeTasks + 1,
      }));
    } finally {
      setCompleting((prev) => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
    }
  };

  useEffect(() => {
    async function fetchAll() {
      try {
        const [statsRes, tasksRes] = await Promise.all([
          fetch("/api/dashboard/stats"),
          fetch("/api/dashboard/my-tasks"),
        ]);
        if (statsRes.ok) {
          const data = await statsRes.json();
          setStats({
            activeTasks: data.tasks?.TODO ?? 0,
            myOpen: data.myOpenTasks ?? 0,
            dueThisWeek: data.tasksDueThisWeek ?? 0,
            newMessages: data.unreadContacts ?? 0,
          });
        }
        if (tasksRes.ok) {
          const data = await tasksRes.json();
          setMyTasks(data.tasks || []);
        }
      } catch (err) {
        console.error("Failed to load dashboard:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  const statCards = [
    {
      label: "משימות פעילות",
      value: stats.activeTasks,
      accent: "pink",
      icon: (
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
    },
    {
      label: "המשימות שלי",
      value: stats.myOpen,
      accent: "cyan",
      icon: (
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
    {
      label: "לסגירה השבוע",
      value: stats.dueThisWeek,
      accent: "pink",
      icon: (
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      label: "הודעות חדשות",
      value: stats.newMessages,
      accent: "cyan",
      icon: (
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">דשבורד</h2>
        <Link
          href="/admin/tasks/new"
          className="flex items-center gap-2 px-4 py-2 bg-pink hover:bg-pink-dark text-white font-bold rounded-xl transition-colors text-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          הוסף משימה
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="bg-gray-900 rounded-2xl p-6 border border-gray-700 hover:border-gray-600 transition-colors"
          >
            <div className="flex items-start justify-between mb-4">
              <div
                className={`p-2.5 rounded-xl ${
                  card.accent === "pink"
                    ? "bg-pink/10 text-pink"
                    : "bg-cyan/10 text-cyan"
                }`}
              >
                {card.icon}
              </div>
            </div>
            <div
              className={`text-4xl font-bold mb-1 ${
                loading ? "animate-pulse bg-gray-700 rounded w-16 h-10" : ""
              }`}
            >
              {loading ? "" : card.value}
            </div>
            <p className="text-sm text-gray-400">{card.label}</p>
          </div>
        ))}
      </div>

      {/* My open tasks */}
      <div className="tasks-area bg-gray-900 rounded-2xl border border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">המשימות שלי</h3>
          <Link
            href="/admin/tasks"
            className="text-xs text-cyan hover:text-cyan/80 underline-offset-2 hover:underline"
          >
            כל המשימות
          </Link>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 bg-gray-800 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : myTasks.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">
            אין משימות פתוחות שמשויכות אליך 🎉
          </p>
        ) : (
          <ul className="divide-y divide-gray-800">
            {myTasks.map((t) => {
              const due = t.dueDate ? new Date(t.dueDate) : null;
              const overdue = due ? due.getTime() < Date.now() : false;
              const isCompleting = completing.has(t.id);
              return (
                <li key={t.id} className="flex items-center gap-3 py-3 hover:bg-gray-800/40 px-2 -mx-2 rounded-lg transition-colors">
                  <button
                    type="button"
                    onClick={() => markDone(t)}
                    disabled={isCompleting}
                    aria-label="סמן כבוצע"
                    title="סמן כבוצע"
                    className="shrink-0 w-6 h-6 rounded-full border-2 border-gray-600 hover:border-green-500 text-transparent hover:text-green-500/50 disabled:opacity-50 flex items-center justify-center transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <Link
                    href={`/admin/tasks/${t.id}`}
                    className="flex-1 flex items-center gap-3 min-w-0"
                  >
                    <span className="flex-1 text-sm text-white truncate">{t.title}</span>
                    {due && (
                      <span
                        className={`text-[11px] shrink-0 ${
                          overdue ? "text-red-400" : "text-gray-500"
                        }`}
                      >
                        {due.toLocaleDateString("he-IL")}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Revenue Chart */}
      <RevenueChart />
    </div>
  );
}
