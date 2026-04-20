"use client";

import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";

type Status = "NEW" | "IN_PROGRESS" | "CLOSED" | "SPAM";

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  message: string;
  service: string | null;
  isRead: boolean;
  status: Status;
  source: string | null;
  nextFollowUpAt: string | null;
  lastContactedAt: string | null;
  createdAt: string;
  _count: { notes: number };
}

interface Note {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string };
}

interface LeadDetail extends Lead {
  notes: Note[];
}

interface Stats {
  openCount: number;
  dueThisWeekCount: number;
  newThisWeekCount: number;
}

const STATUS_LABEL: Record<Status, string> = {
  NEW: "חדש",
  IN_PROGRESS: "בטיפול",
  CLOSED: "נסגר",
  SPAM: "ספאם",
};

const STATUS_CLASS: Record<Status, string> = {
  NEW: "bg-pink/15 text-pink",
  IN_PROGRESS: "bg-yellow-500/15 text-yellow-400",
  CLOSED: "bg-green-500/15 text-green-400",
  SPAM: "bg-gray-700/40 text-gray-400",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("he-IL");
}

function dueChip(iso: string | null): { text: string; tone: "ok" | "today" | "overdue" } {
  if (!iso) return { text: "ללא תאריך", tone: "ok" };
  const due = new Date(iso);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return { text: `איחר ${Math.abs(diffDays)} ימים`, tone: "overdue" };
  if (diffDays === 0) return { text: "היום", tone: "today" };
  if (diffDays === 1) return { text: "מחר", tone: "today" };
  return { text: `בעוד ${diffDays} ימים`, tone: "ok" };
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<Stats>({ openCount: 0, dueThisWeekCount: 0, newThisWeekCount: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (showAll) params.set("all", "true");
    if (search.trim()) params.set("search", search.trim());
    try {
      const res = await fetch(`/api/leads?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setLeads(json.leads ?? []);
      setStats(json.stats ?? { openCount: 0, dueThisWeekCount: 0, newThisWeekCount: 0 });
    } catch {
      toast.error("שגיאה בטעינת לידים");
    } finally {
      setLoading(false);
    }
  }, [search, showAll]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div dir="rtl" className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-2xl font-bold">לידים — מעקב</h2>
        <p className="text-xs text-gray-500">
          עקוב אחרי פניות שלא נסגרו, נהל הערות, וקבע מתי לחזור לכל אחת
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label="לידים פתוחים" value={stats.openCount} />
        <SummaryCard
          label="לסגירה השבוע"
          value={stats.dueThisWeekCount}
          accent={stats.dueThisWeekCount > 0 ? "warning" : "ok"}
        />
        <SummaryCard label="חדשים השבוע" value={stats.newThisWeekCount} />
      </div>

      {/* Filter bar */}
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-3 flex flex-wrap items-center gap-2">
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
            checked={showAll}
            onChange={(e) => setShowAll(e.target.checked)}
            className="w-4 h-4 accent-pink"
          />
          הצג גם נסגרו וספאם
        </label>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-20 bg-gray-900 border border-gray-700 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : leads.length === 0 ? (
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-12 text-center text-sm text-gray-500">
          אין לידים בתצוגה הזו.
        </div>
      ) : (
        <div className="space-y-2">
          {leads.map((lead) => {
            const due = dueChip(lead.nextFollowUpAt);
            const dueClass =
              due.tone === "overdue"
                ? "text-red-400"
                : due.tone === "today"
                ? "text-yellow-400"
                : "text-gray-500";
            return (
              <button
                key={lead.id}
                onClick={() => setSelectedId(lead.id)}
                className="w-full bg-gray-900 border border-gray-700 hover:border-gray-600 rounded-xl p-4 text-right transition-colors"
              >
                <div className="flex items-start justify-between gap-3 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    {!lead.isRead && <span className="w-2 h-2 rounded-full bg-pink shrink-0" />}
                    <span className="font-bold text-white truncate">{lead.name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${STATUS_CLASS[lead.status]}`}>
                      {STATUS_LABEL[lead.status]}
                    </span>
                  </div>
                  <span className={`text-xs shrink-0 ${dueClass}`}>{due.text}</span>
                </div>
                <p className="text-xs text-gray-500 truncate">
                  {lead.email}
                  {lead.phone && ` · ${lead.phone}`}
                  {lead.service && ` · ${lead.service}`}
                </p>
                <p className="text-xs text-gray-400 mt-1 line-clamp-1">{lead.message}</p>
                <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-2">
                  <span>נכנס: {fmtDate(lead.createdAt)}</span>
                  {lead.lastContactedAt && <span>· נגעת לאחרונה: {fmtDate(lead.lastContactedAt)}</span>}
                  <span>· {lead._count.notes} הערות</span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {selectedId && (
        <LeadDrawer leadId={selectedId} onClose={() => setSelectedId(null)} onChange={load} />
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "warning" | "ok";
}) {
  const valueClass = accent === "warning" ? "text-yellow-400" : "text-pink";
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${valueClass}`}>{value.toLocaleString("he-IL")}</p>
    </div>
  );
}

function LeadDrawer({
  leadId,
  onClose,
  onChange,
}: {
  leadId: string;
  onClose: () => void;
  onChange: () => void;
}) {
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [noteBody, setNoteBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [followUpDate, setFollowUpDate] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/leads/${leadId}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const json = (await res.json()) as LeadDetail;
      setLead(json);
      setFollowUpDate(json.nextFollowUpAt ? json.nextFollowUpAt.slice(0, 10) : "");
    } catch {
      toast.error("שגיאה בטעינת הליד");
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    load();
  }, [load]);

  const addNote = async () => {
    if (!noteBody.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/leads/${leadId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: noteBody.trim() }),
      });
      if (!res.ok) throw new Error();
      setNoteBody("");
      await load();
      onChange();
    } catch {
      toast.error("שמירת ההערה נכשלה");
    } finally {
      setSaving(false);
    }
  };

  const updateField = async (data: Record<string, unknown>) => {
    try {
      await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      await load();
      onChange();
    } catch {
      toast.error("עדכון נכשל");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex" dir="rtl">
      <div onClick={onClose} className="flex-1 bg-black/60" />
      <aside className="w-full max-w-lg bg-gray-900 border-l border-gray-700 flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="text-lg font-bold">פרטי הליד</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none">
            ✕
          </button>
        </div>

        {loading || !lead ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin w-6 h-6 border-2 border-pink border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {/* Contact info */}
            <section className="bg-gray-800/60 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-2">
                <h4 className="text-base font-bold text-white">{lead.name}</h4>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${STATUS_CLASS[lead.status]}`}>
                  {STATUS_LABEL[lead.status]}
                </span>
              </div>
              <p className="text-sm text-gray-300">{lead.email}</p>
              {lead.phone && <p className="text-sm text-gray-300">{lead.phone}</p>}
              {lead.service && <p className="text-xs text-gray-500">סוג שירות: {lead.service}</p>}
              <p className="text-xs text-gray-500">נכנס: {fmtDate(lead.createdAt)}</p>

              <div className="flex flex-wrap gap-2 pt-2">
                {lead.phone && (
                  <a
                    href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-300 font-bold rounded-lg text-xs"
                  >
                    וואטסאפ
                  </a>
                )}
                <a
                  href={`mailto:${lead.email}`}
                  className="px-3 py-1.5 bg-cyan/20 hover:bg-cyan/30 text-cyan font-bold rounded-lg text-xs"
                >
                  אימייל
                </a>
              </div>
            </section>

            {/* Original message */}
            <section>
              <p className="text-xs text-gray-500 mb-1">תוכן הפנייה המקורי</p>
              <p className="text-sm text-gray-200 whitespace-pre-wrap bg-gray-800/40 rounded-xl p-3">
                {lead.message}
              </p>
            </section>

            {/* Status */}
            <section>
              <p className="text-xs text-gray-500 mb-2">שינוי סטטוס</p>
              <div className="flex flex-wrap gap-1.5">
                {(["NEW", "IN_PROGRESS", "CLOSED", "SPAM"] as Status[]).map((s) => (
                  <button
                    key={s}
                    onClick={() => updateField({ status: s })}
                    className={`text-xs px-3 py-1.5 rounded-full font-bold transition-colors ${
                      lead.status === s
                        ? STATUS_CLASS[s]
                        : "bg-gray-800 text-gray-500 hover:text-white"
                    }`}
                  >
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
            </section>

            {/* Next follow-up date */}
            <section>
              <label className="block text-xs text-gray-500 mb-1">תאריך מעקב הבא</label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  onBlur={() =>
                    updateField({ nextFollowUpAt: followUpDate || null })
                  }
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-pink"
                />
                {followUpDate && (
                  <button
                    onClick={() => {
                      setFollowUpDate("");
                      updateField({ nextFollowUpAt: null });
                    }}
                    className="text-xs text-gray-500 hover:text-white"
                  >
                    נקה
                  </button>
                )}
              </div>
            </section>

            {/* Notes timeline */}
            <section>
              <h4 className="text-base font-bold text-white mb-2">היסטוריית מעקב</h4>
              {lead.notes.length === 0 ? (
                <p className="text-xs text-gray-500 mb-3">אין הערות עדיין.</p>
              ) : (
                <div className="space-y-2 mb-3">
                  {lead.notes.map((n) => (
                    <div key={n.id} className="bg-gray-800/40 rounded-xl p-3">
                      <p className="text-xs text-gray-500 mb-1">
                        {n.author.name} · {new Date(n.createdAt).toLocaleString("he-IL")}
                      </p>
                      <p className="text-sm text-gray-200 whitespace-pre-wrap">{n.body}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <textarea
                  value={noteBody}
                  onChange={(e) => setNoteBody(e.target.value)}
                  placeholder="מה דיברת עם הלקוח? מה ההחלטה? מה הצעד הבא?"
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-pink resize-none"
                />
                <button
                  onClick={addNote}
                  disabled={saving || !noteBody.trim()}
                  className="w-full bg-pink hover:bg-pink-light disabled:opacity-50 text-white font-bold py-2 rounded-xl text-sm"
                >
                  {saving ? "שומר…" : "הוסף הערה"}
                </button>
              </div>
            </section>
          </div>
        )}
      </aside>
    </div>
  );
}
