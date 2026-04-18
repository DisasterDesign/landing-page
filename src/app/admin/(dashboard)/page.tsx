"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import RevenueChart from "@/components/admin/RevenueChart";

interface DashboardStats {
  activeTasks: number;
  inProgress: number;
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
    inProgress: 0,
    dueThisWeek: 0,
    newMessages: 0,
  });
  const [myTasks, setMyTasks] = useState<MyTask[]>([]);
  const [loading, setLoading] = useState(true);

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
            activeTasks: data.tasks?.total ?? 0,
            inProgress: data.tasks?.IN_PROGRESS ?? 0,
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
      label: "בביצוע",
      value: stats.inProgress,
      accent: "cyan",
      icon: (
        <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
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
              return (
                <li key={t.id}>
                  <Link
                    href={`/admin/tasks/${t.id}`}
                    className="flex items-center gap-3 py-3 hover:bg-gray-800/40 px-2 -mx-2 rounded-lg transition-colors"
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-pink" aria-hidden />
                    <span className="flex-1 text-sm text-white truncate">
                      {t.title}
                    </span>
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
