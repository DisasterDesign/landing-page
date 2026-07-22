export interface ProspectingConfig {
  enabled: boolean;
  weeklyTarget: number;
  maxDiscoveredPerCycle: number;
  maxPlacesCallsPerCycle: number;
  maxAiCallsPerCycle: number;
  maxEstimatedCostUsd: number;
  placesApiKey: string;
  pageSpeedApiKey: string;
  aiApiKey: string;
  aiModel: string;
  hashSecret: string;
}

const DEFAULTS = Object.freeze({
  weeklyTarget: 50,
  maxDiscoveredPerCycle: 250,
  maxPlacesCallsPerCycle: 400,
  maxAiCallsPerCycle: 250,
  maxEstimatedCostUsd: 25,
});

function positiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function positiveNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getProspectingConfig(
  env: Record<string, string | undefined> = process.env,
): ProspectingConfig {
  const enabled = env.PROSPECTING_ENABLED === "true";
  const credentials = {
    aiApiKey: env.PROSPECTING_AI_API_KEY?.trim() ?? "",
    aiModel: env.PROSPECTING_AI_MODEL?.trim() ?? "",
    placesApiKey: env.PROSPECTING_GOOGLE_PLACES_API_KEY?.trim() ?? "",
    pageSpeedApiKey: env.PROSPECTING_PAGESPEED_API_KEY?.trim() ?? "",
    hashSecret: env.PROSPECTING_HASH_SECRET?.trim() ?? "",
  };

  if (enabled) {
    const required = [
      ["PROSPECTING_AI_API_KEY", credentials.aiApiKey],
      ["PROSPECTING_AI_MODEL", credentials.aiModel],
      ["PROSPECTING_GOOGLE_PLACES_API_KEY", credentials.placesApiKey],
      ["PROSPECTING_PAGESPEED_API_KEY", credentials.pageSpeedApiKey],
      ["PROSPECTING_HASH_SECRET", credentials.hashSecret],
    ] as const;
    const missing = required.filter(([, value]) => !value).map(([name]) => name);

    if (missing.length > 0) {
      throw new Error(`Missing prospecting configuration: ${missing.join(", ")}`);
    }
  }

  return {
    enabled,
    weeklyTarget: Math.min(
      positiveInteger(env.PROSPECTING_WEEKLY_TARGET, DEFAULTS.weeklyTarget),
      DEFAULTS.weeklyTarget,
    ),
    maxDiscoveredPerCycle: positiveInteger(
      env.PROSPECTING_MAX_DISCOVERED_PER_CYCLE,
      DEFAULTS.maxDiscoveredPerCycle,
    ),
    maxPlacesCallsPerCycle: positiveInteger(
      env.PROSPECTING_MAX_PLACES_CALLS_PER_CYCLE,
      DEFAULTS.maxPlacesCallsPerCycle,
    ),
    maxAiCallsPerCycle: positiveInteger(
      env.PROSPECTING_MAX_AI_CALLS_PER_CYCLE,
      DEFAULTS.maxAiCallsPerCycle,
    ),
    maxEstimatedCostUsd: positiveNumber(
      env.PROSPECTING_MAX_ESTIMATED_COST_USD,
      DEFAULTS.maxEstimatedCostUsd,
    ),
    ...credentials,
  };
}

export function isProspectingEnabled(): boolean {
  return getProspectingConfig().enabled;
}
