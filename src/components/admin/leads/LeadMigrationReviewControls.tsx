"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import type { LeadDetail } from "@/lib/leads/projection";

const fieldClass =
  "w-full rounded-xl border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white outline-none focus:border-pink";

export default function LeadMigrationReviewControls({
  lead,
}: {
  lead: LeadDetail;
}) {
  const router = useRouter();
  const [sellers, setSellers] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [intentLevel, setIntentLevel] = useState<
    "OUTBOUND" | "AD_RESPONSE" | "INBOUND"
  >("INBOUND");
  const [sourceKey, setSourceKey] = useState("website");
  const [externalLeadId, setExternalLeadId] = useState("");
  const [stage, setStage] = useState("NEW");
  const [eligibleSellerId, setEligibleSellerId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [reason, setReason] = useState("");
  const [snapshot, setSnapshot] = useState(
    JSON.stringify(
      {
        landingPage: "/contact",
        receivedAt: lead.createdAt,
      },
      null,
      2,
    ),
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetch("/api/users", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : []))
      .then(
        (users: Array<{ id: string; name: string; role: string }>) =>
          setSellers(
            users
              .filter((user) => user.role === "SELLER")
              .map(({ id, name }) => ({ id, name })),
          ),
      );
  }, []);

  async function submit() {
    setBusy(true);
    try {
      const response = await fetch(
        `/api/leads/${lead.id}/migration-resolution`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            intentLevel,
            sourceKey,
            ...(externalLeadId.trim()
              ? { externalLeadId: externalLeadId.trim() }
              : {}),
            sourceSnapshot: JSON.parse(snapshot),
            stage,
            ownerId: ownerId || null,
            eligibleSellerId,
            reason: reason.trim(),
          }),
        },
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          message?: string;
          error?: string;
        } | null;
        throw new Error(payload?.message ?? payload?.error ?? "הסיווג נכשל");
      }
      toast.success("החריגה סווגה והליד פעיל");
      window.dispatchEvent(
        new CustomEvent("lead:changed", { detail: { id: lead.id } }),
      );
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "הסיווג נכשל");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      dir="rtl"
      className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4"
    >
      <h2 className="font-bold text-amber-100">פתרון חריגת הגירה</h2>
      <p className="mt-1 text-sm text-amber-200">
        {lead.migrationReviewReason ??
          "המקור או הבעלות לא היו חד־משמעיים. אין לנחש."}
      </p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <select
          value={intentLevel}
          onChange={(event) =>
            setIntentLevel(event.target.value as typeof intentLevel)
          }
          className={fieldClass}
        >
          <option value="OUTBOUND">פנייה קרה</option>
          <option value="AD_RESPONSE">תגובה לפרסומת</option>
          <option value="INBOUND">פנייה יזומה</option>
        </select>
        <select
          value={sourceKey}
          onChange={(event) => setSourceKey(event.target.value)}
          className={fieldClass}
        >
          <option value="website">אתר</option>
          <option value="google_search_ads">Google Search</option>
          <option value="meta_lead_ads">Meta Lead Ads</option>
          <option value="google_maps">Google Maps</option>
        </select>
        <input
          value={externalLeadId}
          onChange={(event) => setExternalLeadId(event.target.value)}
          placeholder="External ID, אם נדרש"
          className={fieldClass}
        />
        <select
          value={stage}
          onChange={(event) => setStage(event.target.value)}
          className={fieldClass}
        >
          {[
            "NEW",
            "PREPARING",
            "CONTACTING",
            "QUALIFIED",
            "AGREEMENT_DRAFT",
            "AGREEMENT_SENT",
            "AGREEMENT_SIGNED",
            "LOST",
            "SPAM",
          ].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <select
          value={eligibleSellerId}
          onChange={(event) => setEligibleSellerId(event.target.value)}
          className={fieldClass}
        >
          <option value="">בחר מוכר זכאי</option>
          {sellers.map((seller) => (
            <option key={seller.id} value={seller.id}>
              {seller.name}
            </option>
          ))}
        </select>
        <select
          value={ownerId}
          onChange={(event) => setOwnerId(event.target.value)}
          className={fieldClass}
        >
          <option value="">ללא בעלים</option>
          {sellers.map((seller) => (
            <option key={seller.id} value={seller.id}>
              בעלות: {seller.name}
            </option>
          ))}
        </select>
      </div>
      <textarea
        value={snapshot}
        onChange={(event) => setSnapshot(event.target.value)}
        rows={8}
        dir="ltr"
        className={`${fieldClass} mt-3 resize-y`}
      />
      <input
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="הנימוק העובדתי להחלטה"
        className={`${fieldClass} mt-3`}
      />
      <button
        type="button"
        disabled={
          busy || !eligibleSellerId || reason.trim().length < 3
        }
        onClick={submit}
        className="mt-3 rounded-xl bg-pink px-5 py-2.5 text-sm font-bold text-white hover:bg-pink-dark disabled:opacity-40"
      >
        {busy ? "שומר..." : "אשר סיווג"}
      </button>
    </section>
  );
}
