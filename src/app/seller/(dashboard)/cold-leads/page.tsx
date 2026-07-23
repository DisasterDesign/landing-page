import { redirect } from "next/navigation";

import LegacyColdLeadsPage from "@/components/seller/leads/LegacyColdLeadsPage";
import { getLeadLifecycleConfig } from "@/lib/leads/config";

/**
 * The seller has ONE leads queue (/seller/leads) with all three temperatures
 * — a separate cold page split the same person's worklist in two. This route
 * survives only as a redirect for old links, and as the legacy fallback while
 * the unified flags are off.
 */
export default function SellerColdLeadsPage() {
  const config = getLeadLifecycleConfig();
  if (config.enabled && config.coldPreparationEnabled) {
    redirect("/seller/leads");
  }
  return <LegacyColdLeadsPage />;
}
