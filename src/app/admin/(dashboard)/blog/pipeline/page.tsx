"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

type Status = "DRAFT" | "READY" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";

interface PipelinePost {
  id: string;
  title: string;
  slug: string;
  status: Status;
  scheduledAt: string | null;
  targetKeyword: string | null;
  contentScore: number | null;
}

interface PipelineStats {
  counts: Record<Status, number>;
  nextScheduled: {
    id: string;
    title: string;
    slug: string;
    scheduledAt: string;
  } | null;
  totalKeywords: number;
}

const STATUS_LABELS: Record<Status, string> = {
  DRAFT: "טיוטה",
  READY: "מוכן",
  SCHEDULED: "מתוזמן",
  PUBLISHED: "פורסם",
  ARCHIVED: "גנוז",
};

const STATUS_BADGE: Record<Status, string> = {
  DRAFT: "bg-gray-800 text-gray-300",
  READY: "bg-blue-900/50 text-blue-400",
  SCHEDULED: "bg-pink/20 text-pink",
  PUBLISHED: "bg-green-900/50 text-green-400",
  ARCHIVED: "bg-red-900/50 text-red-400",
};

const STATUS_ORDER: Record<Status, number> = {
  DRAFT: 0,
  READY: 1,
  SCHEDULED: 2,
  ARCHIVED: 3,
  PUBLISHED: 4,
};

