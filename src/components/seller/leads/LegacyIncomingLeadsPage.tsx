"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

import LeadOutcomeSheet, {
  type LeadOutcomeInput,
} from "@/components/seller/leads/LeadOutcomeSheet";
import Modal from "@/components/ui/Modal";

type LeadStatus = "NEW" | "IN_PROGRESS" | "CLOSED" | "LOST" | "SPAM";

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  service: string | null;
  message: string | null;
  status: LeadStatus;
  source: string | null;
  createdAt: string;
  doNotContactAt: string | null;
  capabilities: {
    canContact: boolean;
  };
  assignees: { id: string; name: string }[];
  myNotesCount: number;
}

interface LeadNote {
  id: string;
  body: string;
  createdAt: string;
  author?: { id: string; name: string };
}

const STATUS_LABEL: Record<LeadStatus, string> = {
  NEW: "חדש",
  IN_PROGRESS: "בטיפול",
  CLOSED: "נסגר",
  LOST: "אבוד",
  SPAM: "ספאם",
};

const STATUS_STYLE: Record<LeadStatus, string> = {
  NEW: "bg-cyan/15 text-cyan",
  IN_PROGRESS: "bg-pink/15 text-pink",
  CLOSED: "bg-green-500/15 text-green-400",
  LOST: "bg-gray-700 text-gray-400",
  SPAM: "bg-gray-700 text-gray-500",
};

const waLink = (phone: string | null) =>
  phone ? `https://wa.me/${phone.replace(/\D/g, "")}` : null;

const agreementLink = (l: Lead) => {
  const p = new URLSearchParams();
  if (l.name) p.set("name", l.name);
  if (l.phone) p.set("phone", l.phone);
  if (l.email) p.set("email", l.email);
  if (l.company) p.set("business", l.company);
  p.set("lead", l.id);
  return `/seller/agreements/new?${p.toString()}`;
};

