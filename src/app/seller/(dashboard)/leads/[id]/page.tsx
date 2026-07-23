import { notFound, redirect } from "next/navigation";

import LeadWorkspace from "@/components/leads/LeadWorkspace";
import { auth } from "@/lib/auth";
import { getLeadLifecycleConfig } from "@/lib/leads/config";
import { getLeadIntentForSeller } from "@/lib/leads/projection";

export default async function SellerLeadPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  let intentLevel: Awaited<ReturnType<typeof getLeadIntentForSeller>>;
  try {
    intentLevel = await getLeadIntentForSeller(id, session.user.id);
  } catch {
    notFound();
  }

  const config = getLeadLifecycleConfig();
  if (!config.enabled) {
    redirect(
      intentLevel === "OUTBOUND"
        ? `/seller/cold-leads?focus=${encodeURIComponent(id)}`
        : `/seller/leads?focus=${encodeURIComponent(id)}`,
    );
  }
  if (intentLevel === "OUTBOUND" && !config.coldPreparationEnabled) {
    redirect(`/seller/cold-leads?focus=${encodeURIComponent(id)}`);
  }

  return <LeadWorkspace leadId={id} audience="seller" initialTab={tab} />;
}
