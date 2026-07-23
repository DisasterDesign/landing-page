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
    prisma.contactSubmission.findMany({ where: { phone: { not: null } }, select: { phone: true } }),
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
  });
  const selectedIds = selected.map(({ id }) => id);
  const publishedAt = new Date();

  await prisma.$transaction(async (transaction) => {
    const batch = await transaction.weeklyProspectBatch.create({
      data: { cycleId, weekStart: cycle.weekStart, sellerId, publishedAt },
    });
    if (selectedIds.length > 0) {
      await transaction.prospect.updateMany({
        where: { id: { in: selectedIds }, status: "READY" },
        data: {
          status: "PUBLISHED",
          assignedSellerId: sellerId,
          batchId: batch.id,
          publishedAt,
        },
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
    body: `${selected.length} עסקים חדשים ממתינים לשיחה`,
    url: "/seller/cold-leads",
  });

  return { action: "published", count: selected.length };
}
