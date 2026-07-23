import type { LivePlaceDetails } from "./types";
import type { SellerLeadDetail } from "@/lib/leads/projection";

interface SellerProspectRecord {
  id: string;
  placeId: string;
  status: string;
  websiteStatus: string;
  auditedDomain: string | null;
  qualityScore: number | null;
  rawQualityScore: number | null;
  auditConfidence: number | null;
  opportunitySummary: string | null;
  callAngles: string[];
  nextFollowUpAt: Date | string | null;
  lastContactedAt: Date | string | null;
  salesFitClassification: string | null;
  salesFitConfidence: number | null;
  ownerReachabilityScore: number | null;
  salesFitReason: string | null;
  salesFitEvidence: string[];
  audits: Array<{
    availabilityScore: number | null;
    performanceScore: number | null;
    seoScore: number | null;
    maintenanceScore: number | null;
    visualScore: number | null;
    commercialScore: number | null;
  }>;
  interactions: Array<{
    id: string;
    outcome: string;
    note: string | null;
    nextFollowUpAt: Date | string | null;
    createdAt: Date | string;
  }>;
}

function iso(value: Date | string | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

export function auditedDomainWebsite(
  auditedDomain: string | null,
  websiteStatus: string,
): string | null {
  if (
    !auditedDomain ||
    ["NO_WEBSITE", "SOCIAL_ONLY", "UNREACHABLE", "BLOCKED", "UNKNOWN"].includes(
      websiteStatus,
    )
  ) {
    return null;
  }
  if (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/i.test(auditedDomain)) return null;
  try {
    const url = new URL(`https://${auditedDomain}`);
    if (
      url.username ||
      url.password ||
      url.port ||
      url.hostname.toLowerCase() !== auditedDomain.toLowerCase() ||
      !url.hostname.includes(".")
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function googleMapsUrl(placeId: string, displayName: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(displayName)}&query_place_id=${encodeURIComponent(placeId)}`;
}

export function safePublicWebsite(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      url.username ||
      url.password
    ) {
      return null;
    }
    return trimmed;
  } catch {
    return null;
  }
}

export function serializeSellerProspect(
  prospect: SellerProspectRecord,
  live?: LivePlaceDetails,
) {
  const auditedWebsite = auditedDomainWebsite(
    prospect.auditedDomain,
    prospect.websiteStatus,
  );
  const liveWebsite = safePublicWebsite(live?.websiteUri);
  const website = liveWebsite ?? auditedWebsite;
  const displayName =
    live?.displayName || prospect.auditedDomain || "פרטי העסק לא זמינים";
  const audit = prospect.audits[0];

  return {
    id: prospect.id,
    status: prospect.status,
    websiteStatus: prospect.websiteStatus,
    auditedDomain: prospect.auditedDomain,
    qualityScore: prospect.qualityScore,
    rawQualityScore: prospect.rawQualityScore,
    auditConfidence: prospect.auditConfidence,
    opportunitySummary: prospect.opportunitySummary,
    callAngles: prospect.callAngles,
    nextFollowUpAt: iso(prospect.nextFollowUpAt),
    lastContactedAt: iso(prospect.lastContactedAt),
    liveStatus: !live
      ? ("UNAVAILABLE" as const)
      : live.nationalPhoneNumber
        ? ("READY" as const)
        : ("NO_PHONE" as const),
    business: {
      displayName,
      phone: live?.nationalPhoneNumber ?? null,
      address: live?.formattedAddress ?? null,
      website,
      websiteSource: liveWebsite
        ? ("GOOGLE" as const)
        : auditedWebsite
          ? ("AUDITED_DOMAIN" as const)
          : ("NONE" as const),
      mapUrl: googleMapsUrl(prospect.placeId, displayName),
      category: live?.category ?? null,
      rating: live?.rating ?? null,
      reviewCount: live?.reviewCount ?? null,
      weekdayDescriptions: live?.weekdayDescriptions ?? [],
      businessStatus: live?.businessStatus ?? null,
    },
    salesFit: {
      classification: prospect.salesFitClassification,
      confidence: prospect.salesFitConfidence,
      ownerReachabilityScore: prospect.ownerReachabilityScore,
      reason: prospect.salesFitReason,
      evidence: prospect.salesFitEvidence,
    },
    scoreBreakdown: audit
      ? {
          availability: audit.availabilityScore,
          performance: audit.performanceScore,
          seo: audit.seoScore,
          maintenance: audit.maintenanceScore,
          visual: audit.visualScore,
          commercial: audit.commercialScore,
        }
      : null,
    interactions: prospect.interactions.map((interaction) => ({
      id: interaction.id,
      outcome: interaction.outcome,
      note: interaction.note,
      nextFollowUpAt: iso(interaction.nextFollowUpAt),
      createdAt: iso(interaction.createdAt) as string,
    })),
  };
}

export type SellerProspectView = ReturnType<typeof serializeSellerProspect>;

function legacyProspectStatus(lead: SellerLeadDetail): string {
  if (lead.stage === "QUALIFIED" || lead.stage.startsWith("AGREEMENT_")) {
    return "QUALIFIED";
  }
  if (lead.stage === "LOST") {
    return lead.doNotContactAt ? "DO_NOT_CALL" : "NOT_INTERESTED";
  }
  if (lead.stage === "SPAM") return "INVALID";
  if (
    lead.nextAction.kind === "COMPLETE_FOLLOW_UP" ||
    lead.nextFollowUpAt
  ) {
    return "FOLLOW_UP";
  }
  return "PUBLISHED";
}

export function serializeCanonicalSellerProspect(lead: SellerLeadDetail) {
  const preparation = lead.preparation;
  return {
    id: preparation?.prospectId ?? lead.id,
    leadId: lead.id,
    status: legacyProspectStatus(lead),
    websiteStatus: preparation?.websiteStatus ?? "UNKNOWN",
    auditedDomain: preparation?.auditedDomain ?? null,
    qualityScore: preparation?.qualityScore ?? null,
    rawQualityScore: preparation?.rawQualityScore ?? null,
    auditConfidence: preparation?.auditConfidence ?? null,
    opportunitySummary: preparation?.opportunitySummary ?? null,
    callAngles:
      preparation?.callAngles.map((callAngle) => callAngle.text) ?? [],
    nextFollowUpAt: lead.nextFollowUpAt,
    lastContactedAt:
      lead.interactions.at(-1)?.occurredAt ?? null,
    liveStatus: preparation?.liveStatus ?? "NOT_APPLICABLE",
    business: {
      displayName: lead.company ?? lead.name ?? "עסק ללא שם",
      phone: lead.phone,
      address: lead.address,
      website: lead.website,
      websiteSource: lead.websiteSource,
      mapUrl: lead.mapUrl,
      category: lead.category,
      rating: preparation?.rating ?? null,
      reviewCount: preparation?.reviewCount ?? null,
      weekdayDescriptions: preparation?.weekdayDescriptions ?? [],
      businessStatus: preparation?.businessStatus ?? null,
    },
    salesFit: preparation?.salesFit ?? {
      classification: null,
      confidence: null,
      ownerReachabilityScore: null,
      reason: null,
      evidence: [],
    },
    scoreBreakdown: preparation?.scoreBreakdown ?? null,
    interactions: lead.interactions.map((interaction) => ({
      id: interaction.id,
      outcome: interaction.outcome,
      note: interaction.note,
      nextFollowUpAt: interaction.nextFollowUpAt,
      createdAt: interaction.occurredAt,
    })),
  };
}
