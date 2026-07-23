export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";
import {
  getFormLeads,
  type LeadDetail,
} from "@/lib/facebook";
import { resolveEligibleSellerId } from "@/lib/leads/assignment";
import { ingestMetaLead } from "@/lib/leads/meta-ingestion";

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
    const eligibleSellerId = await resolveEligibleSellerId();

    for (const lead of leads) {
      try {
        const existingPair = await prisma.contactSubmission.findUnique({
          where: {
            sourceKey_externalLeadId: {
              sourceKey: "meta_lead_ads",
              externalLeadId: lead.id,
            },
          },
          select: { id: true },
        });
        const existing =
          existingPair ??
          (await prisma.contactSubmission.findFirst({
            where: {
              externalLeadId: lead.id,
              sourceKey: null,
            },
            select: { id: true },
          }));
        await ingestMetaLead(lead, {
          mode: "MANUAL_SYNC",
          eligibleSellerId,
        });
        if (existing) updated++;
        else created++;
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
