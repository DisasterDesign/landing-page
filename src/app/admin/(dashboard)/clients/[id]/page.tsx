"use client";

import { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import Badge from "@/components/ui/Badge";

type AgreementStatus = "DRAFT" | "SENT" | "SIGNED" | "CANCELLED";
type Tier = "BASIC" | "ADVANCED" | "PREMIUM";

interface AgreementSummary {
  id: string;
  tier: Tier | null;
  monthlyPrice: number;
  oneTimeFee: number | null;
  status: AgreementStatus;
  customerName: string;
  signedAt: string | null;
  createdAt: string;
  signToken: string;
}

interface NoteAuthor {
  id: string;
  name: string;
  avatarUrl: string | null;
}

interface ClientNote {
  id: string;
  body: string;
  createdAt: string;
  author: NoteAuthor;
}

interface ClientDetail {
  id: string;
  number: number;
  name: string;
  status: string;
  notes: string | null;
  amount: number | null;
  expense: number | null;
  cardcomFee: number | null;
  websiteUrl: string | null;
  email: string | null;
  phone: string | null;
  businessName: string | null;
  idNumber: string | null;
  source: string | null;
  archivedAt: string | null;
  startDate: string | null;
  paymentDate: string | null;
  createdAt: string;
  updatedAt: string;
  agreements: AgreementSummary[];
  clientNotes: ClientNote[];
}

const TIER_LABEL: Record<Tier, string> = {
  BASIC: "בסיס",
  ADVANCED: "מתקדם",
  PREMIUM: "פרימיום",
};

const STATUS_LABEL: Record<AgreementStatus, string> = {
  DRAFT: "טיוטה",
  SENT: "נשלח",
  SIGNED: "נחתם",
  CANCELLED: "בוטל",
};

const STATUS_VARIANT: Record<AgreementStatus, "gray" | "cyan" | "green" | "red"> = {
  DRAFT: "gray",
  SENT: "cyan",
  SIGNED: "green",
  CANCELLED: "red",
};

const SOURCE_LABEL: Record<string, string> = {
  agreement_signed: "נוצר אוטומטית מהסכם חתום",
  manual: "נוסף ידנית",
  lead_converted: "הומר מליד",
  import: "יובא",
};

type Tab = "details" | "agreements" | "notes" | "activity";

interface FieldDef {
  key: keyof ClientDetail;
  label: string;
  type?: "text" | "email" | "tel" | "url" | "date" | "number";
}

const EDITABLE_FIELDS: FieldDef[] = [
  { key: "name", label: "שם" },
  { key: "businessName", label: "שם עסק" },
  { key: "idNumber", label: "ח.פ. / ע.מ." },
  { key: "email", label: "אימייל", type: "email" },
  { key: "phone", label: "טלפון", type: "tel" },
  { key: "websiteUrl", label: "אתר", type: "url" },
  { key: "status", label: "סטטוס" },
  { key: "amount", label: "סכום (₪)", type: "number" },
  { key: "expense", label: "הוצאה (₪)", type: "number" },
  { key: "startDate", label: "תאריך התחלה", type: "date" },
  { key: "paymentDate", label: "תאריך תשלום", type: "date" },
];

export default function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("details");
  const [savingField, setSavingField] = useState<string | null>(null);
  const [newNote, setNewNote] = useState("");
  const [postingNote, setPostingNote] = useState(false);

  const fetchClient = useCallback(async () => {
    try {
      const res = await fetch(`/api/clients/${id}`);
      if (!res.ok) {
        if (res.status === 404) {
          toast.error("לקוח לא נמצא");
        }
        throw new Error();
      }
      const json = await res.json();
      setClient(json);
    } catch {
      toast.error("שגיאה בטעינת לקוח");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchClient();
  }, [fetchClient]);

  const updateField = async (key: keyof ClientDetail, raw: string) => {
    if (!client) return;
    let payload: unknown = raw;
    if (raw === "") payload = null;
    if (key === "amount" || key === "expense") {
      payload = raw === "" ? null : parseFloat(raw);
      if (raw !== "" && !Number.isFinite(payload as number)) {
        toast.error("ערך לא תקין");
        return;
      }
    }
    if (key === "startDate" || key === "paymentDate") {
      payload = raw || null;
    }

    setSavingField(String(key));
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: payload }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setClient((prev) => (prev ? { ...prev, ...updated } : prev));
      toast.success("נשמר", { duration: 1200, style: { fontSize: "13px" } });
    } catch {
      toast.error("שגיאה בשמירה");
    } finally {
      setSavingField(null);
    }
  };

  const archiveClient = async (restore: boolean) => {
    if (!client) return;
    if (!restore && !confirm("להעביר את הלקוח לארכיון?")) return;
    try {
      const res = await fetch(`/api/clients/${id}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restore }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setClient((prev) => (prev ? { ...prev, ...updated } : prev));
      toast.success(restore ? "שוחזר" : "הועבר לארכיון");
    } catch {
      toast.error("שגיאה בפעולה");
    }
  };

  const submitNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    setPostingNote(true);
    try {
      const res = await fetch(`/api/clients/${id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: newNote.trim() }),
      });
      if (!res.ok) throw new Error();
      const note = await res.json();
      setClient((prev) =>
        prev ? { ...prev, clientNotes: [note, ...prev.clientNotes] } : prev
      );
      setNewNote("");
      toast.success("הפתק נוסף");
    } catch {
      toast.error("שגיאה בהוספת פתק");
    } finally {
      setPostingNote(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-pink border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!client) {
    return (
      <div dir="rtl" className="text-center py-16 text-gray-400">
        <p>לקוח לא נמצא.</p>
        <Link href="/admin/clients" className="text-cyan hover:underline mt-4 inline-block">
          חזרה לרשימת לקוחות
        </Link>
      </div>
    );
  }

  return (
    <div dir="rtl" className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link
            href="/admin/clients"
            className="text-xs text-gray-500 hover:text-gray-300 inline-flex items-center gap-1 mb-2"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            חזרה לרשימת לקוחות
          </Link>
          <h1 className="text-2xl font-bold text-white">
            {client.name || "לקוח ללא שם"}
            <span className="text-gray-500 font-mono text-sm mr-3">#{client.number}</span>
          </h1>
          <div className="mt-2 flex items-center gap-2 flex-wrap text-sm text-gray-400">
            {client.businessName && <span>{client.businessName}</span>}
            {client.idNumber && <span>· ח.פ./ע.מ. {client.idNumber}</span>}
            {client.source && SOURCE_LABEL[client.source] && (
              <Badge variant="gray">{SOURCE_LABEL[client.source]}</Badge>
            )}
            {client.archivedAt && <Badge variant="red">בארכיון</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {client.archivedAt ? (
            <button
              onClick={() => archiveClient(true)}
              className="px-3 py-1.5 text-sm border border-gray-700 hover:border-gray-500 text-gray-300 rounded-xl"
            >
              שחזר מארכיון
            </button>
          ) : (
            <button
              onClick={() => archiveClient(false)}
              className="px-3 py-1.5 text-sm border border-gray-700 hover:border-red-500/50 hover:text-red-400 text-gray-300 rounded-xl"
            >
              העבר לארכיון
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-700">
        <nav className="flex gap-6">
          {([
            ["details", "פרטים"],
            ["agreements", `הסכמים (${client.agreements.length})`],
            ["notes", `תיעוד (${client.clientNotes.length})`],
            ["activity", "פעילות"],
          ] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`pb-3 px-1 -mb-px border-b-2 text-sm font-medium transition-colors ${
                tab === key
                  ? "border-pink text-pink"
                  : "border-transparent text-gray-400 hover:text-gray-200"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {tab === "details" && (
        <div className="grid md:grid-cols-2 gap-4">
          {EDITABLE_FIELDS.map((field) => {
            const rawValue = client[field.key];
            let displayValue = "";
            if (field.type === "date" && rawValue) {
              displayValue = new Date(rawValue as string).toISOString().split("T")[0];
            } else if (rawValue != null) {
              displayValue = String(rawValue);
            }
            return (
              <div key={String(field.key)}>
                <label className="block text-xs text-gray-500 mb-1">{field.label}</label>
                <input
                  type={field.type ?? "text"}
                  defaultValue={displayValue}
                  onBlur={(e) => {
                    if (e.target.value !== displayValue) {
                      updateField(field.key, e.target.value);
                    }
                  }}
                  disabled={savingField === String(field.key)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-pink disabled:opacity-50"
                />
              </div>
            );
          })}

          <div className="md:col-span-2">
            <label className="block text-xs text-gray-500 mb-1">הערות חופשיות</label>
            <textarea
              defaultValue={client.notes ?? ""}
              rows={3}
              onBlur={(e) => {
                if (e.target.value !== (client.notes ?? "")) {
                  updateField("notes", e.target.value);
                }
              }}
              disabled={savingField === "notes"}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-pink disabled:opacity-50 resize-none"
            />
          </div>
        </div>
      )}

      {tab === "agreements" && (
        <div className="space-y-2">
          {client.agreements.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">
              אין הסכמים מקושרים ללקוח זה.
            </div>
          ) : (
            client.agreements.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-4 p-4 border border-gray-700 rounded-xl bg-gray-800/40 hover:bg-gray-800/70 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={STATUS_VARIANT[a.status]}>{STATUS_LABEL[a.status]}</Badge>
                    {a.tier ? (
                      <Badge variant="gray">{TIER_LABEL[a.tier]}</Badge>
                    ) : (
                      <Badge variant="gray">מותאם</Badge>
                    )}
                    <span className="text-sm text-white font-mono">
                      {a.monthlyPrice.toLocaleString("he-IL")} ₪/חודש
                    </span>
                    {a.oneTimeFee ? (
                      <span className="text-xs text-gray-400 font-mono">
                        + הקמה {a.oneTimeFee.toLocaleString("he-IL")} ₪
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-1 text-xs text-gray-400">
                    נוצר {new Date(a.createdAt).toLocaleDateString("he-IL")}
                    {a.signedAt
                      ? ` · נחתם ${new Date(a.signedAt).toLocaleDateString("he-IL")}`
                      : ""}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <a
                    href={`/agreement/${a.signToken}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan hover:underline"
                  >
                    קישור חתימה
                  </a>
                  {a.status === "SIGNED" && (
                    <a
                      href={`/agreement/${a.signToken}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-pink hover:underline"
                    >
                      PDF
                    </a>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "notes" && (
        <div className="space-y-4">
          <form onSubmit={submitNote} className="space-y-2">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              rows={3}
              placeholder="הוסף פתק / סיכום שיחה / תזכורת"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-pink resize-none"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={postingNote || !newNote.trim()}
                className="px-4 py-1.5 bg-pink hover:bg-pink-light disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-colors"
              >
                {postingNote ? "מוסיף..." : "הוסף פתק"}
              </button>
            </div>
          </form>

          {client.clientNotes.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              עדיין אין פתקאות ללקוח זה.
            </div>
          ) : (
            <ul className="space-y-3">
              {client.clientNotes.map((note) => (
                <li
                  key={note.id}
                  className="p-4 border border-gray-700 rounded-xl bg-gray-800/40"
                >
                  <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                    <span className="font-medium text-gray-200">{note.author.name}</span>
                    <span>·</span>
                    <span>
                      {new Date(note.createdAt).toLocaleString("he-IL", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-white whitespace-pre-wrap">{note.body}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "activity" && (
        <ActivityTimeline client={client} />
      )}
    </div>
  );
}

function ActivityTimeline({ client }: { client: ClientDetail }) {
  type Event = { date: string; title: string; detail?: string; variant: "pink" | "cyan" | "gray" | "green" };
  const events: Event[] = [];

  events.push({
    date: client.createdAt,
    title: "לקוח נוסף למערכת",
    detail: client.source ? SOURCE_LABEL[client.source] : undefined,
    variant: "gray",
  });

  for (const a of client.agreements) {
    events.push({
      date: a.createdAt,
      title: `הסכם נוצר`,
      detail: `${a.tier ? `מסלול ${TIER_LABEL[a.tier]}` : "מותאם"} · ${a.monthlyPrice} ₪/חודש`,
      variant: "cyan",
    });
    if (a.signedAt) {
      events.push({
        date: a.signedAt,
        title: "הסכם נחתם",
        detail: a.customerName,
        variant: "green",
      });
    }
  }

  for (const n of client.clientNotes) {
    events.push({
      date: n.createdAt,
      title: `פתק נוסף ע״י ${n.author.name}`,
      detail: n.body.length > 80 ? n.body.slice(0, 77) + "..." : n.body,
      variant: "pink",
    });
  }

  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (events.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 text-sm">אין אירועים להציג.</div>
    );
  }

  return (
    <ol className="relative space-y-4 border-r border-gray-700 pr-6 mr-2">
      {events.map((e, idx) => (
        <li key={idx} className="relative">
          <span
            className={`absolute -right-[31px] top-1.5 w-3 h-3 rounded-full border-2 border-gray-950 ${
              e.variant === "pink"
                ? "bg-pink"
                : e.variant === "cyan"
                ? "bg-cyan"
                : e.variant === "green"
                ? "bg-green-500"
                : "bg-gray-500"
            }`}
          />
          <div className="text-xs text-gray-500">
            {new Date(e.date).toLocaleString("he-IL", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </div>
          <div className="text-sm text-white">{e.title}</div>
          {e.detail && <div className="text-xs text-gray-400 mt-0.5">{e.detail}</div>}
        </li>
      ))}
    </ol>
  );
}
