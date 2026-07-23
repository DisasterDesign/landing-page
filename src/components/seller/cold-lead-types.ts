export type SellerLeadInteractionOutcome =
  | "NO_ANSWER"
  | "CALLBACK"
  | "NON_DECISION_MAKER"
  | "INTERESTED"
  | "NOT_INTERESTED"
  | "WRONG_NUMBER"
  | "DO_NOT_CALL";

export type SellerLeadLossReason =
  | "NO_INTEREST"
  | "NO_BUDGET"
  | "BAD_TIMING"
  | "EXISTING_PROVIDER"
  | "DECISION_MAKER_UNREACHABLE"
  | "NOT_FIT"
  | "BAD_CONTACT"
  | "DUPLICATE"
  | "BATCH_SUPERSEDED"
  | "DO_NOT_CONTACT"
  | "OTHER";

export interface SellerLeadInteractionInput {
  channel: "PHONE";
  outcome: SellerLeadInteractionOutcome;
  decisionMakerReached: boolean;
  note?: string;
  followUpAction?: "SCHEDULE" | "END_AS_LOST";
  followUpAt?: string;
  lossReason?: SellerLeadLossReason;
  lossReasonDetails?: string;
  usedCallAngleIds: string[];
}

export interface SellerCompanyNote {
  id: string;
  body: string;
  createdAt: string;
  author?: { id: string; name: string };
}

export interface SellerColdLead {
  id: string;
  leadId?: string;
  status: string;
  websiteStatus: string;
  auditedDomain: string | null;
  qualityScore: number | null;
  rawQualityScore: number | null;
  auditConfidence: number | null;
  opportunitySummary: string | null;
  callAngles: string[];
  callAngleIds?: string[];
  nextFollowUpAt: string | null;
  lastContactedAt: string | null;
  liveStatus: "READY" | "UNAVAILABLE" | "NO_PHONE";
  business: {
    displayName: string;
    phone: string | null;
    address: string | null;
    website: string | null;
    websiteSource: "GOOGLE" | "AUDITED_DOMAIN" | "NONE";
    mapUrl: string;
    category: string | null;
    rating: number | null;
    reviewCount: number | null;
    weekdayDescriptions: string[];
    businessStatus: string | null;
  };
  salesFit: {
    classification: string | null;
    confidence: number | null;
    ownerReachabilityScore: number | null;
    reason: string | null;
    evidence: string[];
  };
  scoreBreakdown: {
    availability: number | null;
    performance: number | null;
    seo: number | null;
    maintenance: number | null;
    visual: number | null;
    commercial: number | null;
  } | null;
  companyNotesCount: number;
  canManageCompanyNotes: boolean;
  interactions: Array<{
    id: string;
    outcome: string;
    note: string | null;
    nextFollowUpAt: string | null;
    createdAt: string;
  }>;
}