export default function LegacyIncomingLeadsPage() {
  const router = useRouter();
  const fallbackPhoneInputRef = useRef<HTMLInputElement>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [myId, setMyId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | LeadStatus>("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [focusState, setFocusState] = useState<
    "none" | "found" | "not_found"
  >("none");
  const [selectedForOutcome, setSelectedForOutcome] = useState<Lead | null>(
    null,
  );
  const [outcomeBusy, setOutcomeBusy] = useState(false);
  const [copyFallbackPhone, setCopyFallbackPhone] = useState<string | null>(
    null,
  );

  const load = useCallback(async () => {
    try {
      const focus = new URLSearchParams(window.location.search).get("focus");
      setFocusId(focus);
      const leadParams = new URLSearchParams();
      if (focus) leadParams.set("focus", focus);
      const [meRes, leadsRes] = await Promise.all([
        fetch("/api/seller/me", { cache: "no-store" }),
        fetch(
          `/api/seller/leads${
            leadParams.size ? `?${leadParams.toString()}` : ""
          }`,
          { cache: "no-store" },
        ),
      ]);
      if (meRes.ok) setMyId((await meRes.json()).id);
      if (leadsRes.ok) {
        const payload = await leadsRes.json();
        setLeads(payload.leads ?? []);
        setFocusState(
          focus ? (payload.focusState === "found" ? "found" : "not_found") : "none",
        );
        if (focus && payload.focusState === "found") setFilter("ALL");
      }
    } catch {
      toast.error("שגיאה בטעינת הלידים");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!focusId || loading) return;
    requestAnimationFrame(() => {
      document
        .getElementById(`lead-${focusId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [focusId, leads, loading]);

  const claim = async (lead: Lead) => {
    setBusyId(lead.id);
    try {
      const res = await fetch(`/api/seller/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim" }),
      });
      if (res.status === 409) {
        toast.error("הליד כבר נלקח");
        await load();
        return;
      }
      if (!res.ok) throw new Error();
      toast.success("נלקח לטיפול שלך");
      load();
    } catch {
      toast.error("שגיאה");
    } finally {
      setBusyId(null);
    }
  };

  const setStatus = async (lead: Lead, status: LeadStatus) => {
    setBusyId(lead.id);
    try {
      const res = await fetch(`/api/seller/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      if (status === "CLOSED") {
        // Deal closed → straight into contract creation, prefilled from the lead.
        toast.success("הליד נסגר! מעביר ליצירת חוזה 🎉");
        router.push(agreementLink(lead));
        return;
      }
      load();
    } catch {
      toast.error("שגיאה בעדכון סטטוס");
    } finally {
      setBusyId(null);
    }
  };

  const saveOutcome = async (input: LeadOutcomeInput) => {
    if (!selectedForOutcome) return;
    setOutcomeBusy(true);
    try {
      const response = await fetch(
        `/api/seller/leads/${selectedForOutcome.id}/interactions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          message?: string;
          error?: string;
        } | null;
        throw new Error(payload?.message ?? payload?.error ?? "שמירת השיחה נכשלה");
      }
      toast.success("תוצאת השיחה נשמרה בהיסטוריית החברה");
      setSelectedForOutcome(null);
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "שמירת השיחה נכשלה",
      );
    } finally {
      setOutcomeBusy(false);
    }
  };

  function openPhoneCopyFallback(phone: string) {
    setCopyFallbackPhone(phone);
    requestAnimationFrame(() => fallbackPhoneInputRef.current?.select());
  }

  function copyPhone(lead: Lead) {
    if (
      !lead.phone ||
      lead.doNotContactAt ||
      !lead.capabilities.canContact
    ) {
      return;
    }
    const phone = lead.phone;
    if (!navigator.clipboard?.writeText) {
      openPhoneCopyFallback(phone);
      return;
    }
    void navigator.clipboard
      .writeText(phone)
      .then(() => toast.success("הועתק"))
      .catch(() => openPhoneCopyFallback(phone));
  }

  // ---- append-only company notes --------------------------------------
  const [openNotes, setOpenNotes] = useState<Set<string>>(new Set());
  const [notesByLead, setNotesByLead] = useState<Record<string, LeadNote[]>>({});
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({});
  const [noteBusy, setNoteBusy] = useState<string | null>(null);

  const toggleNotes = async (leadId: string) => {
    setOpenNotes((prev) => {
      const next = new Set(prev);
      if (next.has(leadId)) next.delete(leadId);
      else next.add(leadId);
      return next;
    });
    if (!notesByLead[leadId]) {
      try {
        const res = await fetch(`/api/seller/leads/${leadId}/notes`, { cache: "no-store" });
        if (!res.ok) throw new Error();
        const json = await res.json();
        setNotesByLead((prev) => ({ ...prev, [leadId]: json.notes ?? [] }));
      } catch {
        toast.error("שגיאה בטעינת הפתקים");
      }
    }
  };

  const addNote = async (leadId: string) => {
    const body = (noteDraft[leadId] ?? "").trim();
    if (!body) return;
    setNoteBusy(leadId);
    try {
      const res = await fetch(`/api/seller/leads/${leadId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setNotesByLead((prev) => ({ ...prev, [leadId]: [...(prev[leadId] ?? []), json.note] }));
      setNoteDraft((prev) => ({ ...prev, [leadId]: "" }));
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, myNotesCount: l.myNotesCount + 1 } : l))
      );
    } catch {
      toast.error("שגיאה בשמירת הפתק");
    } finally {
      setNoteBusy(null);
    }
  };

  const filtered = leads.filter((l) => filter === "ALL" || l.status === filter);

  return (
    <div dir="rtl" className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-white">לידים</h1>
        <button
          onClick={load}
          className="text-sm text-gray-400 hover:text-white border border-gray-700 rounded-xl px-3 py-1.5"
        >
          רענן
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["ALL", "NEW", "IN_PROGRESS", "CLOSED", "LOST"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              filter === s ? "bg-pink text-white" : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            {s === "ALL" ? "הכל" : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      {focusId && focusState === "not_found" && !loading && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
          הליד שבקישור לא נמצא ברשימה שלך או שאינו זמין יותר.
        </div>
      )}

      {loading ? (
        <div className="text-center text-gray-500 py-16">טוען...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-gray-500 py-16">אין לידים בקטגוריה זו</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((lead) => {
            const mine = lead.assignees.some((a) => a.id === myId);
            const wa = waLink(lead.phone);
            const contactable =
              !lead.doNotContactAt && lead.capabilities.canContact;
            return (
              <div
                id={`lead-${lead.id}`}
                key={lead.id}
                className={`bg-gray-900 border rounded-2xl p-4 space-y-3 ${
                  focusId === lead.id
                    ? "border-pink ring-2 ring-pink/30"
                    : "border-gray-700"
                }`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white">{lead.name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${STATUS_STYLE[lead.status]}`}>
                        {STATUS_LABEL[lead.status]}
                      </span>
                      {(lead.source === "FACEBOOK" ||
                        lead.source === "meta_lead_ads") && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-bold">FB</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                      {lead.phone && <span dir="ltr">{lead.phone}</span>}
                      {lead.service && <span>{lead.service}</span>}
                      {lead.company && <span>{lead.company}</span>}
                    </div>
                    {lead.assignees.length > 0 && (
                      <div className="text-[11px] text-gray-500 mt-1">
                        בטיפול: {lead.assignees.map((a) => a.name).join(", ")}
                      </div>
                    )}
                  </div>
                </div>

                {lead.message && (
                  <p className="text-xs text-gray-400 bg-gray-800/60 rounded-xl p-2.5 line-clamp-3">
                    {lead.message}
                  </p>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  {mine ? (
                    <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-pink/15 text-pink">
                      בטיפול שלך ✓
                    </span>
                  ) : (
                    <button
                      onClick={() => claim(lead)}
                      disabled={busyId === lead.id}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-pink hover:bg-pink-dark text-white transition-colors disabled:opacity-50"
                    >
                      קח לטיפול
                    </button>
                  )}
                  {mine && contactable && wa && (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-green-600/20 text-green-400 hover:bg-green-600/30 transition-colors"
                    >
                      וואטסאפ
                    </a>
                  )}
                  {mine && contactable && lead.phone && (
                    <>
                      <a
                        href={`tel:${lead.phone.replace(/[^+\d]/g, "")}`}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-cyan/15 text-cyan hover:bg-cyan/25 transition-colors"
                      >
                        התקשר
                      </a>
                      <button
                        type="button"
                        onClick={() => copyPhone(lead)}
                        className="rounded-xl bg-cyan/15 px-3 py-1.5 text-xs font-bold text-cyan transition-colors hover:bg-cyan/25"
                      >
                        העתק טלפון
                      </button>
                    </>
                  )}
                  {mine && contactable && (
                    <button
                      type="button"
                      onClick={() => setSelectedForOutcome(lead)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-pink/15 text-pink hover:bg-pink/25 transition-colors"
                    >
                      תעד תוצאת שיחה
                    </button>
                  )}
                  {mine &&
                    lead.status !== "CLOSED" &&
                    lead.status !== "LOST" && (
                    <button
                      onClick={() => setStatus(lead, "CLOSED")}
                      disabled={busyId === lead.id}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-green-600 hover:bg-green-500 text-white transition-colors disabled:opacity-50"
                    >
                      הכשר ליד והכן חוזה
                    </button>
                  )}
                  <button
                    onClick={() => toggleNotes(lead.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                      openNotes.has(lead.id) || lead.myNotesCount > 0
                        ? "bg-amber-500/15 text-amber-400"
                        : "bg-gray-800 text-gray-400 hover:text-white"
                    }`}
                  >
                    📝 הערות חברה{lead.myNotesCount > 0 ? ` (${lead.myNotesCount})` : ""}
                  </button>
                </div>

                {openNotes.has(lead.id) && (
                  <div className="border-t border-gray-800 pt-3 space-y-2">
                    {(notesByLead[lead.id] ?? []).length === 0 ? (
                      <p className="text-xs text-gray-600">
                        אין הערות עדיין — תעד מה קרה ומה הצעד הבא לצוות.
                      </p>
                    ) : (
                      <ol className="space-y-1.5">
                        {(notesByLead[lead.id] ?? []).map((n, i) => (
                          <li key={n.id} className="flex items-start gap-2 text-xs bg-gray-800/60 rounded-xl px-3 py-2">
                            <span className="shrink-0 font-mono font-bold text-amber-400">{i + 1}.</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-gray-200 whitespace-pre-wrap break-words">{n.body}</p>
                              <p className="text-[10px] text-gray-500 mt-0.5">
                                {new Date(n.createdAt).toLocaleString("he-IL", {
                                  day: "numeric",
                                  month: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>
                            </div>
                            <span className="shrink-0 text-[10px] text-gray-500">
                              {n.author?.name ?? ""}
                            </span>
                          </li>
                        ))}
                      </ol>
                    )}
                    <div className="flex gap-2">
                      <input
                        value={noteDraft[lead.id] ?? ""}
                        onChange={(e) => setNoteDraft((prev) => ({ ...prev, [lead.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            addNote(lead.id);
                          }
                        }}
                        placeholder="הערה חדשה... (למשל: התקשרתי, לא ענו, לחזור מחר ב-10)"
                        className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500/50 placeholder:text-gray-600"
                      />
                      <button
                        onClick={() => addNote(lead.id)}
                        disabled={noteBusy === lead.id || !(noteDraft[lead.id] ?? "").trim()}
                        className="px-3 py-2 rounded-xl text-xs font-bold bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors disabled:opacity-40"
                      >
                        הוסף
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selectedForOutcome && (
        <LeadOutcomeSheet
          lead={{
            displayName:
              selectedForOutcome.company ??
              selectedForOutcome.name ??
              "ליד ללא שם",
            name: selectedForOutcome.name,
            company: selectedForOutcome.company,
            preparation: null,
          }}
          isOpen
          busy={outcomeBusy}
          onClose={() => setSelectedForOutcome(null)}
          onSubmit={saveOutcome}
        />
      )}

      <Modal
        isOpen={copyFallbackPhone !== null}
        onClose={() => setCopyFallbackPhone(null)}
        title="העתקת מספר הטלפון"
      >
        <p className="mb-3 text-sm text-gray-400">
          ההעתקה האוטומטית נחסמה. סמנו והעתיקו את המספר:
        </p>
        <input
          ref={fallbackPhoneInputRef}
          value={copyFallbackPhone ?? ""}
          readOnly
          dir="ltr"
          onFocus={(event) => event.currentTarget.select()}
          className="w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-3 text-white outline-none focus:border-pink"
        />
      </Modal>
    </div>
  );
}
