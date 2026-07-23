import type { ContactSubmission } from "@prisma/client";

import {
  mapLeadFieldsToContact,
  type LeadDetail,
} from "@/lib/facebook";

import { resolveEligibleSellerId } from "./assignment";
import { createLeadFromSource } from "./lifecycle";
import { metaNonContactAnswers } from "./source";

export type MetaIngestionMode = "WEBHOOK" | "MANUAL_SYNC" | "CRON_SYNC";

export interface MetaCaptureTiming {
  occurredAt: Date;
  captureMode: "LIVE" | "HISTORICAL_SYNC";
  forcedReviewReason?: "META_SOURCE_TIME_INVALID";
}

export function resolveMetaLeadCaptureTiming(
  createdTime: string | null | undefined,
  mode: MetaIngestionMode,
  now = new Date(),
): MetaCaptureTiming {
  const occurredAt = createdTime ? new Date(createdTime) : null;
  if (!occurredAt || Number.isNaN(occurredAt.getTime())) {
    return {
      occurredAt: now,
      captureMode: "HISTORICAL_SYNC",
      forcedReviewReason: "META_SOURCE_TIME_INVALID",
    };
  }
  if (occurredAt.getTime() > now.getTime() + 5 * 60_000) {
    return {
      occurredAt: now,
      captureMode: "HISTORICAL_SYNC",
      forcedReviewReason: "META_SOURCE_TIME_INVALID",
    };
  }
  if (mode === "MANUAL_SYNC") {
    return { occurredAt, captureMode: "HISTORICAL_SYNC" };
  }
  if (mode === "CRON_SYNC") {
    const ageMs = now.getTime() - occurredAt.getTime();
    return {
      occurredAt,
      captureMode:
        ageMs >= 0 && ageMs <= 30 * 60_000 ? "LIVE" : "HISTORICAL_SYNC",
    };
  }
  return { occurredAt, captureMode: "LIVE" };
}

export async function ingestMetaLead(
  lead: LeadDetail,
  options: {
    mode: MetaIngestionMode;
    eligibleSellerId?: string | null;
    accountId?: string;
    now?: Date;
  },
  dependencies: {
    createLead?: typeof createLeadFromSource;
    resolveSeller?: typeof resolveEligibleSellerId;
  } = {},
): Promise<ContactSubmission> {
  const now = options.now ?? new Date();
  const timing = resolveMetaLeadCaptureTiming(
    lead.created_time,
    options.mode,
    now,
  );
  const eligibleSellerId =
    options.eligibleSellerId === undefined
      ? await (dependencies.resolveSeller ?? resolveEligibleSellerId)()
      : options.eligibleSellerId;
  const mapped = mapLeadFieldsToContact(lead);
  const create = dependencies.createLead ?? createLeadFromSource;

  return create({
    intentLevel: "AD_RESPONSE",
    sourceKey: "meta_lead_ads",
    externalLeadId: lead.id,
    sourceSnapshot: {
      ...(options.accountId ? { accountId: options.accountId } : {}),
      ...(lead.campaign_id ? { campaignId: lead.campaign_id } : {}),
      ...(lead.campaign_name ? { campaignName: lead.campaign_name } : {}),
      ...(lead.ad_id ? { adId: lead.ad_id } : {}),
      ...(lead.form_id ? { formId: lead.form_id } : {}),
      ...(lead.form_name ? { formName: lead.form_name } : {}),
      externalLeadId: lead.id,
      nonContactAnswers: metaNonContactAnswers(lead.field_data),
      receivedAt: timing.occurredAt.toISOString(),
    },
    occurredAt: timing.occurredAt,
    captureMode: timing.captureMode,
    forcedReviewReason: timing.forcedReviewReason,
    eligibleSellerId,
    name: mapped.name || undefined,
    company: mapped.company ?? undefined,
    email: mapped.email || undefined,
    phone: mapped.phone ?? undefined,
    message: mapped.message || undefined,
  });
}
