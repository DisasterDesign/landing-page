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
  live: {
    displayName: string;
    phone: string | null;
    address: string | null;
    website: string | null;
    businessStatus: string | null;
  } | null;
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
