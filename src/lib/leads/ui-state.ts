import type {
  LeadInteractionChannel,
  LeadInteractionOutcome,
  LeadIntentLevel,
  LeadLossReason,
  LeadStage,
} from "@prisma/client";

import type { LeadCapabilities, LeadNextAction } from "./projection";

export type LeadPrimaryActionKind =
  | "START_PREPARATION"
  | "CLAIM_AND_CALL"
  | "CALL"
  | "RECORD_OUTCOME"
  | "CREATE_AGREEMENT"
  | "VIEW_AGREEMENT"
  | "NONE";

export type LeadWorkspaceTab = "activity" | "preparation" | "agreement";

const LEAD_WORKSPACE_TABS = new Set<LeadWorkspaceTab>([
  "activity",
  "preparation",
  "agreement",
]);

export function leadWorkspaceTabFromQuery(value: unknown): LeadWorkspaceTab {
  return typeof value === "string" &&
    LEAD_WORKSPACE_TABS.has(value as LeadWorkspaceTab)
    ? (value as LeadWorkspaceTab)
    : "activity";
}

export interface LeadUiStateInput {
  intentLevel: LeadIntentLevel | null;
  stage: LeadStage | null;
  nextAction: LeadNextAction;
  capabilities: LeadCapabilities;
}

export interface LeadContactActionInput {
  doNotContactAt: string | null;
  phone: string | null;
  phoneSource?: "CRM" | "GOOGLE" | "NONE";
  allowPublicPhoneBeforeClaim?: boolean;
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

export interface LeadContactDraft {
  name: string;
  company: string;
  email: string;
  phone: string;
}

export interface LeadContactCurrent {
  name: string | null;
  company: string | null;
  email: string | null;
  phone: string | null;
  phoneSource: "CRM" | "GOOGLE" | "NONE";
}

export type LeadContactUpdate = Partial<LeadContactDraft>;

export interface LeadOutcomeFormState {
  channel: LeadInteractionChannel;
  outcome: LeadInteractionOutcome | null;
  decisionMakerReached: boolean;
  note: string;
  followUpAction: "SCHEDULE" | "END_AS_LOST" | null;
  followUpAt: string;
  followUpIsFuture: boolean;
  lossReason: LeadLossReason | null;
  lossReasonDetails: string;
  usedCallAngleIds: string[];
}

export function contactDetailsForUpdate(input: {
  current: LeadContactCurrent;
  draft: LeadContactDraft;
  confirmGooglePhone: boolean;
}): LeadContactUpdate {
  const values: LeadContactDraft = {
    name: input.draft.name.trim(),
    company: input.draft.company.trim(),
    email: input.draft.email.trim(),
    phone: input.draft.phone.trim(),
  };
  const changed = Object.fromEntries(
    (Object.keys(values) as Array<keyof LeadContactDraft>).flatMap((key) => {
      const value = values[key];
      return value && value !== (input.current[key] ?? "")
        ? [[key, value]]
        : [];
    }),
  ) as LeadContactUpdate;

  if (
    input.confirmGooglePhone &&
    input.current.phoneSource === "GOOGLE" &&
    values.phone &&
    values.phone === input.current.phone
  ) {
    changed.phone = values.phone;
  }

  return changed;
}

export function initialLeadOutcomeFormState(): LeadOutcomeFormState {
  return {
    channel: "PHONE",
    outcome: null,
    decisionMakerReached: false,
    note: "",
    followUpAction: null,
    followUpAt: "",
    followUpIsFuture: false,
    lossReason: null,
    lossReasonDetails: "",
    usedCallAngleIds: [],
  };
}

export function mergeLeadQueueItems<T extends { id: string }>(
  current: readonly T[],
  next: readonly T[],
): T[] {
  const merged = new Map(current.map((item) => [item.id, item]));
  for (const item of next) merged.set(item.id, item);
  return Array.from(merged.values());
}

export type AdminStageAction =
  | "mark-lost"
  | "mark-spam"
  | "reopen-lost";

export function firstAllowedAdminStageAction(capabilities: {
  canMarkLost: boolean;
  canMarkSpam: boolean;
  canReopen: boolean;
}): AdminStageAction | null {
  if (capabilities.canMarkLost) return "mark-lost";
  if (capabilities.canMarkSpam) return "mark-spam";
  if (capabilities.canReopen) return "reopen-lost";
  return null;
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
  phoneSource,
  allowPublicPhoneBeforeClaim = false,
  website,
  mapUrl,
  capabilities,
}: LeadContactActionInput): LeadContactActionState {
  const blocked = Boolean(doNotContactAt);
  const hasPhone = Boolean(phone);
  const canUsePhone =
    capabilities.canContact ||
    (allowPublicPhoneBeforeClaim &&
      phoneSource === "GOOGLE" &&
      capabilities.canClaim);

  return {
    blocked,
    canCall: !blocked && hasPhone && canUsePhone,
    canCopyPhone: !blocked && hasPhone && canUsePhone,
    canWhatsApp: !blocked && hasPhone && capabilities.canContact,
    canOpenWebsite: Boolean(website),
    canOpenMap: Boolean(mapUrl),
    canScheduleFollowUp: !blocked && capabilities.canScheduleFollowUp,
  };
}
