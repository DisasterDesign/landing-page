import LegacyAdminLeadsPage from "@/components/admin/leads/LegacyAdminLeadsPage";
import UnifiedAdminLeadsPage from "@/components/admin/leads/UnifiedAdminLeadsPage";
import { getLeadLifecycleConfig } from "@/lib/leads/config";

export default function AdminLeadsPage() {
  return getLeadLifecycleConfig().enabled ? (
    <UnifiedAdminLeadsPage />
  ) : (
    <LegacyAdminLeadsPage />
  );
}
