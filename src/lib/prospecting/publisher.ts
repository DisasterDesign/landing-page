import type { Prisma, WebsiteStatus } from "@prisma/client";

import { appendLeadEventOnce } from "@/lib/leads/events";
import { createLeadInTransaction } from "@/lib/leads/lifecycle";
import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

import { getProspectingConfig } from "./config";
import { GooglePlacesProspectingProvider } from "./places";
import { hashSuppressionValue, normalizeDomain, normalizePhone } from "./suppression";
import type { PlacesProspectingProvider } from "./types";

export interface PublishableProspectCandidate {
  id: string;
  status: string;
  qualityScore: number | null;
  auditConfidence: number | null;
  commercialFit: number;
  salesFitClassification: string | null;
  salesFitConfidence: number | null;
  ownerReachabilityScore: number | null;
  auditedDomain: string | null;
  hasLivePhone: boolean;
  displayName: string | null;
  discoveredAt: Date;
  placeId?: string;
  phone?: string | null;
}

interface PublicationOptions {
  existingDomains?: ReadonlySet<string>;
  existingPhones?: ReadonlySet<string>;
  suppressedPlaceIds?: ReadonlySet<string>;
  suppressedPhoneHashes?: ReadonlySet<string>;
  suppressedDomainHashes?: ReadonlySet<string>;
  existingExternalLeadIds?: ReadonlySet<string>;
  hashSecret?: string;
  limit?: number;
}

export function selectPublishableProspects<T extends PublishableProspectCandidate>(
  prospects: readonly T[],
  options: PublicationOptions = {},
): T[] {
  const existingDomains = options.existingDomains ?? new Set<string>();
  const existingPhones = options.existingPhones ?? new Set<string>();
  const limit = Math.min(Math.max(options.limit ?? 50, 0), 50);

  return prospects
    .filter(
      (prospect) =>
        prospect.status === "READY" &&
        prospect.qualityScore !== null &&
        prospect.qualityScore >= 0 &&
        prospect.qualityScore <= 4 &&
        prospect.salesFitClassification === "INDEPENDENT_LIKELY" &&
        (prospect.salesFitConfidence ?? 0) >= 0.8 &&
        (prospect.ownerReachabilityScore ?? 0) >= 70 &&
        prospect.hasLivePhone &&
        Boolean(prospect.displayName?.trim()) &&
        (!prospect.placeId ||
          !options.existingExternalLeadIds?.has(
            `gplaces:${prospect.placeId}`,
          )) &&
        (!prospect.placeId || !options.suppressedPlaceIds?.has(prospect.placeId)) &&
        (!prospect.phone || !existingPhones.has(normalizePhone(prospect.phone))) &&
        (!prospect.auditedDomain || !existingDomains.has(normalizeDomain(prospect.auditedDomain))) &&
        (!prospect.phone ||
          !options.suppressedPhoneHashes?.has(
            hashSuppressionValue(prospect.phone, options.hashSecret ?? "selection-without-suppression"),
          )) &&
        (!prospect.auditedDomain ||
          !options.suppressedDomainHashes?.has(
            hashSuppressionValue(
              normalizeDomain(prospect.auditedDomain),
              options.hashSecret ?? "selection-without-suppression",
            ),
          )),
    )
    .sort((left, right) => {
      if (left.qualityScore !== right.qualityScore) {
        return (left.qualityScore ?? 5) - (right.qualityScore ?? 5);
      }
      if (left.ownerReachabilityScore !== right.ownerReachabilityScore) {
        return (right.ownerReachabilityScore ?? 0) - (left.ownerReachabilityScore ?? 0);
      }
      if (left.salesFitConfidence !== right.salesFitConfidence) {
        return (right.salesFitConfidence ?? 0) - (left.salesFitConfidence ?? 0);
      }
      if (left.auditConfidence !== right.auditConfidence) {
        return (right.auditConfidence ?? 0) - (left.auditConfidence ?? 0);
      }
      if (left.commercialFit !== right.commercialFit) {
        return right.commercialFit - left.commercialFit;
      }
      return left.discoveredAt.getTime() - right.discoveredAt.getTime();
    })
    .slice(0, limit);
}

export interface PublishProspectAsLeadInput {
  prospect: {
    id: string;
    placeId: string;
    promotedLeadId: string | null;
    websiteStatus: WebsiteStatus;
    auditedDomain: string | null;
    businessShape: string | null;
    businessShapeVersion: number | null;
    qualityScore: number | null;
    scoringVersion: number | null;
    opportunitySummary: string | null;
    callAngles: string[];
  };
  displayName: string;
  territory: string;
  cycleId: string;
  batchId: string;
  weekStart: Date;
  sellerId: string;
  publishedAt: Date;
}

function internalBusinessCategory(
  value: string | null,
): "UNKNOWN" | "SERVICE" | "RETAIL" | "ECOMMERCE" {
  return value === "SERVICE" || value === "RETAIL" || value === "ECOMMERCE"
    ? value
    : "UNKNOWN";
}

