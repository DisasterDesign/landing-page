"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  ImageDropArea,
  imageSkipMessage,
  localId,
  prepareImages,
  ThumbGrid,
  uploadTaskImage,
  useImagePaste,
  type PendingImage,
} from "@/components/admin/TaskImages";

interface Commission {
  amount: number;
  status: "PENDING" | "PAID";
  briefTaskId: string | null;
}

interface Deal {
  id: string;
  tier: string | null;
  monthlyPrice: number;
  customerName: string;
  businessName: string | null;
  phone: string;
  status: string;
  paymentStatus: string;
  signToken: string;
  paidAmount: number | null;
  createdAt: string;
  commission: Commission | null;
}

const fmt = (n: number) => n.toLocaleString("he-IL", { maximumFractionDigits: 0 });

const PAYMENT_LABEL: Record<string, string> = {
  PENDING: "טרם שולם",
  SENT: "נשלח לתשלום",
  COMPLETED: "שולם ✓",
  FAILED: "נכשל",
  CANCELLED: "בוטל",
};

export default function SellerSalesPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [briefFor, setBriefFor] = useState<Deal | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/seller/agreements", { cache: "no-store" });
      if (res.ok) setDeals((await res.json()).data ?? []);
    } catch {
      toast.error("שגיאה בטעינה");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const copySign = async (token: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/agreement/${token}`);
      toast.success("קישור החתימה הועתק");
    } catch {
      toast.error("העתקה נכשלה");
    }
  };

  return (
    <div dir="rtl" className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">העסקאות שלי</h1>
        <button onClick={load} className="text-sm text-gray-400 hover:text-white border border-gray-700 rounded-xl px-3 py-1.5">
          רענן
        </button>
      </div>

      {loading ? (
        <div className="text-center text-gray-500 py-16">טוען...</div>
      ) : deals.length === 0 ? (
        <div className="text-center text-gray-500 py-16">
          עדיין אין עסקאות. <Link href="/seller/agreements/new" className="text-pink hover:underline">הוצא חוזה ראשון</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {deals.map((d) => {
            const paid = d.paymentStatus === "COMPLETED";
            return (
              <div key={d.id} className="bg-gray-900 border border-gray-700 rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-bold text-white">
                      {d.customerName}
                      {d.businessName ? <span className="text-gray-500 font-normal"> · {d.businessName}</span> : null}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {fmt(d.monthlyPrice)} ₪ / חודש · {new Date(d.createdAt).toLocaleDateString("he-IL")}
                    </div>
                  </div>
                  <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold ${paid ? "bg-green-500/15 text-green-400" : "bg-gray-700 text-gray-300"}`}>
                    {PAYMENT_LABEL[d.paymentStatus] ?? d.paymentStatus}
                  </span>
                </div>

                {paid && d.commission ? (
                  <div className="flex items-center justify-between gap-3 flex-wrap border-t border-gray-800 pt-3">
                    <div className="text-sm">
                      <span className="text-gray-400">עמלה: </span>
                      <span className="font-mono font-bold text-pink">{fmt(d.commission.amount)} ₪</span>
                      <span className={`mr-2 text-[11px] px-2 py-0.5 rounded-full ${d.commission.status === "PAID" ? "bg-green-500/15 text-green-400" : "bg-amber-500/15 text-amber-400"}`}>
                        {d.commission.status === "PAID" ? "שולם לך" : "ממתין לתשלום"}
                      </span>
                    </div>
                    {d.commission.briefTaskId ? (
                      <span className="text-xs font-bold text-green-400">בריף נשלח ✓</span>
                    ) : (
                      <button
                        onClick={() => setBriefFor(d)}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-pink hover:bg-pink-dark text-white transition-colors"
                      >
                        📤 שלח בריף לאלעד
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2 border-t border-gray-800 pt-3">
                    <button
                      onClick={() => copySign(d.signToken)}
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-gray-800 text-white hover:bg-gray-700 transition-colors"
                    >
                      העתק קישור חתימה
                    </button>
                    <a
                      href={`https://wa.me/${d.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`היי, קישור לחתימה על ההסכם: ${typeof window !== "undefined" ? window.location.origin : ""}/agreement/${d.signToken}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-xl text-xs font-bold bg-green-600/20 text-green-400 hover:bg-green-600/30 transition-colors"
                    >
                      שלח ללקוח
                    </a>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {briefFor && (
        <BriefModal
          deal={briefFor}
          onClose={() => setBriefFor(null)}
          onSent={() => {
            setBriefFor(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function BriefModal({
  deal,
  onClose,
  onSent,
}: {
  deal: Deal;
  onClose: () => void;
  onSent: () => void;
}) {
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState(deal.phone ?? "");
  const [pending, setPending] = useState<PendingImage[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    return () => {
      setPending((prev) => {
        prev.forEach((p) => URL.revokeObjectURL(p.previewUrl));
        return prev;
      });
    };
  }, []);

  const addImages = useCallback(async (files: File[]) => {
    const prepared = await prepareImages(files, (name, reason) =>
      toast.error(imageSkipMessage(name, reason))
    );
    if (prepared.length > 0) {
      setPending((prev) => [
        ...prev,
        ...prepared.map((c) => ({
          localId: localId(),
          compressed: c,
          previewUrl: URL.createObjectURL(c.blob),
        })),
      ]);
    }
  }, []);

  useImagePaste(addImages);

  const submit = async () => {
    if (!description.trim()) {
      toast.error("תיאור חובה");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/seller/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agreementId: deal.id,
          description: description.trim(),
          phone: phone.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "שגיאה בשליחת הבריף");
      }
      const { taskId } = (await res.json()) as { taskId: string };

      let failed = 0;
      for (const img of pending) {
        try {
          await uploadTaskImage(taskId, img.compressed, `/api/seller/brief/${taskId}/images`);
        } catch {
          failed++;
        }
      }
      toast.success(failed > 0 ? `הבריף נשלח (${failed} תמונות נכשלו)` : "הבריף נשלח לאלעד! 🎉");
      onSent();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4" onClick={onClose}>
      <div
        className="bg-gray-900 border border-gray-700 rounded-t-2xl md:rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto p-5 space-y-4"
        dir="rtl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">בריף אתר — {deal.customerName}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none">✕</button>
        </div>
        <p className="text-xs text-gray-400">
          רשימה מסודרת על האתר לאלעד: תיאור כללי, טלפון ליצירת קשר, ותמונות/צילומי מסך אם יש.
        </p>

        <div>
          <label className="block text-sm text-gray-400 mb-1">תיאור כללי על האתר *</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            placeholder="מה הלקוח צריך, סגנון, עמודים, דגשים מיוחדים..."
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-pink resize-none"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">טלפון ליצירת קשר</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            dir="ltr"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-pink"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">
            תמונות / צילומי מסך
            {pending.length > 0 && <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full mr-2">{pending.length}</span>}
          </label>
          <ImageDropArea onFiles={addImages}>
            <ThumbGrid
              items={pending.map((p) => ({ key: p.localId, url: p.previewUrl, filename: p.compressed.filename }))}
              onOpen={() => {}}
              onRemove={(key) =>
                setPending((prev) => {
                  const t = prev.find((p) => p.localId === key);
                  if (t) URL.revokeObjectURL(t.previewUrl);
                  return prev.filter((p) => p.localId !== key);
                })
              }
            />
            {pending.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-3">הדבק (Ctrl+V / ⌘V), גרור או בחר תמונות</p>
            )}
          </ImageDropArea>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            onClick={submit}
            disabled={submitting}
            className="flex-1 bg-pink hover:bg-pink-dark text-white font-bold py-2.5 rounded-xl transition-colors disabled:opacity-50"
          >
            {submitting ? "שולח..." : "שלח בריף לאלעד"}
          </button>
          <button onClick={onClose} className="px-4 border border-gray-700 text-gray-300 rounded-xl">ביטול</button>
        </div>
      </div>
    </div>
  );
}
