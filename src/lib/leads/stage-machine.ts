import type { ContactStatus, LeadStage } from "@prisma/client";
import { LeadDomainError } from "./errors";
import type { LeadTransitionContext } from "./types";

const forward: Record<LeadStage, readonly LeadStage[]> = {
  NEW: ["PREPARING", "CONTACTING", "LOST", "SPAM"],
  PREPARING: ["CONTACTING", "LOST"],
  CONTACTING: ["QUALIFIED", "LOST", "SPAM"],
  QUALIFIED: ["AGREEMENT_DRAFT", "LOST"],
  AGREEMENT_DRAFT: ["AGREEMENT_SENT", "QUALIFIED", "LOST"],
  AGREEMENT_SENT: ["AGREEMENT_SIGNED", "QUALIFIED", "LOST"],
  AGREEMENT_SIGNED: ["QUALIFIED", "LOST"],
  WON: [],
  LOST: [],
  SPAM: [],
};

export function canTransitionLeadStage(
  from: LeadStage,
  to: LeadStage,
  context: LeadTransitionContext,
): boolean {
  if (to === "WON") {
    return (
      context.actorType === "INTEGRATION" &&
      ["AGREEMENT_SIGNED", "LOST"].includes(from)
    );
  }
  if (from === "LOST") {
    return (
      context.actorType === "USER" &&
      context.actorRole === "ADMIN" &&
      to === "CONTACTING"
    );
  }
  if (from === "NEW" && to === "PREPARING") {
    return context.intentLevel === "OUTBOUND";
  }
  if (from === "NEW" && to === "CONTACTING") {
    return context.intentLevel !== "OUTBOUND";
  }
  if (to === "SPAM") {
    return (
      context.intentLevel !== "OUTBOUND" &&
      ["NEW", "CONTACTING"].includes(from)
    );
  }
  return forward[from].includes(to);
}

export function assertLeadStageTransition(
  from: LeadStage,
  to: LeadStage,
  context: LeadTransitionContext,
): void {
  if (!canTransitionLeadStage(from, to, context)) {
    const suffix = to === "WON" ? " (WON is system-only)" : "";
    throw new LeadDomainError("INVALID_TRANSITION", `${from} → ${to}${suffix}`);
  }
}

export function legacyStatusForStage(stage: LeadStage): ContactStatus {
  if (stage === "NEW") return "NEW";
  if (stage === "WON") return "CLOSED";
  if (stage === "LOST") return "LOST";
  if (stage === "SPAM") return "SPAM";
  return "IN_PROGRESS";
}