export async function publishProspectAsLead(
  transaction: Prisma.TransactionClient,
  input: PublishProspectAsLeadInput,
): Promise<{ leadId: string; created: boolean }> {
  const current = await transaction.prospect.findUnique({
    where: { id: input.prospect.id },
    select: { promotedLeadId: true },
  });
  if (current?.promotedLeadId) {
    return { leadId: current.promotedLeadId, created: false };
  }
  const displayName = input.displayName.trim();
  if (!displayName) throw new Error("Published prospect requires a display name");
  if (
    input.prospect.qualityScore === null ||
    input.prospect.qualityScore < 0 ||
    input.prospect.qualityScore > 4
  ) {
    throw new Error("Published prospect requires a quality score from 0 to 4");
  }

  const externalLeadId = `gplaces:${input.prospect.placeId}`;
  const existingPair = await transaction.contactSubmission.findUnique({
    where: {
      sourceKey_externalLeadId: {
        sourceKey: "google_maps",
        externalLeadId,
      },
    },
    select: { id: true },
  });
  const scoringVersion = input.prospect.scoringVersion ?? 1;
  const result = await createLeadInTransaction(transaction, {
    intentLevel: "OUTBOUND",
    sourceKey: "google_maps",
    externalLeadId,
    sourceSnapshot: {
      territory: input.territory,
      cycleId: input.cycleId,
      batchId: input.batchId,
      weekStart: input.weekStart.toISOString(),
      placeId: input.prospect.placeId,
      websiteStatus: input.prospect.websiteStatus,
      auditedDomain: input.prospect.auditedDomain,
      internalBusinessCategory: internalBusinessCategory(
        input.prospect.businessShape,
      ),
      internalBusinessCategoryVersion:
        input.prospect.businessShapeVersion ?? 1,
      qualityScore: input.prospect.qualityScore,
      scoringVersion,
      opportunitySummary:
        input.prospect.opportunitySummary ?? "אין לעסק אתר שמיש כיום",
      callAngles: input.prospect.callAngles.map((text, index) => ({
        id: `${scoringVersion}:${index + 1}`,
        text,
        version: scoringVersion,
      })),
    },
    occurredAt: input.publishedAt,
    notificationMode: "NONE",
    eligibleSellerId: input.sellerId,
    company: displayName,
  });
  await transaction.prospect.update({
    where: { id: input.prospect.id },
    data: {
      promotedLeadId: result.lead.id,
      status: "PUBLISHED",
      assignedSellerId: input.sellerId,
      batchId: input.batchId,
      publishedAt: input.publishedAt,
    },
  });
  await appendLeadEventOnce(transaction, {
    leadId: result.lead.id,
    type: "PUBLISHED",
    actor: { type: "SYSTEM" },
    fromStage: result.lead.stage,
    toStage: result.lead.stage,
    occurredAt: input.publishedAt,
    dedupeKey: `lead:${result.lead.id}:published:${input.cycleId}`,
    metadata: {
      cycleId: input.cycleId,
      batchId: input.batchId,
      prospectId: input.prospect.id,
    },
  });
  return { leadId: result.lead.id, created: existingPair === null };
}