export default function BlogPipelinePage() {
  const [stats, setStats] = useState<PipelineStats | null>(null);
  const [posts, setPosts] = useState<PipelinePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [scheduleInputId, setScheduleInputId] = useState<string | null>(null);
  const [scheduleDraft, setScheduleDraft] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  async function loadAll() {
    setLoading(true);
    try {
      const [statsRes, postsRes] = await Promise.all([
        fetch("/api/blog/pipeline"),
        fetch("/api/blog?all=true&limit=100"),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (postsRes.ok) {
        const data = await postsRes.json();
        setPosts(data.posts || []);
      }
    } catch (err) {
      console.error("Failed to load pipeline:", err);
      toast.error("טעינה נכשלה");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function markReady(post: PipelinePost) {
    setBusyId(post.id);
    try {
      const res = await fetch(`/api/blog/edit/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "READY" }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("סומן כמוכן");
      await loadAll();
    } catch (err) {
      console.error(err);
      toast.error("עדכון נכשל");
    } finally {
      setBusyId(null);
    }
  }

  async function submitSchedule(post: PipelinePost) {
    if (!scheduleDraft) {
      toast.error("בחר תאריך");
      return;
    }
    setBusyId(post.id);
    try {
      const scheduledAt = new Date(scheduleDraft).toISOString();
      const res = await fetch(`/api/blog/schedule/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("תוזמן בהצלחה");
      setScheduleInputId(null);
      setScheduleDraft("");
      await loadAll();
    } catch (err) {
      console.error(err);
      toast.error("תזמון נכשל");
    } finally {
      setBusyId(null);
    }
  }

  async function unschedule(post: PipelinePost) {
    setBusyId(post.id);
    try {
      const res = await fetch(`/api/blog/schedule/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: null }),
      });
      if (!res.ok) throw new Error(await res.text());
      toast.success("התזמון בוטל");
      await loadAll();
    } catch (err) {
      console.error(err);
      toast.error("ביטול נכשל");
    } finally {
      setBusyId(null);
    }
  }

  async function scheduleAllReady() {
    if (!stats || stats.counts.READY === 0) {
      toast("אין מאמרים מוכנים לתזמון");
      return;
    }
    setBulkBusy(true);
    try {
      const res = await fetch("/api/blog/bulk-schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      toast.success(`${data.scheduled} מאמרים תוזמנו`);
      await loadAll();
    } catch (err) {
      console.error(err);
      toast.error("תזמון נכשל");
    } finally {
      setBulkBusy(false);
    }
  }

  const pipelinePosts = posts
    .filter((p) => p.status !== "PUBLISHED")
    .sort((a, b) => {
      const order = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (order !== 0) return order;
      const aTime = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0;
      const bTime = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0;
      return aTime - bTime;
    });

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 bg-gray-800 rounded animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 bg-gray-800 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-12 bg-gray-800 rounded-xl animate-pulse" />
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-14 bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const counts = stats?.counts ?? {
    DRAFT: 0,
    READY: 0,
    SCHEDULED: 0,
    PUBLISHED: 0,
    ARCHIVED: 0,
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">צינור תוכן</h2>
          <p className="text-sm text-gray-400 mt-1">
            {stats ? `${stats.totalKeywords} מילות מפתח שונות` : ""}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {(Object.keys(STATUS_LABELS) as Status[]).map((s) => (
          <div
            key={s}
            className="bg-gray-900 border border-gray-700 rounded-xl p-4"
          >
            <div className="text-sm text-gray-400">{STATUS_LABELS[s]}</div>
            <div className="text-3xl font-bold mt-1">{counts[s] ?? 0}</div>
          </div>
        ))}
      </div>

      <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm text-gray-300">
          <span className="text-gray-400">מוכנים:</span>{" "}
          <span className="font-bold text-white">{counts.READY}</span>
          <span className="mx-2 text-gray-600">·</span>
          <span className="text-gray-400">מתוזמנים:</span>{" "}
          <span className="font-bold text-white">{counts.SCHEDULED}</span>
          {stats?.nextScheduled && (
            <>
              <span className="mx-2 text-gray-600">·</span>
              <span className="text-gray-400">פרסום הבא:</span>{" "}
              <span className="font-bold text-pink">
                {new Date(stats.nextScheduled.scheduledAt).toLocaleDateString(
                  "he-IL"
                )}
              </span>
            </>
          )}
        </div>
        <button
          onClick={scheduleAllReady}
          disabled={bulkBusy || counts.READY === 0}
          className="bg-pink hover:bg-pink-dark disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          {bulkBusy ? "מתזמן..." : "תזמן את כל המוכנים"}
        </button>
      </div>

      {pipelinePosts.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <p className="text-lg mb-2">הצינור ריק</p>
          <p className="text-sm">צור מאמרים חדשים או סמן מאמרים קיימים כמוכנים</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400">
                <th className="text-right px-4 py-3 font-medium">כותרת</th>
                <th className="text-right px-4 py-3 font-medium">סטטוס</th>
                <th className="text-right px-4 py-3 font-medium hidden md:table-cell">
                  מילת מפתח
                </th>
                <th className="text-right px-4 py-3 font-medium hidden sm:table-cell">
                  תאריך פרסום
                </th>
                <th className="text-right px-4 py-3 font-medium hidden md:table-cell">
                  ציון
                </th>
                <th className="text-right px-4 py-3 font-medium">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {pipelinePosts.map((post) => (
                <tr
                  key={post.id}
                  className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
                >
                  <td className="px-4 py-3 text-white font-medium">
                    <a
                      href={`/admin/blog/${post.id}/edit`}
                      className="hover:text-pink"
                    >
                      {post.title}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-medium ${STATUS_BADGE[post.status]}`}
                    >
                      {STATUS_LABELS[post.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 hidden md:table-cell">
                    {post.targetKeyword || "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-400 hidden sm:table-cell">
                    {post.scheduledAt
                      ? new Date(post.scheduledAt).toLocaleDateString("he-IL")
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-400 hidden md:table-cell">
                    {post.contentScore ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    {post.status === "DRAFT" && (
                      <button
                        onClick={() => markReady(post)}
                        disabled={busyId === post.id}
                        className="text-xs bg-blue-900/50 hover:bg-blue-900 text-blue-300 px-3 py-1.5 rounded-lg disabled:opacity-50"
                      >
                        סמן כמוכן
                      </button>
                    )}
                    {post.status === "READY" && (
                      <>
                        {scheduleInputId === post.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="datetime-local"
                              value={scheduleDraft}
                              onChange={(e) => setScheduleDraft(e.target.value)}
                              className="bg-gray-800 border border-gray-600 text-white text-xs px-2 py-1 rounded"
                            />
                            <button
                              onClick={() => submitSchedule(post)}
                              disabled={busyId === post.id}
                              className="text-xs bg-pink hover:bg-pink-dark text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
                            >
                              אישור
                            </button>
                            <button
                              onClick={() => {
                                setScheduleInputId(null);
                                setScheduleDraft("");
                              }}
                              className="text-xs text-gray-400 hover:text-white"
                            >
                              ביטול
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setScheduleInputId(post.id);
                              setScheduleDraft("");
                            }}
                            className="text-xs bg-pink/20 hover:bg-pink/30 text-pink px-3 py-1.5 rounded-lg"
                          >
                            תזמן
                          </button>
                        )}
                      </>
                    )}
                    {post.status === "SCHEDULED" && (
                      <button
                        onClick={() => unschedule(post)}
                        disabled={busyId === post.id}
                        className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg disabled:opacity-50"
                      >
                        בטל תזמון
                      </button>
                    )}
                    {post.status === "ARCHIVED" && (
                      <span className="text-xs text-gray-500">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
