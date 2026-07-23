import type { LeadIntentLevel } from "@prisma/client";

import { getLeadLifecycleConfig, type LeadLifecycleConfig } from "./config";

export function leadActionUrlFor(input: {
  audience: "ADMIN" | "SELLER";
  lead: { id: string; intentLevel: LeadIntentLevel | null };
  config?: LeadLifecycleConfig;
}): string {
  const config = input.config ?? getLeadLifecycleConfig();
  if (input.audience === "ADMIN") {
    return config.enabled
      ? `/admin/leads/${input.lead.id}`
      : `/admin/leads?focus=${input.lead.id}`;
  }
  const unifiedDetailEnabled =
    config.enabled &&
    (input.lead.intentLevel !== "OUTBOUND" ||
      config.coldPreparationEnabled);
  if (unifiedDetailEnabled) return `/seller/leads/${input.lead.id}`;
  return input.lead.intentLevel === "OUTBOUND"
    ? `/seller/cold-leads?focus=${input.lead.id}`
    : `/seller/leads?focus=${input.lead.id}`;
}

export function sellerLeadActionUrl(
  lead: { id: string; intentLevel: LeadIntentLevel | null },
  config?: LeadLifecycleConfig,
): string {
  return leadActionUrlFor({ audience: "SELLER", lead, config });
}