function settingString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export async function publishProspectingCycle(
  cycleId: string,
  dependencies: {
    placesProvider?: PlacesProspectingProvider;
    notify?: typeof createNotification;
  } = {},
): Promise<{ action: "published" | "already-published"; count: number }> {
  const config = getProspectingConfig();
  const cycle = await prisma.prospectingCycle.findUnique({ where: { id: cycleId } });
  if (!cycle) throw new Error("Prospecting cycle not found");
  const existingBatch = await prisma.weeklyProspectBatch.findUnique({ where: { cycleId } });
  if (existingBatch) return { action: "already-published", count: 0 };

  const sellerSetting = await prisma.keyValue.findUnique({
    where: { key: "prospecting:defaultSellerId" },
  });
  const sellerId = cycle.assignedSellerId ?? settingString(sellerSetting?.value);
  if (!sellerId) throw new Error("No default seller is configured for prospecting");
  const approvedTerritory = await prisma.territoryProposal.findFirst({
    where: { cycleId, status: "APPROVED" },
    orderBy: { approvedAt: "desc" },
    select: { displayName: true },
  });
  if (!approvedTerritory) {
    throw new Error("Prospecting cycle has no approved territory");
  }

  const prospects = await prisma.prospect.findMany({
    where: { cycleId, status: "READY" },
    include: { audits: { orderBy: { auditedAt: "desc" }, take: 1 } },
  });
  const provider =
    dependencies.placesProvider ??
    new GooglePlacesProspectingProvider({
      apiKey: config.placesApiKey,
      maxDiscoveredPerCycle: config.maxDiscoveredPerCycle,
      maxPlacesCallsPerCycle: config.maxPlacesCallsPerCycle,
    });
  const liveDetails = await provider.getLiveDetails(prospects.map(({ placeId }) => placeId));

  const [clients, existingLeads, suppressions] = await Promise.all([
    prisma.client.findMany({ where: { websiteUrl: { not: null } }, select: { websiteUrl: true } }),
    prisma.contactSubmission.findMany({
      where: {
        OR: [
          { phone: { not: null } },
          { sourceKey: "google_maps", externalLeadId: { not: null } },
        ],
      },
      select: { phone: true, sourceKey: true, externalLeadId: true },
    }),
    prisma.prospectSuppression.findMany(),
  ]);
  const existingDomains = new Set(
    clients.flatMap(({ websiteUrl }) => (websiteUrl ? [normalizeDomain(websiteUrl)] : [])),
  );
  const existingPhones = new Set(
    existingLeads.flatMap(({ phone }) => (phone ? [normalizePhone(phone)] : [])),
  );

  const candidates = prospects.map((prospect) => {
    const live = liveDetails.get(prospect.placeId);
    return {
      id: prospect.id,
      placeId: prospect.placeId,
      status: prospect.status,
      qualityScore: prospect.qualityScore,
      auditConfidence: prospect.auditConfidence,
      commercialFit: prospect.audits[0]?.commercialScore ?? 0,
      salesFitClassification: prospect.salesFitClassification,
      salesFitConfidence: prospect.salesFitConfidence,
      ownerReachabilityScore: prospect.ownerReachabilityScore,
      auditedDomain: prospect.auditedDomain,
      phone: live?.nationalPhoneNumber ?? null,
      hasLivePhone: Boolean(live?.nationalPhoneNumber),
      displayName: live?.displayName ?? null,
      discoveredAt: prospect.createdAt,
    };
  });
  const selected = selectPublishableProspects(candidates, {
    limit: cycle.targetCount,
    existingDomains,
    existingPhones,
    suppressedPlaceIds: new Set(suppressions.flatMap(({ placeId }) => (placeId ? [placeId] : []))),
    suppressedPhoneHashes: new Set(
      suppressions.flatMap(({ phoneHash }) => (phoneHash ? [phoneHash] : [])),
    ),
    suppressedDomainHashes: new Set(
      suppressions.flatMap(({ domainHash }) => (domainHash ? [domainHash] : [])),
    ),
    hashSecret: config.hashSecret,
    existingExternalLeadIds: new Set(
      existingLeads.flatMap(({ sourceKey, externalLeadId }) =>
        sourceKey === "google_maps" && externalLeadId ? [externalLeadId] : [],
      ),
    ),
  });
  const publishedAt = new Date();
  const prospectById = new Map(prospects.map((prospect) => [prospect.id, prospect]));

  await prisma.$transaction(async (transaction) => {
    const batch = await transaction.weeklyProspectBatch.create({
      data: {
        cycleId,
        weekStart: cycle.weekStart,
        revision: cycle.revision,
        sellerId,
        publishedAt,
      },
    });
    for (const selectedProspect of selected) {
      const prospect = prospectById.get(selectedProspect.id);
      if (!prospect || !selectedProspect.displayName) {
        throw new Error("Selected prospect is missing publication data");
      }
      await publishProspectAsLead(transaction, {
        prospect: {
          id: prospect.id,
          placeId: prospect.placeId,
          promotedLeadId: prospect.promotedLeadId,
          websiteStatus: prospect.websiteStatus,
          auditedDomain: prospect.auditedDomain,
          businessShape: prospect.businessShape,
          businessShapeVersion: prospect.businessShapeVersion,
          qualityScore: prospect.qualityScore,
          scoringVersion: prospect.scoringVersion,
          opportunitySummary: prospect.opportunitySummary,
          callAngles: prospect.callAngles,
        },
        displayName: selectedProspect.displayName,
        territory: approvedTerritory.displayName,
        cycleId,
        batchId: batch.id,
        weekStart: cycle.weekStart,
        sellerId,
        publishedAt,
      });
    }
    await transaction.prospectingCycle.update({
      where: { id: cycleId },
      data: { status: "PUBLISHED", assignedSellerId: sellerId, publishedAt },
    });
  });

  await (dependencies.notify ?? createNotification)({
    recipientId: sellerId,
    type: "PROSPECTING_BATCH_READY",
    title: "רשימת הלידים הקרים השבועית מוכנה",
    body: `${selected.length} עסקים חדשים מ-${approvedTerritory.displayName} ממתינים לשיחה`,
    url: "/seller/cold-leads",
    dedupeKey: `prospecting-batch:${cycleId}:${sellerId}`,
  });

  if (selected.length < cycle.targetCount) {
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      select: { id: true },
    });
    await Promise.all(
      admins.map((admin) =>
        (dependencies.notify ?? createNotification)({
          recipientId: admin.id,
          type: "PROSPECTING_BATCH_SHORTFALL",
          title: "רשימת הלידים השבועית נסגרה בחוסר",
          body: `${selected.length} מתוך ${cycle.targetCount} עסקים תקינים נמצאו ב-${approvedTerritory.displayName}`,
          url: "/admin/prospecting",
          dedupeKey: `${admin.id}:prospecting-shortfall:${cycleId}`,
        }),
      ),
    );
  }

  return { action: "published", count: selected.length };
}
