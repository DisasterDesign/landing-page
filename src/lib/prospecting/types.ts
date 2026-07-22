export type WebsiteStatus =
  | "NO_WEBSITE"
  | "SOCIAL_ONLY"
  | "PARKED"
  | "UNREACHABLE"
  | "ACTIVE"
  | "BLOCKED"
  | "UNKNOWN";

export type BusinessShape = "SERVICE" | "RETAIL" | "ECOMMERCE" | "UNKNOWN";

export interface WebsiteScoreDimensions {
  availabilityScore: number;
  performanceScore: number;
  seoScore: number;
  maintenanceScore: number;
  visualScore: number;
  commercialScore: number;
}

export interface WebsiteScoreResult extends WebsiteScoreDimensions {
  scoringVersion: 1;
  rawScore: number;
  qualityScore: 0 | 1 | 2 | 3 | 4 | 5;
}

export interface TerritoryProposalOutput {
  displayName: string;
  city: string;
  kind: "STREET" | "COMMERCIAL_CENTER" | "AREA";
  searchQuery: string;
  rationale: string;
  expectedBusinessTypes: string[];
  confidence: number;
}

export interface VisualAssessment {
  visualScore: number;
  confidence: number;
  findings: Array<{
    code: "HIERARCHY" | "READABILITY" | "NAVIGATION" | "BRAND" | "TRUST" | "CTA";
    severity: "low" | "medium" | "high";
    evidence: string;
  }>;
  callAngles: [string, string, string];
}

export interface DiscoveredPlace {
  placeId: string;
  websiteUri?: string;
}

export interface LivePlaceDetails {
  placeId: string;
  displayName: string;
  nationalPhoneNumber: string | null;
  formattedAddress: string | null;
  websiteUri: string | null;
  businessStatus: string | null;
}

export interface TerritorySearchInput {
  query: string;
  pageToken?: string;
}

export interface PlacesProspectingProvider {
  discover(input: TerritorySearchInput): Promise<DiscoveredPlace[]>;
  getLiveDetails(placeIds: string[]): Promise<Map<string, LivePlaceDetails>>;
}
