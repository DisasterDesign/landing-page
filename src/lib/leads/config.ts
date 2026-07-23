export interface LeadLifecycleConfig {
  enabled: boolean;
  coldPreparationEnabled: boolean;
}

export function getLeadLifecycleConfig(
  env: Record<string, string | undefined> = process.env,
): LeadLifecycleConfig {
  return {
    enabled: env.UNIFIED_LEAD_LIFECYCLE_ENABLED === "true",
    coldPreparationEnabled: env.COLD_LEAD_PREPARATION_ENABLED === "true",
  };
}
