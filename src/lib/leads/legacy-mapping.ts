import type {
  AcquisitionChannel,
  ContactStatus,
  LeadIntentLevel,
  LeadInteractionChannel,
  LeadInteractionOutcome,
  LeadLossReason,
  LeadStage,
  ProspectCallOutcome,
} from "@prisma/client";

export interface LegacyLeadSourceInput {
  acquisitionChannel?: AcquisitionChannel | string | null;
  source?: string | null;
  prospect?: { placeId: string } | null;
}

export interface LegacyLeadSourceMapping {
  intentLevel: LeadIntentLevel;
  sourceKey: "google_maps" | "meta_lead_ads" | "website";
}

function normalizedLegacySource(value: string | null | undefined): string {
  return value?.trim().toLocaleUpperCase("en") ?? "";
}

/**
 * Maps only attribution that can be proved from a persisted legacy field.
 * Unknown/manual values deliberately stay unresolved for migration review.
 */
export function mapLegacyLeadSource(
  input: LegacyLeadSourceInput,
): LegacyLeadSourceMapping | null {
  if (input.prospect) {
    return { intentLevel: "OUTBOUND", sourceKey: "google_maps" };
  }

  const acquisitionChannel = normalizedLegacySource(
    input.acquisitionChannel,
  );
  const source = normalizedLegacySource(input.source);
  if (
    acquisitionChannel === "META" ||
    source === "FACEBOOK" ||
    source === "META" ||
    source === "META_LEAD_ADS"
  ) {
    return { intentLevel: "AD_RESPONSE", sourceKey: "meta_lead_ads" };
  }
  if (
    acquisitionChannel === "WEBSITE" ||
    source === "WEBSITE" ||
    source === "CONTACT_FORM"
  ) {
    return { intentLevel: "INBOUND", sourceKey: "website" };
  }
  if (
    acquisitionChannel === "GOOGLE_PROSPECTING" ||
    source === "GOOGLE_PROSPECTING" ||
    source === "GOOGLE_MAPS"
  ) {
    return { intentLevel: "OUTBOUND", sourceKey: "google_maps" };
  }
  return null;
}

interface LegacyAgreementStageEvidence {
  status: string;
  paidAt?: Date | null;
  paymentStatus?: string | null;
}

/**
 * Inverse of mapLegacyLeadSource for display: the legacy admin UI keys its
 * badges on the OLD ContactSubmission.source values, so list responses must
 * hand back those, not the canonical sourceKey.
 */
export function legacySourceForSourceKey(sourceKey: string | null): string | null {
  switch (sourceKey) {
    case "meta_lead_ads":
      return "FACEBOOK";
    case "google_maps":
      return "GOOGLE_PROSPECTING";
    case "website":
      return "WEBSITE";
    default:
      return sourceKey;
  }
}

export interface LegacyLeadStageInput {
  paidAt?: Date | null;
  paymentStatus?: string | null;
  status: ContactStatus | string;
  agreements?: readonly LegacyAgreementStageEvidence[];
  prospectStatus?: string | null;
  prospectInteractionCount?: number;
  latestProspectOutcome?: ProspectCallOutcome | string | null;
}

const agreementStagePriority: Readonly<Record<string, LeadStage>> = {
  DRAFT: "AGREEMENT_DRAFT",
  SENT: "AGREEMENT_SENT",
  SIGNED: "AGREEMENT_SIGNED",
};

const agreementStageRank: Readonly<Partial<Record<LeadStage, number>>> = {
  AGREEMENT_DRAFT: 1,
  AGREEMENT_SENT: 2,
  AGREEMENT_SIGNED: 3,
};

function hasVerifiedPayment(input: LegacyLeadStageInput): boolean {
  if (input.paidAt) return true;
  return Boolean(
    input.agreements?.some(
      (agreement) =>
        agreement.paidAt !== null &&
        agreement.paidAt !== undefined &&
        agreement.paymentStatus === "COMPLETED",
    ),
  );
}

/**
 * Applies the migration-safe priority order. `null` means the database row
 * needs an explicit reviewed resolution; it never means "default to NEW".
 */
