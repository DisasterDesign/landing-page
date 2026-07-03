"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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

interface Deal {
  id: string;
  customerName: string;
  businessName: string | null;
  phone: string;
  paymentStatus: string;
  commission: { briefTaskId: string | null } | null;
}

export default function DeveloperReportPage() {
  const { agreementId } = useParams<{ agreementId: string }>();
  const router = useRouter();

  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [businessName, setBusinessName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [businessField, setBusinessField] = useState("");
  const [domainName, setDomainName] = useState("");
  const [contentStatus, setContentStatus] = useState("");
  const [description, setDescription] = useState("");
  const [designNotes, setDesignNotes] = useState("");
  const [extraNotes, setExtraNotes] = useState("");
  const [pending, setPending] = useState<PendingImage[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/seller/agreements", { cache: "no-store" });
        if (!res.ok) throw new Error();
        const { data } = (await res.json()) as { data: Deal[] };
        const d = data.find((a) => a.id === agreementId) ?? null;
        setDeal(d);
        if (d) {
          setBusinessName(d.businessName ?? "");
          setContactName(d.customerName);
          setPhone(d.phone ?? "");
        }
      } catch {
        toast.error("שגיאה בטעינה");
      } finally {
        setLoading(false);
      }
    })();
  }, [agreementId]);

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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      toast.error("תיאור האתר המבוקש הוא שדה חובה");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/seller/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agreementId,
          description: description.trim(),
          businessName: businessName.trim() || undefined,
          contactName: contactName.trim() || undefined,
          phone: phone.trim() || undefined,
          businessField: businessField.trim() || undefined,
          domainName: domainName.trim() || undefined,
          contentStatus: contentStatus.trim() || undefined,
          designNotes: designNotes.trim() || undefined,
          extraNotes: extraNotes.trim() || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "שגיאה בשליחת הדוח");

      let failed = 0;
      for (const img of pending) {
        try {
          await uploadTaskImage(json.taskId, img.compressed, `/api/seller/brief/${json.taskId}/images`);
        } catch {
          failed++;
        }
      }
      toast.success(
        failed > 0 ? `הדוח נשלח לאלעד (${failed} תמונות נכשלו)` : "הדוח נשלח לאלעד! 🎉"
      );
      router.push("/seller/sales");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "שגיאה");
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:border-pink";
  const labelClass = "block text-sm text-gray-400 mb-1";

  if (loading) {
    return <div className="text-center text-gray-500 py-16">טוען...</div>;
  }

  if (!deal) {
    return (
      <div dir="rtl" className="text-center py-16 space-y-3">
        <p className="text-gray-400">העסקה לא נמצאה</p>
        <Link href="/seller/sales" className="text-pink hover:underline text-sm">
          חזרה לעסקאות שלי
        </Link>
      </div>
    );
  }

  if (deal.commission?.briefTaskId) {
    return (
      <div dir="rtl" className="max-w-md mx-auto text-center py-16 space-y-3">
        <div className="text-3xl">✅</div>
        <p className="text-white font-bold">הדוח על {deal.customerName} כבר נשלח לאלעד</p>
        <Link href="/seller/sales" className="text-pink hover:underline text-sm">
          חזרה לעסקאות שלי
        </Link>
      </div>
    );
  }

  return (
    <div dir="rtl" className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">📋 דוח למפתח — {deal.customerName}</h1>
        <p className="text-sm text-gray-400 mt-1">
          מלא/י את כל הפרטים על הלקוח החדש. הדוח נכנס מיידית כמשימה לאלעד לתחילת העבודה על האתר.
        </p>
      </div>

      <form onSubmit={submit} className="bg-gray-900 border border-gray-700 rounded-2xl p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>שם העסק</label>
            <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>איש קשר</label>
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>טלפון</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>תחום העסק</label>
            <input value={businessField} onChange={(e) => setBusinessField(e.target.value)} placeholder="מסעדה / קליניקה / קבלן..." className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>דומיין רצוי</label>
            <input value={domainName} onChange={(e) => setDomainName(e.target.value)} dir="ltr" placeholder="example.co.il" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>חומרים קיימים</label>
            <input value={contentStatus} onChange={(e) => setContentStatus(e.target.value)} placeholder="לוגו, תמונות, טקסטים..." className={inputClass} />
          </div>
        </div>

        <div>
          <label className={labelClass}>
            תיאור האתר המבוקש <span className="text-pink">*</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            required
            placeholder="מה הלקוח צריך, אילו עמודים, מה חשוב לו, דגשים מהשיחה..."
            className={`${inputClass} resize-none`}
          />
        </div>

        <div>
          <label className={labelClass}>הערות עיצוב</label>
          <textarea
            value={designNotes}
            onChange={(e) => setDesignNotes(e.target.value)}
            rows={2}
            placeholder="צבעים, סגנון, אתרים שהלקוח אוהב..."
            className={`${inputClass} resize-none`}
          />
        </div>

        <div>
          <label className={labelClass}>הערות נוספות</label>
          <textarea
            value={extraNotes}
            onChange={(e) => setExtraNotes(e.target.value)}
            rows={2}
            className={`${inputClass} resize-none`}
          />
        </div>

        <div>
          <label className={labelClass}>
            תמונות / צילומי מסך
            {pending.length > 0 && (
              <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full mr-2">{pending.length}</span>
            )}
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
              <p className="text-sm text-gray-500 text-center py-3">
                הדבק (Ctrl+V / ⌘V), גרור או בחר תמונות מהלקוח
              </p>
            )}
          </ImageDropArea>
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 bg-pink hover:bg-pink-dark text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-50"
          >
            {submitting ? "שולח..." : "שלח דוח לאלעד 📤"}
          </button>
          <Link href="/seller/sales" className="px-4 py-3 border border-gray-700 text-gray-300 rounded-xl">
            ביטול
          </Link>
        </div>
      </form>
    </div>
  );
}
