import type {
  WebsiteScoreDimensions,
  WebsiteScoreResult,
  WebsiteStatus,
} from "./types";

interface WebsiteScoreInput {
  websiteStatus: WebsiteStatus;
  dimensions?: WebsiteScoreDimensions;
}

const DIMENSION_LIMITS = Object.freeze({
  availabilityScore: 20,
  performanceScore: 20,
  seoScore: 20,
  maintenanceScore: 15,
  visualScore: 15,
  commercialScore: 10,
} satisfies Record<keyof WebsiteScoreDimensions, number>);

const ZERO_DIMENSIONS: WebsiteScoreDimensions = Object.freeze({
  availabilityScore: 0,
  performanceScore: 0,
  seoScore: 0,
  maintenanceScore: 0,
  visualScore: 0,
  commercialScore: 0,
});

const HARD_ZERO_STATUSES = new Set<WebsiteStatus>([
  "NO_WEBSITE",
  "SOCIAL_ONLY",
  "PARKED",
  "UNREACHABLE",
]);

function qualityBand(rawScore: number): WebsiteScoreResult["qualityScore"] {
  if (rawScore < 20) return 0;
  if (rawScore < 40) return 1;
  if (rawScore < 55) return 2;
  if (rawScore < 70) return 3;
  if (rawScore < 85) return 4;
  return 5;
}

function validateDimensions(dimensions: WebsiteScoreDimensions): void {
  for (const [key, maximum] of Object.entries(DIMENSION_LIMITS) as Array<
    [keyof WebsiteScoreDimensions, number]
  >) {
    const value = dimensions[key];
    if (!Number.isInteger(value) || value < 0 || value > maximum) {
      throw new RangeError(`${key} must be an integer between 0 and ${maximum}`);
    }
  }
}

export function calculateWebsiteScore(input: WebsiteScoreInput): WebsiteScoreResult {
  if (input.websiteStatus === "BLOCKED" || input.websiteStatus === "UNKNOWN") {
    throw new Error(`${input.websiteStatus} websites cannot be scored automatically`);
  }

  const dimensions = HARD_ZERO_STATUSES.has(input.websiteStatus)
    ? ZERO_DIMENSIONS
    : input.dimensions;

  if (!dimensions) {
    throw new Error("ACTIVE websites require a complete score breakdown");
  }

  validateDimensions(dimensions);
  const rawScore = Object.values(dimensions).reduce((sum, value) => sum + value, 0);

  return Object.freeze({
    scoringVersion: 1,
    ...dimensions,
    rawScore,
    qualityScore: qualityBand(rawScore),
  });
}