export function deriveLegacyLeadStage(
  input: LegacyLeadStageInput,
): LeadStage | null {
  if (hasVerifiedPayment(input)) return "WON";

  let agreementStage: LeadStage | null = null;
  for (const agreement of input.agreements ?? []) {
    const candidate = agreementStagePriority[agreement.status];
    if (
      candidate &&
      (agreementStage === null ||
        (agreementStageRank[candidate] ?? 0) >
          (agreementStageRank[agreementStage] ?? 0))
    ) {
      agreementStage = candidate;
    }
  }
  if (agreementStage) return agreementStage;

  if (input.latestProspectOutcome === "INTERESTED") return "QUALIFIED";
  if (
    input.latestProspectOutcome === "NOT_INTERESTED" ||
    input.latestProspectOutcome === "DO_NOT_CALL" ||
    input.latestProspectOutcome === "WRONG_NUMBER"
  ) {
    return "LOST";
  }
  if (input.prospectStatus === "QUALIFIED") return "QUALIFIED";
  if (
    input.prospectStatus === "NOT_INTERESTED" ||
    input.prospectStatus === "DO_NOT_CALL"
  ) {
    return "LOST";
  }
  if (
    input.prospectStatus === "FOLLOW_UP" ||
    (input.prospectInteractionCount ?? 0) > 0
  ) {
    return "CONTACTING";
  }

  switch (input.status) {
    case "NEW":
      return "NEW";
    case "IN_PROGRESS":
      return "CONTACTING";
    case "LOST":
      return "LOST";
    case "SPAM":
      return "SPAM";
    case "CLOSED":
    default:
      return null;
  }
}

export interface LegacyProspectInteractionInput {
  id: string;
  outcome: ProspectCallOutcome | string;
  note: string | null;
  nextFollowUpAt: Date | null;
  createdAt: Date;
}

export interface LegacyProspectInteractionMapping {
  legacyProspectInteractionId: string;
  channel: LeadInteractionChannel;
  outcome: LeadInteractionOutcome;
  decisionMakerReached: boolean;
  note: string | null;
  nextFollowUpAt: Date | null;
  lossReason: LeadLossReason | null;
  lossReasonDetails: string | null;
  usedCallAngleIds: string[];
  occurredAt: Date;
}

const prospectOutcomeMapping: Readonly<
  Record<
    ProspectCallOutcome,
    Pick<
      LegacyProspectInteractionMapping,
      "outcome" | "decisionMakerReached" | "lossReason"
    >
  >
> = {
  NO_ANSWER: {
    outcome: "NO_ANSWER",
    decisionMakerReached: false,
    lossReason: null,
  },
  CALLBACK: {
    outcome: "CALLBACK",
    decisionMakerReached: false,
    lossReason: null,
  },
  CONNECTED: {
    outcome: "NON_DECISION_MAKER",
    decisionMakerReached: false,
    lossReason: null,
  },
  INTERESTED: {
    outcome: "INTERESTED",
    decisionMakerReached: true,
    lossReason: null,
  },
  NOT_INTERESTED: {
    outcome: "NOT_INTERESTED",
    decisionMakerReached: true,
    lossReason: "NO_INTEREST",
  },
  DO_NOT_CALL: {
    outcome: "DO_NOT_CALL",
    decisionMakerReached: false,
    lossReason: "DO_NOT_CONTACT",
  },
  WRONG_NUMBER: {
    outcome: "WRONG_NUMBER",
    decisionMakerReached: false,
    lossReason: "BAD_CONTACT",
  },
};

export function mapLegacyProspectInteraction(
  input: LegacyProspectInteractionInput,
): LegacyProspectInteractionMapping {
  const mapped =
    prospectOutcomeMapping[input.outcome as ProspectCallOutcome] ??
    prospectOutcomeMapping.CONNECTED;
  return {
    legacyProspectInteractionId: input.id,
    channel: "PHONE",
    outcome: mapped.outcome,
    decisionMakerReached: mapped.decisionMakerReached,
    note: input.note?.trim() || null,
    nextFollowUpAt: input.nextFollowUpAt,
    lossReason: mapped.lossReason,
    lossReasonDetails: null,
    usedCallAngleIds: [],
    occurredAt: input.createdAt,
  };
}
