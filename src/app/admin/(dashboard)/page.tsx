"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface DashboardStats {
  activeTasks: number;
  inProgress: number;
  dueThisWeek: number;
  newMessages: number;
}

interface ActivityItem {
  id: string;
  text: string;
  time: string;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    activeTasks: 0,
    inProgress: 0,
    dueThisWeek: 0,
    newMessages: 0,
  });
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/dashboard/stats");
        if (res.ok) {
          const data = await res.json();
          setStats({
            activeTasks: data.tasks?.total ?? 0,
            inProgress: data.tasks?.IN_PROGRESS ?? 0,
            dueThisWeek: data.tasksDueThisWeek ?? 0,
            newMessages: data.unreadContacts ?? 0,
          });
        }
      } catch (err) {
        console.error("Failed to fetch dashboard stats:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
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

      {/* Recent Activity */}
      <div className="bg-gray-900 rounded-2xl border border-gray-700 p-6">
        <h3 className="text-lg font-bold mb-4">פעילות אחרונה</h3>
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse flex gap-3 items-center">
                <div className="w-2 h-2 rounded-full bg-gray-700" />
                <div className="h-4 bg-gray-700 rounded flex-1" />
              </div>
            ))}
          </div>
        ) : activity.length > 0 ? (
          <ul className="space-y-3">
            {activity.map((item) => (
              <li key={item.id} className="flex items-start gap-3 text-sm">
                <span className="w-2 h-2 rounded-full bg-pink mt-1.5 flex-shrink-0" />
                <span className="text-gray-300 flex-1">{item.text}</span>
                <span className="text-gray-500 text-xs flex-shrink-0">{item.time}</span>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="space-y-3">
            <li className="flex items-start gap-3 text-sm">
              <span className="w-2 h-2 rounded-full bg-pink mt-1.5 flex-shrink-0" />
              <span className="text-gray-300">משימה חדשה נוצרה: עיצוב דף הבית</span>
              <span className="text-gray-500 text-xs flex-shrink-0">לפני 2 שעות</span>
            </li>
            <li className="flex items-start gap-3 text-sm">
              <span className="w-2 h-2 rounded-full bg-cyan mt-1.5 flex-shrink-0" />
              <span className="text-gray-300">פרויקט &quot;אתר לקוח A&quot; עודכן לבביצוע</span>
              <span className="text-gray-500 text-xs flex-shrink-0">לפני 4 שעות</span>
            </li>
            <li className="flex items-start gap-3 text-sm">
              <span className="w-2 h-2 rounded-full bg-pink mt-1.5 flex-shrink-0" />
              <span className="text-gray-300">הודעה חדשה מ: ישראל ישראלי</span>
              <span className="text-gray-500 text-xs flex-shrink-0">לפני 6 שעות</span>
            </li>
            <li className="flex items-start gap-3 text-sm">
              <span className="w-2 h-2 rounded-full bg-cyan mt-1.5 flex-shrink-0" />
              <span className="text-gray-300">משימה &quot;בניית API&quot; הושלמה</span>
              <span className="text-gray-500 text-xs flex-shrink-0">אתמול</span>
            </li>
            <li className="flex items-start gap-3 text-sm">
              <span className="w-2 h-2 rounded-full bg-pink mt-1.5 flex-shrink-0" />
              <span className="text-gray-300">פרויקט חדש נוצר: חנות אונליין</span>
              <span className="text-gray-500 text-xs flex-shrink-0">לפני יומיים</span>
            </li>
          </ul>
        )}
      </div>
    </div>
  );
}
