export interface SellerColdLead {
  id: string;
  status: string;
  websiteStatus: string;
  auditedDomain: string | null;
  qualityScore: number | null;
  rawQualityScore: number | null;
  auditConfidence: number | null;
  opportunitySummary: string | null;
  callAngles: string[];
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
  interactions: Array<{
    id: string;
    outcome: string;
    note: string | null;
    nextFollowUpAt: string | null;
    createdAt: string;
  }>;
}
