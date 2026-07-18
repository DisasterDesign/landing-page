"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import PullToRefresh from "@/components/ui/PullToRefresh";
import { confirmDanger } from "@/lib/confirm";

type Status = "NEW" | "IN_PROGRESS" | "CLOSED" | "LOST" | "SPAM";
type StatusFilter = "ALL" | Status;
type Category = "sales" | "landing" | "branding" | "other";

interface UserLite {
  id: string;
  name: string;
}

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
  closedAt: string | null;
  createdAt: string;
  _count: { notes: number };
  assignees: UserLite[];
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
  LOST: "לא נסגרו",
  SPAM: "ספאם",
};

const STATUS_BADGE: Record<Status, string> = {
  NEW: "bg-pink-900/40 text-pink-300",
  IN_PROGRESS: "bg-amber-900/40 text-amber-300",
  CLOSED: "bg-green-900/40 text-green-300",
  LOST: "bg-red-900/40 text-red-300",
  SPAM: "bg-gray-800 text-gray-400",
};

const STATUS_ORDER: Record<Status, number> = {
  NEW: 0,
  IN_PROGRESS: 1,
  CLOSED: 2,
  LOST: 3,
  SPAM: 4,
};

const CATEGORY_ORDER: Category[] = ["sales", "landing", "branding", "other"];

const CATEGORY_LABEL: Record<Category, string> = {
  sales: "אתר מכירות",
  landing: "דף נחיתה",
  branding: "אתר תדמית",
  other: "אחר",
};

const CATEGORY_ICON: Record<Category, string> = {
  sales: "🛒",
  landing: "🎯",
  branding: "🏢",
  other: "📋",
};

function categorize(service: string | null | undefined): Category {
  if (!service) return "other";
  const s = service.toLowerCase();
  if (/(מכירות|חנות|ecommerce|shop)/.test(s)) return "sales";
  if (/(נחיתה|landing)/.test(s)) return "landing";
  if (/(תדמית|תדמיתי|corporate|branding)/.test(s)) return "branding";
  return "other";
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("he-IL");
}

/**
 * Stale FB leads in DB still carry "ליד מפייסבוק" as the parsed name
 * (older parser missed the Hebrew "שם" fields). Render a friendlier
 * fallback at display time so the admin doesn't have to wait for a
 * full sync to backfill the column.
 */
function displayName(lead: Pick<Lead, "name" | "email" | "phone">): string {
  const stale = !lead.name || lead.name.trim() === "" || lead.name === "ליד מפייסבוק";
  if (!stale) return lead.name;
  if (lead.email && lead.email.includes("@")) return lead.email.split("@")[0];
  if (lead.phone) return lead.phone;
  return "ליד ללא שם";
}

interface DueInfo {
  text: string;
  className: string;
}

function dueChip(iso: string | null): DueInfo {
  if (!iso) return { text: "ללא תאריך", className: "text-gray-500" };
  const due = new Date(iso);
  due.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0)
    return {
      text: `איחר ${Math.abs(diffDays)} ימים`,
      className: "text-red-500 font-semibold",
    };
  if (diffDays === 0)
    return { text: "היום", className: "text-amber-500 font-semibold" };
  if (diffDays === 1)
    return { text: "מחר", className: "text-amber-500 font-semibold" };
  return { text: `בעוד ${diffDays} ימים`, className: "text-gray-400" };
}

