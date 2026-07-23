import LegacyIncomingLeadsPage from "@/components/seller/leads/LegacyIncomingLeadsPage";
import UnifiedIncomingLeadsPage from "@/components/seller/leads/UnifiedIncomingLeadsPage";
import { getLeadLifecycleConfig } from "@/lib/leads/config";

export default function SellerLeadsPage() {
  return getLeadLifecycleConfig().enabled ? (
    <UnifiedIncomingLeadsPage />
  ) : (
    <LegacyIncomingLeadsPage />
  );
}
