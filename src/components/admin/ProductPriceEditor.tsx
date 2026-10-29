"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import Modal from "@/components/ui/Modal";

export interface PricedProduct {
  id: string;
  name: string;
  monthlyAmount: number | null;
  monthlyOriginalAmount?: number | null;
  monthlyOriginalCurrency?: string | null;
  monthlyPriceVersion?: number;
  status?: string;
}
interface Revision {
  id: string; version: number; reason: string; source: string; occurredAt: string;
  before: PricedProduct & { clientMonthlyAmount?: number | null }; after: PricedProduct & { clientMonthlyAmount?: number | null };
}

function displayPrice(product: Pick<PricedProduct, "monthlyAmount" | "monthlyOriginalAmount" | "monthlyOriginalCurrency">) {
  const amount = product.monthlyOriginalAmount ?? product.monthlyAmount;
  return amount == null ? "סכום לא ידוע" : `${amount.toLocaleString("he-IL", { maximumFractionDigits: 2 })} ${product.monthlyOriginalCurrency ?? "ILS"}`;
}

export default function ProductPriceEditor({ clientId, product, isOwner, onSaved }: {
  clientId: string; product: PricedProduct; isOwner: boolean; onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("ILS");
  const [reason, setReason] = useState("");
  const [source, setSource] = useState("");
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [busy, setBusy] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const endpoint = `/api/clients/${clientId}/products/${product.id}`;
  const showEditor = async () => {
    setAmount(String(product.monthlyOriginalAmount ?? product.monthlyAmount ?? ""));
    setCurrency(product.monthlyOriginalCurrency ?? "ILS");
    setReason(""); setSource(""); setRevisions([]); setHistoryLoaded(false); setOpen(true);
    try {
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error();
      setRevisions((await res.json()).revisions);
      setHistoryLoaded(true);
    } catch { toast.error("שגיאה בטעינת היסטוריית המחיר"); }
  };
  const save = async (restoreRevisionId?: string) => {
    if (!reason.trim() || (!restoreRevisionId && (!source.trim() || amount.trim() === ""))) return;
    setBusy(true);
    try {
      const priceCorrection = restoreRevisionId
        ? { restoreRevisionId, expectedVersion: product.monthlyPriceVersion ?? 0, reason }
        : { amount: Number(amount), currency, expectedVersion: product.monthlyPriceVersion ?? 0, reason, source };
      const res = await fetch(endpoint, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ priceCorrection }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "שגיאה בשמירה");
      setOpen(false); onSaved(); toast.success("המחיר עודכן והתיעוד נשמר");
    } catch (error) { toast.error(error instanceof Error ? error.message : "שגיאה בשמירה"); }
    finally { setBusy(false); }
  };
  return <div className="px-2 py-1 text-xs">
    <span dir="ltr">{displayPrice(product)}</span>
    {product.status !== undefined && product.status !== "בוצע" && <div className="text-gray-500">לא נספר בתחזית — המוצר אינו פעיל</div>}
    {product.monthlyOriginalCurrency === "USD" && <div className="text-amber-300">חסר שער המרה — אינו נספר בסכום בשקלים</div>}
    {isOwner && <button type="button" onClick={showEditor} className="block text-cyan hover:underline mt-1">תיקון מחיר והיסטוריה</button>}
    <Modal isOpen={open} onClose={() => { if (!busy) setOpen(false); }} title={`מחיר חודשי — ${product.name}`}>
      <form className="space-y-3 text-sm" onSubmit={event => { event.preventDefault(); void save(); }}>
        <p className="text-gray-400">תיקון רישום המחיר הנוכחי. נשמרים הערך הקודם, הסיבה ומקור המידע.</p>
        <p className="text-gray-400">שחזור מחזיר את מחיר המוצר ומחשב מחדש את סיכום הלקוח. הסיכום הקודם נשמר בתיעוד.</p>
        <label className="block">סכום חודשי במטבע המקורי<input required type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="block w-full bg-gray-800 rounded p-2" /></label>
        <label className="block">מטבע<select value={currency} onChange={e => setCurrency(e.target.value)} className="block w-full bg-gray-800 rounded p-2"><option value="ILS">ILS — שקל</option><option value="USD">USD — דולר אמריקאי</option></select></label>
        {currency === "USD" && <p className="text-amber-300">המחיר בדולר יישמר. חסר מקור לשער עדכני, ולכן הסכום יישאר מחוץ לתחזית בשקלים.</p>}
        <label className="block">מקור המחיר<input required maxLength={1000} value={source} onChange={e => setSource(e.target.value)} className="block w-full bg-gray-800 rounded p-2" /></label>
        <label className="block">סיבת תיקון או שחזור<textarea required maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} className="block w-full bg-gray-800 rounded p-2" /></label>
        <button disabled={busy || !historyLoaded} className="bg-cyan text-gray-900 rounded px-4 py-2 disabled:opacity-50">שמור מחיר</button>
        <div className="space-y-2 border-t border-gray-700 pt-3">
          <p>היסטוריית מחיר</p>
          {!historyLoaded ? <p>היסטוריה טרם נטענה</p> : revisions.length === 0 ? <p>אין תיקונים מתועדים קודמים</p> : revisions.map(revision => <div key={revision.id} className="text-xs p-2 bg-gray-800 rounded">
            <p>{new Date(revision.occurredAt).toLocaleString("he-IL")}: <bdi>{displayPrice(revision.before)} → {displayPrice(revision.after)}</bdi></p>
            <p>סיכום לקוח בשקלים: <bdi>{revision.before.clientMonthlyAmount ?? "לא ידוע"} → {revision.after.clientMonthlyAmount ?? "לא ידוע"}</bdi></p>
            <p>{revision.reason}</p><p className="text-gray-400">{revision.source}</p>
            {revision.version === product.monthlyPriceVersion && <button type="button" disabled={busy || !reason.trim()} onClick={() => void save(revision.id)} className="text-cyan mt-1 disabled:opacity-50">שחזר את המחיר שלפני שינוי זה</button>}
          </div>)}
        </div>
      </form>
    </Modal>
  </div>;
}