function sortLeads(arr: Lead[]): Lead[] {
  return [...arr].sort((a, b) => {
    const so = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (so !== 0) return so;
    if (a.status === "IN_PROGRESS") {
      // Overdue first → earlier nextFollowUpAt first; nulls last.
      const ad = a.nextFollowUpAt ? new Date(a.nextFollowUpAt).getTime() : Infinity;
      const bd = b.nextFollowUpAt ? new Date(b.nextFollowUpAt).getTime() : Infinity;
      if (ad !== bd) return ad - bd;
    }
    // Newer first within the same bucket.
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

const FILTER_TABS: { id: StatusFilter; label: string }[] = [
  { id: "ALL", label: "הכל" },
  { id: "NEW", label: "חדש" },
  { id: "IN_PROGRESS", label: "בטיפול" },
  { id: "CLOSED", label: "נסגר" },
  { id: "LOST", label: "לא נסגרו" },
  { id: "SPAM", label: "ספאם" },
];

export default function LeadsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<Stats>({
    openCount: 0,
    dueThisWeekCount: 0,
    newThisWeekCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  // Default to the NEW bucket — that's what needs action on entry. "הכל"
  // is one click away for when you want the full history.
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("NEW");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [meId, setMeId] = useState<string | null>(null);
  const focusHandledRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    // Always pull every lead — the status filter buttons work client-side
    // so "נסגרו החודש" stays accurate regardless of which filter is active.
    params.set("all", "true");
    if (search.trim()) params.set("search", search.trim());
    try {
      const res = await fetch(`/api/leads?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setLeads(json.leads ?? []);
      setStats(
        json.stats ?? { openCount: 0, dueThisWeekCount: 0, newThisWeekCount: 0 }
      );
    } catch {
      toast.error("שגיאה בטעינת לידים");
    } finally {
      setLoading(false);
    }
  }, [search]);

  const setQuickFollowUp = useCallback(
    async (leadId: string, date: string | null) => {
      // Optimistic: flip the chip immediately so it feels instant.
      setLeads((prev) =>
        prev.map((l) =>
          l.id === leadId
            ? { ...l, nextFollowUpAt: date ? new Date(date).toISOString() : null }
            : l
        )
      );
      try {
        const body: Record<string, unknown> = { nextFollowUpAt: date };
        const res = await fetch(`/api/leads/${leadId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error();
        toast.success(date ? "תזכורת נקבעה" : "תזכורת בוטלה", {
          duration: 1800,
          style: { fontSize: "13px" },
        });
      } catch {
        toast.error("שמירת התזכורת נכשלה");
        load(); // revert via re-fetch
      }
    },
    [load]
  );

  // `silent` is used by the automatic sync on page entry: it skips the verbose
  // success toast (which would pop on every visit) and only speaks up when the
  // sync actually brought new leads, or when it failed — so the counts on
  // screen can be trusted without pressing the button.
  const syncFromFacebook = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent ?? false;
      setSyncing(true);
      try {
        const res = await fetch("/api/integrations/facebook/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "sync failed");
        if (!silent) {
          toast.success(
            `סנכרון הושלם: ${json.created} חדשים, ${json.updated} עודכנו, ${json.skipped} דולגו (מתוך ${json.total})`,
            { duration: 8000 }
          );
        } else if (json.created > 0) {
          toast.success(`${json.created} לידים חדשים מפייסבוק`, { duration: 4000 });
        }
        await load();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "שגיאה בסנכרון",
          silent ? { duration: 3000 } : undefined
        );
      } finally {
        setSyncing(false);
      }
    },
    [load]
  );

  useEffect(() => {
    load();
  }, [load]);

  // Pull from Facebook automatically once per page load, so the counts are
  // already current on entry instead of waiting for a manual button press.
  // The ref guard keeps StrictMode's double-invoke (and search-triggered
  // re-renders) from firing a second sync.
  const autoSyncedRef = useRef(false);
  useEffect(() => {
    if (autoSyncedRef.current) return;
    autoSyncedRef.current = true;
    syncFromFacebook({ silent: true });
  }, [syncFromFacebook]);

  // Who am I? Needed for the self-claim button ("קח לטיפול") — a user can
  // only take/release a lead for themselves, never assign someone else.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (!cancelled && json?.user?.id) setMeId(json.user.id);
      })
      .catch(() => {
        /* silent — claim button stays disabled */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Deep-link support: /admin/leads?focus=<id> auto-expands that row once
  // the leads list has loaded, then strips the query and scrolls to it.
  useEffect(() => {
    const focus = searchParams.get("focus");
    if (!focus || loading || focusHandledRef.current === focus) return;
    if (!leads.some((l) => l.id === focus)) return;
    focusHandledRef.current = focus;
    setExpandedId(focus);
    // strip the query so a refresh doesn't keep retriggering
    router.replace("/admin/leads", { scroll: false });
    // wait a tick for the expanded row to render before scrolling
    requestAnimationFrame(() => {
      const el = document.getElementById(`lead-row-${focus}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [searchParams, loading, leads, router]);

  const summary = useMemo(() => {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const monthStartMs = startOfMonth.getTime();
    const closedThisMonth = leads.filter((l) => {
      if (l.status !== "CLOSED") return false;
      // Prefer the real closedAt timestamp; fall back to last touch /
      // createdAt for rows that pre-date the schema field (shouldn't happen
      // after backfill but kept for safety).
      const tsSource =
        l.closedAt ?? l.lastContactedAt ?? l.createdAt;
      return new Date(tsSource).getTime() >= monthStartMs;
    }).length;
    return {
      newCount: leads.filter((l) => l.status === "NEW").length,
      inProgressCount: leads.filter((l) => l.status === "IN_PROGRESS").length,
      dueThisWeek: stats.dueThisWeekCount,
      closedThisMonth,
    };
  }, [leads, stats]);

  const grouped = useMemo(() => {
    const visible =
      statusFilter === "ALL"
        ? leads
        : leads.filter((l) => l.status === statusFilter);
    const groups: Record<Category, Lead[]> = {
      sales: [],
      landing: [],
      branding: [],
      other: [],
    };
    for (const lead of visible) {
      groups[categorize(lead.service)].push(lead);
    }
    for (const cat of CATEGORY_ORDER) {
      groups[cat] = sortLeads(groups[cat]);
    }
    return groups;
  }, [leads, statusFilter]);

  const totalVisible = Object.values(grouped).reduce(
    (acc, list) => acc + list.length,
    0
  );

  const handleToggle = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <PullToRefresh onRefresh={load}>
      <div dir="rtl" className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h2 className="text-2xl font-bold">לידים — מעקב</h2>
          <button
            onClick={() => syncFromFacebook()}
            disabled={syncing}
            className="bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-gray-300 hover:border-pink disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {syncing ? "מסנכרן..." : "🔄 סנכרן מפייסבוק"}
          </button>
          <p className="text-xs text-gray-500 w-full">
            עקוב אחרי פניות שלא נסגרו, נהל הערות, וקבע מתי לחזור לכל אחת
          </p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <SummaryCard
            label="חדשים"
            value={summary.newCount}
            dotClass="bg-pink-500"
          />
          <SummaryCard
            label="בטיפול"
            value={summary.inProgressCount}
            dotClass="bg-amber-500"
          />
          <SummaryCard
            label="לסגירה השבוע"
            value={summary.dueThisWeek}
            dotClass="bg-blue-500"
          />
          <SummaryCard
            label="נסגרו החודש"
            value={summary.closedThisMonth}
            dotClass="bg-green-500"
          />
        </div>

        {/* Filter bar */}
        <div className="bg-gray-900 border border-gray-700 rounded-2xl p-3 space-y-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש לפי שם, אימייל, טלפון או טקסט…"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-pink"
          />
          <div className="flex flex-wrap gap-1.5">
            {FILTER_TABS.map((tab) => {
              const active = statusFilter === tab.id;
              const count =
                tab.id === "ALL"
                  ? leads.length
                  : leads.filter((l) => l.status === tab.id).length;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`text-xs font-bold px-3 py-1.5 rounded-full transition-colors inline-flex items-center gap-1.5 ${
                    active
                      ? "bg-pink text-white"
                      : "bg-gray-800 text-gray-400 hover:text-white"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] font-bold px-1.5 rounded-full ${
                      active ? "bg-white/25" : "bg-gray-700 text-gray-300"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-32 bg-gray-900 border border-gray-700 rounded-xl animate-pulse"
              />
            ))}
          </div>
        ) : totalVisible === 0 ? (
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-12 text-center text-sm text-gray-500">
            אין לידים בתצוגה הזו.
          </div>
        ) : (
          <div className="space-y-6">
            {CATEGORY_ORDER.map((cat) => {
              const list = grouped[cat];
              if (list.length === 0) return null;
              return (
                <CategoryTable
                  key={cat}
                  category={cat}
                  leads={list}
                  expandedId={expandedId}
                  onToggle={handleToggle}
                  onSetFollowUp={setQuickFollowUp}
                  onChange={load}
                  meId={meId}
                />
              );
            })}
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}

function SummaryCard({
  label,
  value,
  dotClass,
}: {
  label: string;
  value: number;
  dotClass: string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className={`w-2 h-2 rounded-full ${dotClass}`} />
        <p className="text-xs text-gray-500">{label}</p>
      </div>
      <p className="text-2xl font-bold text-white">
        {value.toLocaleString("he-IL")}
      </p>
    </div>
  );
}

function CategoryTable({
  category,
  leads,
  expandedId,
  onToggle,
  onSetFollowUp,
  onChange,
  meId,
}: {
  category: Category;
  leads: Lead[];
  expandedId: string | null;
  onToggle: (id: string) => void;
  onSetFollowUp: (id: string, date: string | null) => Promise<void>;
  onChange: () => void;
  meId: string | null;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl" aria-hidden="true">
          {CATEGORY_ICON[category]}
        </span>
        <h3 className="text-base font-bold text-white">
          {CATEGORY_LABEL[category]}
        </h3>
        <span className="text-xs px-2.5 py-0.5 rounded-full bg-gray-800 text-gray-300 font-bold">
          {leads.length}
        </span>
      </div>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden">
        <table className="w-full text-right" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "22%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "22%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "16%" }} />
          </colgroup>
          <thead className="text-[11px] uppercase tracking-wider text-gray-500 border-b border-gray-700">
            <tr>
              <th className="px-3 py-2 font-medium text-right">שם</th>
              <th className="px-3 py-2 font-medium text-right">סטטוס</th>
              <th className="px-3 py-2 font-medium text-right">איש קשר</th>
              <th className="px-3 py-2 font-medium text-right">מעקב</th>
              <th className="px-3 py-2 font-medium text-right">תאריך</th>
              <th className="px-3 py-2 font-medium text-right">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => (
              <LeadRow
                key={lead.id}
                lead={lead}
                expanded={expandedId === lead.id}
                onToggle={onToggle}
                onSetFollowUp={onSetFollowUp}
                onChange={onChange}
                meId={meId}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function LeadRow({
  lead,
  expanded,
  onToggle,
  onSetFollowUp,
  onChange,
  meId,
}: {
  lead: Lead;
  expanded: boolean;
  onToggle: (id: string) => void;
  onSetFollowUp: (id: string, date: string | null) => Promise<void>;
  onChange: () => void;
  meId: string | null;
}) {
  const due = dueChip(lead.nextFollowUpAt);
  return (
    <>
      <tr
        id={`lead-row-${lead.id}`}
        onClick={() => onToggle(lead.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle(lead.id);
          }
        }}
        tabIndex={0}
        role="button"
        aria-expanded={expanded}
        className={`border-b border-gray-800 cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-pink/40 ${
          expanded ? "bg-gray-800/60" : "hover:bg-gray-800/30"
        }`}
      >
        <td className="px-3 py-3 align-top">
          <div className="flex items-center gap-2 min-w-0">
            {!lead.isRead && (
              <span
                className="w-2 h-2 rounded-full bg-pink shrink-0"
                aria-label="לא נקרא"
              />
            )}
            <span className="font-bold text-white truncate">{displayName(lead)}</span>
            {lead.source === "FACEBOOK" && (
              <span
                title="הגיע מפייסבוק"
                className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-blue-900/40 text-blue-300 shrink-0"
              >
                FB
              </span>
            )}
          </div>
        </td>
        <td className="px-3 py-3 align-top">
          <span
            className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${STATUS_BADGE[lead.status]}`}
          >
            {STATUS_LABEL[lead.status]}
          </span>
          {lead.assignees.length > 0 && (
            <div className="text-[10px] text-gray-500 mt-1 truncate">
              👤 {lead.assignees.map((a) => a.name).join(", ")}
            </div>
          )}
        </td>
        <td className="px-3 py-3 align-top">
          <div className="text-xs text-gray-400 truncate" title={lead.email}>
            {lead.email}
          </div>
          {lead.phone && (
            <div className="text-xs text-gray-500 truncate" title={lead.phone}>
              {lead.phone}
            </div>
          )}
        </td>
        <td className={`px-3 py-3 align-top text-xs ${due.className}`}>
          {due.text}
        </td>
        <td className="px-3 py-3 align-top text-xs text-gray-500">
          {fmtDate(lead.createdAt)}
        </td>
        <td className="px-3 py-3 align-top">
          <div className="flex items-center gap-1.5">
            {lead.phone && (
              <a
                href={`https://wa.me/${lead.phone.replace(/[^0-9]/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                title="פתח בוואטסאפ"
                aria-label="פתח בוואטסאפ"
                className="w-7 h-7 inline-flex items-center justify-center rounded-md bg-green-500/15 text-green-600 hover:bg-green-500/25 transition-colors"
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
                </svg>
              </a>
            )}
            <a
              href={`mailto:${lead.email}`}
              onClick={(e) => e.stopPropagation()}
              title="שלח אימייל"
              aria-label="שלח אימייל"
              className="w-7 h-7 inline-flex items-center justify-center rounded-md bg-cyan-500/15 text-cyan-700 hover:bg-cyan-500/25 transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-none stroke-current" strokeWidth="2" aria-hidden="true">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M22 4 12 13 2 4" />
              </svg>
            </a>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggle(lead.id);
              }}
              title={`${lead._count.notes} הערות — לחץ לפתיחה`}
              aria-label={`${lead._count.notes} הערות`}
              className="relative w-7 h-7 inline-flex items-center justify-center rounded-md bg-gray-700/40 text-gray-300 hover:bg-gray-700/70 transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-none stroke-current" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
              {lead._count.notes > 0 && (
                <span className="absolute -top-1 -left-1 bg-pink text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 px-1 inline-flex items-center justify-center">
                  {lead._count.notes}
                </span>
              )}
            </button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-gray-800/30">
          <td colSpan={6} className="p-4">
            <ExpandedPanel
              leadId={lead.id}
              meId={meId}
              onSetFollowUp={onSetFollowUp}
              onChange={onChange}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function ExpandedPanel({
  leadId,
  meId,
  onSetFollowUp,
  onChange,
}: {
  leadId: string;
  meId: string | null;
  onSetFollowUp: (id: string, date: string | null) => Promise<void>;
  onChange: () => void;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [noteBody, setNoteBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [followUpDate, setFollowUpDate] = useState("");
  const [statusSaving, setStatusSaving] = useState<Status | null>(null);
  const [claimSaving, setClaimSaving] = useState(false);

  const reload = useCallback(async () => {
    try {
      const res = await fetch(`/api/leads/${leadId}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const json = (await res.json()) as LeadDetail;
      setDetail(json);
      setFollowUpDate(
        json.nextFollowUpAt ? json.nextFollowUpAt.slice(0, 10) : ""
      );
    } catch {
      toast.error("שגיאה בטעינת הליד");
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    reload();
  }, [reload]);

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
      await reload();
      onChange();
    } catch {
      toast.error("שמירת ההערה נכשלה");
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (status: Status) => {
    setStatusSaving(status);
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      await reload();
      onChange();
    } catch {
      toast.error("עדכון הסטטוס נכשל");
    } finally {
      setStatusSaving(null);
    }
  };

  const deleteLead = async () => {
    const ok = await confirmDanger({
      title: "מחיקת פנייה",
      message: "הפנייה תימחק לצמיתות. הפעולה אינה הפיכה.",
      confirmLabel: "מחק",
      dangerous: true,
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/leads/${leadId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("נמחק");
      onChange();
    } catch {
      toast.error("שגיאה במחיקה");
    }
  };

  // Save the follow-up date through the parent helper (optimistic UX),
  // then reload local detail so the panel reflects what the server saved.
  const saveFollowUp = async (date: string | null) => {
    setFollowUpDate(date || "");
    await onSetFollowUp(leadId, date);
    reload();
  };

  // Self-claim / release — mirrors the seller flow. Claiming also bumps a
  // NEW lead into IN_PROGRESS so the status follows the process.
  const claim = async (take: boolean) => {
    setClaimSaving(true);
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: take ? "claim" : "release",
          ...(take && detail?.status === "NEW" ? { status: "IN_PROGRESS" } : {}),
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(take ? "הליד בטיפול שלך" : "הטיפול שוחרר");
      await reload();
      onChange();
    } catch {
      toast.error("הפעולה נכשלה");
    } finally {
      setClaimSaving(false);
    }
  };

  // Close the deal → jump straight to contract creation, prefilled.
  const closeToContract = async () => {
    setStatusSaving("CLOSED");
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CLOSED" }),
      });
      if (!res.ok) throw new Error();
      toast.success("הליד נסגר! מעביר ליצירת חוזה 🎉");
      const p = new URLSearchParams({ new: "1" });
      if (detail?.name) p.set("name", detail.name);
      if (detail?.phone) p.set("phone", detail.phone);
      if (detail?.email) p.set("email", detail.email);
      router.push(`/admin/agreements?${p.toString()}`);
    } catch {
      toast.error("עדכון הסטטוס נכשל");
      setStatusSaving(null);
    }
  };

  if (loading || !detail) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin w-5 h-5 border-2 border-pink border-t-transparent rounded-full" />
      </div>
    );
  }

  const sortedNotes = [...detail.notes].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const latestNote = sortedNotes[0];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* DOM-first → renders on the right in RTL: notes panel */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-white">הערות</h4>
          <span className="text-xs text-gray-500">{detail.notes.length} סה״כ</span>
        </div>
        {latestNote ? (
          <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
            <p className="text-[11px] text-gray-500 mb-1">
              {latestNote.author.name} ·{" "}
              {new Date(latestNote.createdAt).toLocaleString("he-IL")}
            </p>
            <p className="text-sm text-gray-200 whitespace-pre-wrap line-clamp-4">
              {latestNote.body}
            </p>
          </div>
        ) : (
          <p className="text-xs text-gray-500">אין הערות עדיין.</p>
        )}
        <div className="space-y-2">
          <textarea
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            placeholder="מה דיברתם? מה הצעד הבא?"
            rows={2}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-pink resize-none"
          />
          <button
            type="button"
            onClick={addNote}
            disabled={saving || !noteBody.trim()}
            className="w-full bg-pink hover:bg-pink-light disabled:opacity-50 text-white text-sm font-bold py-1.5 rounded-lg transition-colors"
          >
            {saving ? "שומר…" : "הוסף הערה"}
          </button>
        </div>
      </div>

      {/* DOM-second → renders on the left in RTL: message + actions */}
      <div className="space-y-3">
        <div>
          <h4 className="text-sm font-bold text-white mb-2">תוכן הפנייה</h4>
          <p className="text-sm text-gray-300 whitespace-pre-wrap bg-gray-900 rounded-lg p-3 border border-gray-700 max-h-32 overflow-y-auto">
            {detail.message}
          </p>
        </div>

        {/* The lead's journey: take it → work it → close to contract. */}
        <div>
          <p className="text-xs text-gray-500 mb-1.5">
            טיפול
            {detail.assignees.length > 0 && (
              <span className="text-gray-400">
                {" "}
                — בטיפול של {detail.assignees.map((a) => a.name).join(", ")}
              </span>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            {meId && detail.assignees.some((a) => a.id === meId) ? (
              <button
                type="button"
                onClick={() => claim(false)}
                disabled={claimSaving}
                className="text-xs px-3.5 py-1.5 rounded-full font-bold bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                {claimSaving ? "…" : "שחרר טיפול"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => claim(true)}
                disabled={claimSaving || !meId}
                className="text-xs px-3.5 py-1.5 rounded-full font-bold bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors disabled:opacity-50"
              >
                {claimSaving ? "…" : "✋ קח לטיפול"}
              </button>
            )}
            {detail.status !== "CLOSED" && (
              <button
                type="button"
                onClick={closeToContract}
                disabled={statusSaving !== null}
                className="text-xs px-3.5 py-1.5 rounded-full font-bold bg-green-500/20 text-green-300 hover:bg-green-500/30 transition-colors disabled:opacity-50"
              >
                🎉 סגור עסקה → חוזה
              </button>
            )}
          </div>
          <p className="text-[10px] text-gray-500 mt-1.5">
            הטיפול הוא אישי — כל אחד לוקח לעצמו בלבד. מי שמטפל מקבל התראה
            כשנקבע תאריך מעקב.
          </p>
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-1.5">שינוי סטטוס ידני</p>
          <div className="flex flex-wrap gap-1.5">
            {(["NEW", "IN_PROGRESS", "CLOSED", "LOST", "SPAM"] as Status[]).map((s) => {
              const active = detail.status === s;
              const busy = statusSaving === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  disabled={statusSaving !== null}
                  className={`text-[11px] px-2.5 py-1 rounded-full font-bold transition-colors disabled:opacity-50 ${
                    active
                      ? STATUS_BADGE[s]
                      : "bg-gray-800 text-gray-400 hover:text-white"
                  }`}
                >
                  {busy ? "…" : STATUS_LABEL[s]}
                </button>
              );
            })}
            <button
              type="button"
              onClick={deleteLead}
              className="text-[11px] px-2.5 py-1 rounded-full font-bold bg-gray-800 text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors mr-auto"
            >
              מחק פנייה
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1.5">
            תאריך מעקב הבא
          </label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={followUpDate}
              onChange={(e) => saveFollowUp(e.target.value || null)}
              className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-pink"
            />
            {followUpDate && (
              <button
                type="button"
                onClick={() => saveFollowUp(null)}
                className="text-xs text-gray-500 hover:text-white px-2"
              >
                נקה
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {detail.phone && (
            <a
              href={`https://wa.me/${detail.phone.replace(/[^0-9]/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs px-3 py-1.5 rounded-full font-bold bg-green-900/40 text-green-300 hover:bg-green-900/60 transition-colors"
            >
              וואטסאפ
            </a>
          )}
          <a
            href={`mailto:${detail.email}`}
            className="text-xs px-3 py-1.5 rounded-full font-bold bg-cyan-900/40 text-cyan-300 hover:bg-cyan-900/60 transition-colors"
          >
            אימייל
          </a>
        </div>
      </div>
    </div>
  );
}
