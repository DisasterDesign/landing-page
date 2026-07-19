export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";
import {
  getFormLeads,
  mapLeadFieldsToContact,
  type LeadDetail,
} from "@/lib/facebook";
export const maxDuration = 300;

interface IntegrationResult {
  pageId: string;
  pageName: string;
  total: number;
  created: number;
  updated: number;
  skipped: number;
  error?: string;
}

export async function GET(req: NextRequest) {
  // Vercel cron sends a special header. Also accept a CRON_SECRET bearer for
  // manual triggers from the local CLI.
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formId =
    process.env.FACEBOOK_LEAD_FORM_ID || "1505628047948105";

  const integrations = await prisma.facebookIntegration.findMany({
    select: { pageId: true, pageName: true, pageAccessToken: true },
  });

  const perIntegration: IntegrationResult[] = [];
  let totalLeads = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;

  for (const integ of integrations) {
    const result: IntegrationResult = {
      pageId: integ.pageId,
      pageName: integ.pageName,
      total: 0,
      created: 0,
      updated: 0,
      skipped: 0,
    };

    try {
      const pageAccessToken = decrypt(integ.pageAccessToken);
      const leads: LeadDetail[] = await getFormLeads(formId, pageAccessToken);
      result.total = leads.length;

      for (const lead of leads) {
        try {
          const mapped = mapLeadFieldsToContact(lead);

          const existing = await prisma.contactSubmission.findUnique({
            where: { externalLeadId: lead.id },
            select: { id: true },
          });

          if (existing) {
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
            result.updated++;
          } else {
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
            result.created++;
          }
        } catch (err) {
          console.error(
            `cron facebook-sync: failed lead ${lead.id} on page ${integ.pageId}:`,
            err
          );
          result.skipped++;
        }
      }
    } catch (err) {
      result.error = err instanceof Error ? err.message : String(err);
      console.error(
        `cron facebook-sync: page ${integ.pageId} (${integ.pageName}) failed:`,
        err
      );
    }

    perIntegration.push(result);
    totalLeads += result.total;
    totalCreated += result.created;
    totalUpdated += result.updated;
    totalSkipped += result.skipped;
  }

  return NextResponse.json({
    ok: true,
    formId,
    integrations: integrations.length,
    total: totalLeads,
    created: totalCreated,
    updated: totalUpdated,
    skipped: totalSkipped,
    perIntegration,
  });
}
