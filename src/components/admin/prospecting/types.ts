export interface TerritoryProposalView {
  id: string;
  cycleId: string;
  displayName: string;
  city: string;
  kind: "STREET" | "COMMERCIAL_CENTER" | "AREA";
  searchQuery: string;
  rationale: string;
  expectedBusinessTypes: string[];
  confidence: number;
  status: "PROPOSED" | "APPROVED" | "REJECTED" | "INVALID";
  rejectionReason: string | null;
  createdAt: string;
}

export interface ProspectAuditView {
  websiteStatus: string;
  qualityScore: number | null;
  rawScore: number | null;
  availabilityScore: number | null;
  performanceScore: number | null;
  seoScore: number | null;
  maintenanceScore: number | null;
  visualScore: number | null;
  commercialScore: number | null;
  confidence: number | null;
  auditedAt: string;
}

export interface ProspectView {
  id: string;
  placeId: string;
  status: string;
  websiteStatus: string;
  auditedDomain: string | null;
  businessShape: string | null;
  qualityScore: number | null;
  rawQualityScore: number | null;
  auditConfidence: number | null;
  opportunitySummary: string | null;
  callAngles: string[];
  createdAt: string;
  audits: ProspectAuditView[];
  live?: {
    displayName: string;
    nationalPhoneNumber: string | null;
    formattedAddress: string | null;
    websiteUri: string | null;
    businessStatus: string | null;
  } | null;
}

export interface ProspectingCycleView {
  id: string;
  weekStart: string;
  revision: number;
  status: string;
  targetCount: number;
  placesSearchCalls: number;
  placesDetailCalls: number;
  pageSpeedCalls: number;
  aiCalls: number;
  estimatedCostUsd: number;
  lastError: string | null;
  createdAt: string;
  publishedAt: string | null;
  supersededAt: string | null;
  supersededReason: string | null;
  proposals: TerritoryProposalView[];
  prospects?: ProspectView[];
  prospectCounts?: Record<string, number>;
  scoreCounts?: Record<string, number>;
  batch: {
    id: string;
    publishedAt: string;
    supersededAt: string | null;
    supersededReason: string | null;
  } | null;
}
