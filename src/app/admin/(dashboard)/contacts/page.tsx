"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import toast, { Toaster } from "react-hot-toast";
import { confirmDanger } from "@/lib/confirm";
import PullToRefresh from "@/components/ui/PullToRefresh";

type Status = "NEW" | "IN_PROGRESS" | "CLOSED" | "LOST" | "SPAM";

interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  service: string | null;
  isRead: boolean;
  status: Status;
  tags: string[];
  createdAt: string;
}

const STATUS_LABEL: Record<Status, string> = {
  NEW: "חדש",
  IN_PROGRESS: "בטיפול",
  CLOSED: "נסגר",
  LOST: "לא נסגרו",
  SPAM: "ספאם",
};

const STATUS_CLASS: Record<Status, string> = {
  NEW: "bg-pink/15 text-pink",
  IN_PROGRESS: "bg-yellow-500/15 text-yellow-400",
  CLOSED: "bg-green-500/15 text-green-400",
  LOST: "bg-red-500/15 text-red-400",
  SPAM: "bg-gray-700/40 text-gray-400",
};

const toastStyle = {
  background: "#1A1A1A",
  color: "#fff",
  border: "1px solid #3A3A3A",
};

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | Status>("ALL");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const fetchContacts = useCallback(async () => {
    try {
      const res = await fetch("/api/contacts", { cache: "no-store" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setContacts(Array.isArray(data) ? data : data.data || data.contacts || []);
    } catch {
      toast.error("שגיאה בטעינה", { style: toastStyle });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return contacts.filter((c) => {
      if (statusFilter !== "ALL" && c.status !== statusFilter) return false;
      if (unreadOnly && c.isRead) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.message.toLowerCase().includes(q) ||
        (c.phone || "").includes(q)
      );
    });
  }, [contacts, search, statusFilter, unreadOnly]);

  const counts = useMemo(() => {
    const by = { ALL: contacts.length, NEW: 0, IN_PROGRESS: 0, CLOSED: 0, LOST: 0, SPAM: 0 };
    let unread = 0;
    for (const c of contacts) {
      by[c.status]++;
      if (!c.isRead) unread++;
    }
    return { ...by, unread };
  }, [contacts]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((c) => c.id)));
    }
  };

  const updateStatus = async (id: string, status: Status) => {
    setContacts((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, status, isRead: status !== "NEW" ? true : c.isRead } : c
      )
    );
    try {
      await fetch(`/api/contacts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, isRead: status !== "NEW" ? true : undefined }),
      });
    } catch {
      toast.error("שגיאה", { style: toastStyle });
      fetchContacts();
    }
  };

  const markRead = async (id: string, isRead = true) => {
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, isRead } : c)));
    try {
      await fetch(`/api/contacts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead }),
      });
    } catch {
      fetchContacts();
    }
  };

  const deleteOne = async (id: string) => {
    const ok = await confirmDanger({
      title: "מחיקת הודעה",
      message: "ההודעה תימחק לצמיתות.",
      confirmLabel: "מחק",
      dangerous: true,
    });
    if (!ok) return;
    setContacts((prev) => prev.filter((c) => c.id !== id));
    selected.delete(id);
    try {
      await fetch(`/api/contacts/${id}`, { method: "DELETE" });
      toast.success("נמחק", { style: toastStyle });
    } catch {
      toast.error("שגיאה במחיקה", { style: toastStyle });
      fetchContacts();
    }
  };

  const bulkAction = async (
    action: "markRead" | "markUnread" | "delete" | "setStatus",
    status?: Status
  ) => {
    if (selected.size === 0) return;
    if (action === "delete") {
      const ok = await confirmDanger({
        title: `מחיקת ${selected.size} הודעות`,
        message: "כל ההודעות שנבחרו יימחקו לצמיתות.",
        confirmLabel: "מחק הכל",
        dangerous: true,
      });
      if (!ok) return;
    }

    const ids = Array.from(selected);
    try {
      const res = await fetch("/api/contacts/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action, status }),
      });
      if (!res.ok) throw new Error();
      setSelected(new Set());
      await fetchContacts();
      toast.success("עודכן", { style: toastStyle });
    } catch {
      toast.error("פעולה נכשלה", { style: toastStyle });
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-40 bg-gray-800 rounded animate-pulse" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="bg-gray-900 rounded-2xl border border-gray-700 h-20 animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={fetchContacts}>
    <div className="space-y-5" dir="rtl">
      <Toaster position="top-center" />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold">הודעות</h2>
        <span className="text-sm text-gray-500">
          {counts.unread > 0 ? `${counts.unread} לא נקראו` : "הכל נקרא"} • {counts.ALL} סך הכל
        </span>
      </div>

      {/* Filter bar */}
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש לפי שם, אימייל, טלפון או טקסט…"
            className="flex-1 min-w-[200px] bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-pink"
          />
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.checked)}
              className="w-4 h-4 accent-pink"
            />
            רק לא נקראו
          </label>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(["ALL", "NEW", "IN_PROGRESS", "CLOSED", "LOST", "SPAM"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                statusFilter === s
                  ? "bg-pink text-white"
                  : "bg-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              {s === "ALL" ? "הכל" : STATUS_LABEL[s]}{" "}
              <span className="opacity-60">({counts[s]})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-white font-bold ml-2">
            {selected.size} נבחרו
          </span>
          <button
            onClick={() => bulkAction("markRead")}
            className="text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
          >
            סמן כנקרא
          </button>
          <button
            onClick={() => bulkAction("setStatus", "IN_PROGRESS")}
            className="text-xs px-3 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 rounded-lg"
          >
            בטיפול
          </button>
          <button
            onClick={() => bulkAction("setStatus", "CLOSED")}
            className="text-xs px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-300 rounded-lg"
          >
            סגור
          </button>
          <button
            onClick={() => bulkAction("setStatus", "SPAM")}
            className="text-xs px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg"
          >
            ספאם
          </button>
          <button
            onClick={() => bulkAction("delete")}
            className="text-xs px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg"
          >
            מחק
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs px-3 py-1.5 text-gray-500 hover:text-white"
          >
            ביטול בחירה
          </button>
        </div>
      )}

      {/* Select-all toggle */}
      {filtered.length > 0 && (
        <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
          <input
            type="checkbox"
            checked={selected.size === filtered.length && filtered.length > 0}
            onChange={toggleSelectAll}
            className="w-4 h-4 accent-pink"
          />
          בחר הכל ({filtered.length})
        </label>
      )}

      {filtered.length === 0 ? (
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-12 text-center text-gray-500">
          {contacts.length === 0
            ? "אין הודעות עדיין. כשתגיע פנייה מהאתר היא תופיע כאן."
            : "אין תוצאות לסינון הזה."}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((contact) => {
            const isExpanded = expandedId === contact.id;
            const isSelected = selected.has(contact.id);
            return (
              <div
                key={contact.id}
                className={`bg-gray-900 rounded-2xl border transition-colors ${
                  isSelected
                    ? "border-pink"
                    : contact.isRead
                    ? "border-gray-700"
                    : "border-pink/30"
                }`}
              >
                <div className="flex items-center gap-3 p-4">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(contact.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 accent-pink shrink-0"
                  />

                  <button
                    onClick={() => {
                      setExpandedId(isExpanded ? null : contact.id);
                      if (!contact.isRead) markRead(contact.id, true);
                    }}
                    className="flex-1 min-w-0 flex items-center justify-between gap-3 text-right"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {!contact.isRead && (
                        <span className="w-2 h-2 rounded-full bg-pink shrink-0" />
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p
                            className={`text-sm truncate ${
                              contact.isRead ? "text-gray-300" : "text-white font-bold"
                            }`}
                          >
                            {contact.name}
                          </p>
                          <span
                            className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-bold ${STATUS_CLASS[contact.status]}`}
                          >
                            {STATUS_LABEL[contact.status]}
                          </span>
                          {contact.service && (
                            <span className="shrink-0 text-[10px] text-gray-500 hidden sm:inline">
                              · {contact.service}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {contact.email}
                          {contact.phone && ` · ${contact.phone}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-gray-500 hidden sm:inline">
                        {new Date(contact.createdAt).toLocaleDateString("he-IL")}
                      </span>
                      <svg
                        className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-700 p-4 sm:p-5 space-y-4">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">הודעה</p>
                      <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
                        {contact.message}
                      </p>
                    </div>

                    {/* Status quick set */}
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-xs text-gray-500 self-center ml-1">סטטוס:</span>
                      {(["NEW", "IN_PROGRESS", "CLOSED", "LOST", "SPAM"] as Status[]).map((s) => (
                        <button
                          key={s}
                          onClick={() => updateStatus(contact.id, s)}
                          className={`text-xs px-3 py-1 rounded-full font-bold transition-colors ${
                            contact.status === s
                              ? STATUS_CLASS[s]
                              : "bg-gray-800 text-gray-500 hover:text-white"
                          }`}
                        >
                          {STATUS_LABEL[s]}
                        </button>
                      ))}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      {contact.phone && (
                        <a
                          href={`https://wa.me/${contact.phone.replace(/[^0-9]/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-300 font-bold rounded-lg text-xs"
                        >
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                          </svg>
                          וואטסאפ
                        </a>
                      )}
                      <a
                        href={`mailto:${contact.email}`}
                        className="px-3 py-1.5 bg-cyan/20 hover:bg-cyan/30 text-cyan font-bold rounded-lg text-xs"
                      >
                        אימייל
                      </a>
                      {!contact.isRead ? (
                        <button
                          onClick={() => markRead(contact.id, true)}
                          className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold rounded-lg text-xs"
                        >
                          סמן כנקרא
                        </button>
                      ) : (
                        <button
                          onClick={() => markRead(contact.id, false)}
                          className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-500 rounded-lg text-xs"
                        >
                          סמן לא נקרא
                        </button>
                      )}
                      <button
                        onClick={() => deleteOne(contact.id)}
                        className="mr-auto px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold rounded-lg text-xs"
                      >
                        מחק
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
    </PullToRefresh>
  );
}
