import type { LeadIntentLevel } from "@prisma/client";
import { z } from "zod";

import { LeadDomainError } from "./errors";

export const sourceIntent = {
  google_maps: "OUTBOUND",
  meta_lead_ads: "AD_RESPONSE",
  website: "INBOUND",
  google_search_ads: "INBOUND",
  manual_outbound: "OUTBOUND",
  direct_contact: "INBOUND",
} as const satisfies Record<string, LeadIntentLevel>;

export type LeadSourceKey = keyof typeof sourceIntent;

export function intentForSource(sourceKey: LeadSourceKey): LeadIntentLevel {
  return sourceIntent[sourceKey];
}

const boundedOptionalString = z.string().trim().min(1).max(500).optional();
const boundedOptionalId = z.string().trim().min(1).max(300).optional();
const receivedAt = z.string().datetime({ offset: true });

const callAngleSchema = z
  .object({
    id: z.string().trim().min(1).max(100),
    text: z.string().trim().min(1).max(1_000),
    version: z.number().int().min(1),
  })
  .strict();

const googleMapsSnapshotSchema = z
  .object({
    territory: z.string().trim().min(1).max(300),
    cycleId: z.string().trim().min(1).max(200),
    batchId: z.string().trim().min(1).max(200),
    weekStart: receivedAt,
    placeId: z.string().trim().min(1).max(300),
    websiteStatus: z.enum([
      "NO_WEBSITE",
      "SOCIAL_ONLY",
      "PARKED",
      "UNREACHABLE",
      "ACTIVE",
      "BLOCKED",
      "UNKNOWN",
    ]),
    auditedDomain: z
      .union([
        z
          .string()
          .trim()
          .min(1)
          .max(253)
          .transform((value) =>
            value
              .toLowerCase()
              .replace(/^https?:\/\//, "")
              .replace(/^www\./, "")
              .split(/[/?#]/, 1)[0],
          ),
        z.null(),
      ]),
    internalBusinessCategory: z.enum(["UNKNOWN", "SERVICE", "RETAIL", "ECOMMERCE"]),
    internalBusinessCategoryVersion: z.number().int().min(1),
    qualityScore: z.number().int().min(0).max(4),
    scoringVersion: z.number().int().min(1),
    opportunitySummary: z.string().trim().min(1).max(2_000),
    callAngles: z.array(callAngleSchema).max(3),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.auditedDomain === null && value.websiteStatus === "ACTIVE") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["auditedDomain"],
        message: "An active website requires an audited domain",
      });
    }
  });

const metaLeadAdsSnapshotSchema = z
  .object({
    accountId: boundedOptionalId,
    campaignId: boundedOptionalId,
    campaignName: boundedOptionalString,
    adSetId: boundedOptionalId,
    adSetName: boundedOptionalString,
    adId: boundedOptionalId,
    adName: boundedOptionalString,
    formId: boundedOptionalId,
    formName: boundedOptionalString,
    externalLeadId: z.string().trim().min(1).max(300),
    nonContactAnswers: z
      .array(
        z
          .object({
            name: z.string().trim().min(1).max(300),
            values: z.array(z.string().max(1_000)).max(20),
          })
          .strict(),
      )
      .max(100),
    receivedAt,
  })
  .strict();

const websiteSnapshotSchema = z
  .object({
    landingPage: z.string().trim().startsWith("/").max(2_000),
    service: boundedOptionalString,
    referrer: z.string().url().max(2_000).optional(),
    utmSource: boundedOptionalString,
    utmMedium: boundedOptionalString,
    utmCampaign: boundedOptionalString,
    utmContent: boundedOptionalString,
    utmTerm: boundedOptionalString,
    receivedAt: receivedAt.optional(),
  })
  .strict();

const googleSearchAdsSnapshotSchema = z
  .object({
    campaignId: boundedOptionalId,
    campaignName: boundedOptionalString,
    adGroupId: boundedOptionalId,
    adGroupName: boundedOptionalString,
    searchTerm: boundedOptionalString,
    landingPage: z.string().trim().startsWith("/").max(2_000),
    utmSource: boundedOptionalString,
    utmMedium: boundedOptionalString,
    utmCampaign: boundedOptionalString,
    utmContent: boundedOptionalString,
    utmTerm: boundedOptionalString,
    receivedAt,
  })
  .strict();

const manualOutboundSnapshotSchema = z
  .object({
    origin: z.enum(["legacy_manual", "admin_entry"]),
    context: boundedOptionalString,
    receivedAt,
  })
  .strict();

const directContactSnapshotSchema = z
  .object({
    channel: z.enum(["phone", "email", "whatsapp", "in_person"]),
    context: boundedOptionalString,
    receivedAt,
  })
  .strict();

const sourceSchemas = {
  google_maps: googleMapsSnapshotSchema,
  meta_lead_ads: metaLeadAdsSnapshotSchema,
  website: websiteSnapshotSchema,
  google_search_ads: googleSearchAdsSnapshotSchema,
  manual_outbound: manualOutboundSnapshotSchema,
  direct_contact: directContactSnapshotSchema,
} satisfies Record<LeadSourceKey, z.ZodType<Record<string, unknown>>>;

export function isLeadSourceKey(sourceKey: string): sourceKey is LeadSourceKey {
  return Object.prototype.hasOwnProperty.call(sourceSchemas, sourceKey);
}

export function validateSourceSnapshot(
  sourceKey: string,
  value: unknown,
): Record<string, unknown> {
  if (!isLeadSourceKey(sourceKey)) {
    throw new LeadDomainError("VALIDATION", `Unknown lead source: ${sourceKey}`);
  }
  const result = sourceSchemas[sourceKey].safeParse(value);
  if (!result.success) {
    throw new LeadDomainError("VALIDATION", "Invalid source snapshot", {
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }
  return result.data;
}

const utmFields = {
  utm_source: "utmSource",
  utm_medium: "utmMedium",
  utm_campaign: "utmCampaign",
  utm_content: "utmContent",
  utm_term: "utmTerm",
} as const;

export function websiteAttributionFromReferrer(
  referrer: string | null | undefined,
): Record<string, string> {
  if (!referrer) return { landingPage: "/contact" };

  try {
    const parsed = new URL(referrer);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { landingPage: "/contact" };
    }

    const result: Record<string, string> = {
      landingPage: parsed.pathname || "/contact",
      referrer: `${parsed.origin}${parsed.pathname || "/"}`,
    };
    for (const [queryKey, resultKey] of Object.entries(utmFields)) {
      const value = parsed.searchParams.get(queryKey)?.trim();
      if (value) result[resultKey] = value.slice(0, 500);
    }
    return result;
  } catch {
    return { landingPage: "/contact" };
  }
}
