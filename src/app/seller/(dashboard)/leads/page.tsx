"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";

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
  assignees: { id: string; name: string }[];
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

export default function SellerLeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [myId, setMyId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | LeadStatus>("ALL");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [meRes, leadsRes] = await Promise.all([
        fetch("/api/seller/me", { cache: "no-store" }),
        fetch("/api/seller/leads", { cache: "no-store" }),
      ]);
      if (meRes.ok) setMyId((await meRes.json()).id);
      if (leadsRes.ok) setLeads((await leadsRes.json()).leads ?? []);
    } catch {
      toast.error("שגיאה בטעינת הלידים");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const claim = async (lead: Lead) => {
    setBusyId(lead.id);
    try {
      const res = await fetch(`/api/seller/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "claim", status: "IN_PROGRESS" }),
      });
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
      load();
    } catch {
      toast.error("שגיאה בעדכון סטטוס");
    } finally {
      setBusyId(null);
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

      {loading ? (
        <div className="text-center text-gray-500 py-16">טוען...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-gray-500 py-16">אין לידים בקטגוריה זו</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((lead) => {
            const mine = lead.assignees.some((a) => a.id === myId);
            const wa = waLink(lead.phone);
            return (
              <div key={lead.id} className="bg-gray-900 border border-gray-700 rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white">{lead.name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${STATUS_STYLE[lead.status]}`}>
                        {STATUS_LABEL[lead.status]}
                      </span>
                      {lead.source === "FACEBOOK" && (
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
                  {wa && (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-green-600/20 text-green-400 hover:bg-green-600/30 transition-colors"
                    >
                      וואטסאפ
                    </a>
                  )}
                  <Link
                    href={agreementLink(lead)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-gray-800 text-white hover:bg-gray-700 transition-colors"
                  >
                    הוצאת חוזה
                  </Link>
                  {lead.status !== "CLOSED" && lead.status !== "LOST" && (
                    <button
                      onClick={() => setStatus(lead, "LOST")}
                      disabled={busyId === lead.id}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-gray-800 text-gray-400 hover:text-red-400 transition-colors disabled:opacity-50"
                    >
                      סמן כאבוד
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
