export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";
import {
  getFormLeads,
  mapLeadFieldsToContact,
  type LeadDetail,
} from "@/lib/facebook";

/**
 * POST /api/integrations/facebook/sync
 *
 * Pull all historical leads from the configured Facebook form and upsert them
 * into ContactSubmission. Skips leads that already exist (by externalLeadId).
 *
 * Body (optional): { formId?: string }
 * If formId is omitted the default FACEBOOK_LEAD_FORM_ID is used.
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Determine which form to pull from
    let formId: string | undefined;
    try {
      const body = await req.json();
      formId = body?.formId;
    } catch {
      // empty body is fine — use default
    }
    formId = formId || process.env.FACEBOOK_LEAD_FORM_ID || "1505628047948105";

    // Find active integration (we need the page access token)
    const integration = await prisma.facebookIntegration.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    if (!integration) {
      return NextResponse.json(
        { error: "No Facebook integration found. Connect a Page first." },
        { status: 400 }
      );
    }

    const pageAccessToken = decrypt(integration.pageAccessToken);

    // Fetch all leads from the form
    const leads: LeadDetail[] = await getFormLeads(formId, pageAccessToken);

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const lead of leads) {
      try {
        const mapped = mapLeadFieldsToContact(lead);

        // Check if this lead already exists
        const existing = await prisma.contactSubmission.findUnique({
          where: { externalLeadId: lead.id },
          select: { id: true },
        });

        if (existing) {
          // Update existing record (refresh data but keep status/notes)
          await prisma.contactSubmission.update({
            where: { externalLeadId: lead.id },
            data: {
              name: mapped.name,
              email: mapped.email,
              phone: mapped.phone,
              company: mapped.company,
              message: mapped.message,
              externalFormId: lead.form_id ?? null,
              externalFormName: lead.form_name ?? null,
              externalCampaignId: lead.campaign_id ?? null,
              externalAdId: lead.ad_id ?? null,
            },
          });
          updated++;
        } else {
          // Create new record
          await prisma.contactSubmission.create({
            data: {
              name: mapped.name,
              email: mapped.email,
              phone: mapped.phone,
              company: mapped.company,
              message: mapped.message,
              source: "FACEBOOK",
              externalLeadId: lead.id,
              externalFormId: lead.form_id ?? null,
              externalFormName: lead.form_name ?? null,
              externalCampaignId: lead.campaign_id ?? null,
              externalAdId: lead.ad_id ?? null,
              createdAt: lead.created_time
                ? new Date(lead.created_time)
                : undefined,
            },
          });
          created++;
        }
      } catch (err) {
        console.error(`FB sync: failed to process lead ${lead.id}:`, err);
        skipped++;
      }
    }

    return NextResponse.json({
      ok: true,
      formId,
      total: leads.length,
      created,
      updated,
      skipped,
    });
  } catch (error) {
    console.error("Facebook sync error:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
