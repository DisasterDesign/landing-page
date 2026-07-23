"use client";

import Link from "next/link";

import type { LeadDetail } from "@/lib/leads/projection";
import {
  primaryLeadAction,
  type LeadPrimaryActionKind,
} from "@/lib/leads/ui-state";

const labels: Record<LeadPrimaryActionKind, string> = {
  START_PREPARATION: "התחל הכנה",
  CLAIM_AND_CALL: "קח ליד והתקשר",
  CALL: "התקשר",
  RECORD_OUTCOME: "תעד תוצאה",
  CREATE_AGREEMENT: "הכן חוזה",
  VIEW_AGREEMENT: "פתח חוזה",
  NONE: "",
};

export default function LeadPrimaryAction({
  lead,
  audience,
  busy = false,
  onAction,
}: {
  lead: LeadDetail;
  audience: "seller" | "admin";
  busy?: boolean;
  onAction: (action: LeadPrimaryActionKind) => void;
}) {
  const action = primaryLeadAction({
    intentLevel: lead.intentLevel,
    stage: lead.stage,
    nextAction: lead.nextAction,
    capabilities: lead.capabilities,
  });

  if (action === "NONE") return null;

  if (action === "CREATE_AGREEMENT") {
    return (
      <Link
        href={
          audience === "seller"
            ? `/seller/agreements/new?leadId=${encodeURIComponent(lead.id)}`
            : `/admin/agreements?leadId=${encodeURIComponent(lead.id)}`
        }
        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-pink px-5 py-2.5 text-sm font-bold text-white transition hover:bg-pink-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink"
      >
        {labels[action]}
      </Link>
    );
  }

  if (action === "VIEW_AGREEMENT") {
    const agreementId =
      lead.nextAction.kind === "VIEW_AGREEMENT" ||
      lead.nextAction.kind === "RECOVER_FIRST_PAYMENT"
        ? lead.nextAction.agreementId
        : lead.agreements.at(-1)?.id;
    const href =
      audience === "seller"
        ? `/seller/sales?focus=${agreementId ?? ""}`
        : `/admin/agreements?focus=${agreementId ?? ""}`;
    return (
      <Link
        href={href}
        className="inline-flex min-h-11 items-center justify-center rounded-xl bg-pink px-5 py-2.5 text-sm font-bold text-white transition hover:bg-pink-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink"
      >
        {labels[action]}
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => onAction(action)}
      className="min-h-11 rounded-xl bg-pink px-5 py-2.5 text-sm font-bold text-white transition hover:bg-pink-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink disabled:cursor-not-allowed disabled:opacity-50"
    >
      {busy ? "שומר..." : labels[action]}
    </button>
  );
}
