"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import type { LeadDetail } from "@/lib/leads/projection";

async function errorMessage(response: Response) {
  const body = (await response.json().catch(() => null)) as {
    message?: string;
    error?: string;
  } | null;
  return body?.message ?? body?.error ?? "הפעולה נכשלה";
}

export default function LeadOwnershipControls({
  lead,
}: {
  lead: LeadDetail;
}) {
  const router = useRouter();
  const [sellers, setSellers] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [sellerId, setSellerId] = useState(
    lead.owner?.id ?? lead.eligibleSeller?.id ?? "",
  );
  const [reason, setReason] = useState("");
  const [cancelFollowUps, setCancelFollowUps] = useState(false);
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

  async function submit(action: "reassign" | "release") {
    if (!reason.trim() || (action === "reassign" && !sellerId)) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/leads/${lead.id}/ownership`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ...(action === "reassign" ? { sellerId } : {}),
          reason: reason.trim(),
          ...(action === "release" ? { cancelFollowUps } : {}),
        }),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      toast.success(action === "reassign" ? "הבעלות הועברה" : "הבעלות שוחררה");
      setReason("");
      window.dispatchEvent(
        new CustomEvent("lead:changed", { detail: { id: lead.id } }),
      );
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "הפעולה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  if (!lead.capabilities.canReassign) return null;

  return (
    <section
      dir="rtl"
      className="rounded-2xl border border-gray-700 bg-gray-900 p-4"
    >
      <h2 className="font-bold text-white">בעלות על הליד</h2>
      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_2fr]">
        <select
          value={sellerId}
          onChange={(event) => setSellerId(event.target.value)}
          className="rounded-xl border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white outline-none focus:border-pink"
        >
          <option value="">בחר איש מכירות</option>
          {sellers.map((seller) => (
            <option key={seller.id} value={seller.id}>
              {seller.name}
            </option>
          ))}
        </select>
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="סיבת ההעברה או השחרור"
          className="rounded-xl border border-gray-700 bg-gray-800 px-3 py-2.5 text-sm text-white outline-none focus:border-pink"
        />
      </div>
      <label className="mt-3 flex items-center gap-2 text-xs text-gray-400">
        <input
          type="checkbox"
          checked={cancelFollowUps}
          onChange={(event) => setCancelFollowUps(event.target.checked)}
          className="accent-pink"
        />
        בשחרור בעלות, בטל גם פולואפ פעיל
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !sellerId || reason.trim().length < 3}
          onClick={() => submit("reassign")}
          className="rounded-xl bg-cyan/20 px-4 py-2 text-sm font-bold text-cyan disabled:opacity-40"
        >
          העבר בעלות
        </button>
        <button
          type="button"
          disabled={busy || reason.trim().length < 3}
          onClick={() => submit("release")}
          className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-300 disabled:opacity-40"
        >
          שחרר בעלות
        </button>
      </div>
    </section>
  );
}
