import LegacyColdLeadsPage from "@/components/seller/leads/LegacyColdLeadsPage";
import UnifiedColdLeadsPage from "@/components/seller/leads/UnifiedColdLeadsPage";
import { getLeadLifecycleConfig } from "@/lib/leads/config";

export default function SellerColdLeadsPage() {
  const config = getLeadLifecycleConfig();
  return config.enabled && config.coldPreparationEnabled ? (
    <UnifiedColdLeadsPage />
  ) : (
    <LegacyColdLeadsPage />
  );
}
