import { notFound, redirect } from "next/navigation";

import LeadCorrectionControls from "@/components/admin/leads/LeadCorrectionControls";
import LeadMigrationReviewControls from "@/components/admin/leads/LeadMigrationReviewControls";
import LeadOwnershipControls from "@/components/admin/leads/LeadOwnershipControls";
import LeadWorkspace from "@/components/leads/LeadWorkspace";
import { auth } from "@/lib/auth";
import { getLeadLifecycleConfig } from "@/lib/leads/config";
import { getAdminLeadDetail } from "@/lib/leads/projection";
import { prisma } from "@/lib/prisma";

export default async function AdminLeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/admin/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (user?.role !== "ADMIN") notFound();

  if (!getLeadLifecycleConfig().enabled) {
    redirect(`/admin/leads?focus=${encodeURIComponent(id)}`);
  }

  let lead: Awaited<ReturnType<typeof getAdminLeadDetail>>;
  try {
    lead = await getAdminLeadDetail(id);
  } catch {
    notFound();
  }

  return (
    <div dir="rtl" className="space-y-4">
      {lead.migrationReviewRequired ? (
        <LeadMigrationReviewControls lead={lead} />
      ) : (
        <>
          <LeadOwnershipControls lead={lead} />
          <LeadCorrectionControls lead={lead} />
        </>
      )}
      <LeadWorkspace leadId={id} audience="admin" initialLead={lead} />
    </div>
  );
}
