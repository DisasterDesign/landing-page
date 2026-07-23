import type { LeadIntentLevel, LeadStage } from "@prisma/client";

import type { LeadCapabilities, LeadNextAction } from "./projection";

export type LeadPrimaryActionKind =
  | "START_PREPARATION"
  | "CLAIM_AND_CALL"
  | "CALL"
  | "RECORD_OUTCOME"
  | "CREATE_AGREEMENT"
  | "VIEW_AGREEMENT"
  | "NONE";

export interface LeadUiStateInput {
  intentLevel: LeadIntentLevel | null;
  stage: LeadStage | null;
  nextAction: LeadNextAction;
  capabilities: LeadCapabilities;
}

export interface LeadContactActionInput {
  doNotContactAt: string | null;
  phone: string | null;
  website: string | null;
  mapUrl: string | null;
  capabilities: LeadCapabilities;
}

export interface LeadContactActionState {
  blocked: boolean;
  canCall: boolean;
  canCopyPhone: boolean;
  canWhatsApp: boolean;
  canOpenWebsite: boolean;
  canOpenMap: boolean;
  canScheduleFollowUp: boolean;
}

const TERMINAL_STAGES = new Set<LeadStage>(["WON", "LOST", "SPAM"]);

export function primaryLeadAction({
  intentLevel,
  stage,
  nextAction,
  capabilities,
}: LeadUiStateInput): LeadPrimaryActionKind {
  if (!stage || TERMINAL_STAGES.has(stage)) {
    return "NONE";
  }

  if (
    nextAction.kind === "VIEW_AGREEMENT" ||
    nextAction.kind === "RECOVER_FIRST_PAYMENT"
  ) {
    return "VIEW_AGREEMENT";
  }

  if (capabilities.canCreateAgreement) {
    return "CREATE_AGREEMENT";
  }

  if (capabilities.canClaim) {
    return intentLevel === "OUTBOUND"
      ? "START_PREPARATION"
      : "CLAIM_AND_CALL";
  }

  if (
    capabilities.canContact &&
    (stage === "NEW" || stage === "PREPARING" || stage === "CONTACTING")
  ) {
    return "CALL";
  }

  if (capabilities.canRecordInteraction) {
    return "RECORD_OUTCOME";
  }

  return "NONE";
}

export function leadContactActionState({
  doNotContactAt,
  phone,
  website,
  mapUrl,
  capabilities,
}: LeadContactActionInput): LeadContactActionState {
  const blocked = Boolean(doNotContactAt);
  const hasPhone = Boolean(phone);

  return {
    blocked,
    canCall: !blocked && hasPhone && capabilities.canContact,
    canCopyPhone: !blocked && hasPhone && capabilities.canContact,
    canWhatsApp: !blocked && hasPhone && capabilities.canContact,
    canOpenWebsite: Boolean(website),
    canOpenMap: Boolean(mapUrl),
    canScheduleFollowUp: !blocked && capabilities.canScheduleFollowUp,
  };
}
