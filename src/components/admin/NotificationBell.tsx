"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

type NotifType =
  | "TASK_ASSIGNED"
  | "TASK_UPDATED"
  | "TASK_COMMENTED"
  | "CONTACT_RECEIVED"
  | "AGREEMENT_SIGNED";

interface NotificationItem {
  id: string;
  type: NotifType;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
  task: { id: string; title: string } | null;
}

function targetUrlFor(n: NotificationItem): string | null {
  switch (n.type) {
    case "TASK_ASSIGNED":
    case "TASK_UPDATED":
    case "TASK_COMMENTED":
      return n.task?.id ? `/admin/tasks/${n.task.id}` : "/admin/tasks";
    case "CONTACT_RECEIVED":
      return "/admin/contacts";
    case "AGREEMENT_SIGNED":
      return "/admin/agreements";
  }
}

const POLL_MS = 30000;

function timeAgo(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  if (m < 1) return "עכשיו";
  if (m < 60) return `לפני ${m} דק׳`;
  const h = Math.floor(m / 60);
  if (h < 24) return `לפני ${h} שע׳`;
  const d = Math.floor(h / 24);
  return `לפני ${d} ימים`;
}

export default function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const json = await res.json();
      setItems(json.notifications || []);
      setUnread(json.unreadCount || 0);
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const markAllRead = async () => {
    if (unread === 0) return;
    setUnread(0);
    setItems((prev) =>
      prev.map((n) => (n.readAt ? n : { ...n, readAt: new Date().toISOString() }))
    );
    try {
      await fetch("/api/notifications", { method: "POST" });
    } catch {
      load();
    }
  };

  const handleClick = async (n: NotificationItem) => {
    setOpen(false);

    if (!n.readAt) {
      setUnread((u) => Math.max(0, u - 1));
      setItems((prev) =>
        prev.map((x) =>
          x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x
        )
      );
      try {
        await fetch(`/api/notifications/${n.id}`, { method: "PATCH" });
      } catch {
        /* ignore */
      }
    }

    const url = targetUrlFor(n);
    if (url) {
      router.push(url);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="התראות"
        className="relative w-9 h-9 rounded-full hover:bg-gray-800 text-gray-300 hover:text-white flex items-center justify-center transition-colors"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-pink text-white text-[10px] font-bold flex items-center justify-center border-2 border-gray-900">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          dir="rtl"
          className="absolute left-0 top-12 w-80 max-w-[92vw] bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl z-50 overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <h3 className="text-sm font-bold text-white">התראות</h3>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-cyan hover:text-cyan/80 underline-offset-2 hover:underline"
              >
                סמן הכל כנקרא
              </button>
            )}
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {items.length === 0 ? (
              <p className="text-center text-sm text-gray-500 py-10 px-4">
                אין התראות חדשות
              </p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full text-right px-4 py-3 border-b border-gray-800 last:border-b-0 hover:bg-gray-800/60 transition-colors block ${
                    n.readAt ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {!n.readAt && (
                      <span className="mt-1.5 w-2 h-2 rounded-full bg-pink shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white">{n.title}</p>
                      {n.body && (
                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                          {n.body}
                        </p>
                      )}
                      <p className="text-[11px] text-gray-500 mt-1">
                        {timeAgo(n.createdAt)}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
