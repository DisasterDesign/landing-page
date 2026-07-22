import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { assessWebsiteVisuals } from "./ai";
import { classifyWebsiteUrl, looksParked } from "./classify-website";
import { auditCommerce } from "./commerce-audit";
import { getProspectingConfig } from "./config";
import { hasPageSpeedScreenshot, runPageSpeed } from "./pagespeed";
import { GooglePlacesProspectingProvider, PROSPECTING_CATEGORY_QUERIES } from "./places";
import { publishProspectingCycle } from "./publisher";
import { safeFetchHtml, type SafeFetchFailureCode } from "./safe-fetch";
import { calculateWebsiteScore } from "./score";
import { normalizeDomain } from "./suppression";
import { auditHtml } from "./technical-audit";
import type { WebsiteScoreDimensions, WebsiteStatus } from "./types";

const LOCK_TTL_MS = 15 * 60 * 1_000;
const RETRY_WINDOW_MS = 24 * 60 * 60 * 1_000;

export type WorkerResult = {
  enabled: boolean;
  action: "disabled" | "idle" | "discovered" | "audited" | "waiting" | "ready" | "published" | "failed";
  cycleId?: string;
  count?: number;
  error?: string;
};

function scoreDimensions(input: {
  url: string;
  technical: ReturnType<typeof auditHtml>;
  commerce: ReturnType<typeof auditCommerce>;
  pageSpeed: Awaited<ReturnType<typeof runPageSpeed>>;
  visualScore: number;
}): WebsiteScoreDimensions {
  const availabilityScore =
    (input.url.startsWith("https://") ? 8 : 3) +
    6 +
    (input.technical.brokenLinkCount === 0 ? 3 : 0) +
    (input.technical.brokenImageCount === 0 ? 3 : 0);
  const performanceScore =
    Math.round((input.pageSpeed.performanceScore / 100) * 15) +
    (input.technical.hasViewport ? 5 : 0);
  const seoScore =
    (input.technical.indexable ? 3 : 0) +
    (input.technical.hasTitle ? 3 : 0) +
    (input.technical.hasMetaDescription ? 3 : 0) +
    (input.technical.hasCanonical ? 2 : 0) +
    (input.technical.h1Count === 1 ? 3 : 0) +
    (input.technical.structuredDataTypes.length > 0 ? 2 : 0) +
    (input.technical.internalLinkCount > 0 ? 2 : 0) +
    (input.pageSpeed.seoScore >= 80 ? 2 : 0);
  const maintenanceScore = Math.max(
    0,
    15 -
      Math.min(input.technical.imagesMissingAlt, 4) -
      Math.min(input.technical.brokenLinkCount * 2, 4) -
      Math.min(input.technical.brokenImageCount * 2, 4) -
      (input.technical.hasStaleExplicitDate ? 3 : 0),
  );
  const commercialScore =
    input.commerce.businessShape === "ECOMMERCE"
      ? Math.min(
          10,
          (input.commerce.hasProductLink ? 2 : 0) +
            (input.commerce.hasProductStructuredData ? 2 : 0) +
            (input.commerce.hasCartLink ? 2 : 0) +
            (input.commerce.hasCheckoutLink ? 2 : 0) +
            (input.commerce.hasShippingOrReturnsEvidence ? 2 : 0),
        )
      : input.commerce.hasContactPath
        ? 10
        : 0;

  return {
    availabilityScore,
    performanceScore,
    seoScore,
    maintenanceScore,
    visualScore: input.visualScore,
    commercialScore,
  };
}

async function claimCycle(now: Date) {
  const staleBefore = new Date(now.getTime() - LOCK_TTL_MS);
  const cycle = await prisma.prospectingCycle.findFirst({
    where: {
      status: { in: ["DISCOVERY_QUEUED", "DISCOVERING", "AUDITING", "READY"] },
      OR: [{ lockedAt: null }, { lockedAt: { lt: staleBefore } }],
    },
    orderBy: { createdAt: "asc" },
  });
  if (!cycle) return null;

  const lockToken = randomUUID();
  const claimed = await prisma.prospectingCycle.updateMany({
    where: {
      id: cycle.id,
      status: cycle.status,
      OR: [{ lockedAt: null }, { lockedAt: { lt: staleBefore } }],
    },
    data: { lockedAt: now, lockToken },
  });
  return claimed.count === 1 ? { ...cycle, lockToken } : null;
}

async function saveTerminalAudit(input: {
  prospectId: string;
  websiteStatus: WebsiteStatus;
  auditedDomain?: string | null;
  technicalEvidence: Prisma.InputJsonValue;
  qualityScore?: number | null;
  rawScore?: number | null;
  dimensions?: WebsiteScoreDimensions;
  confidence?: number | null;
  businessShape?: string | null;
  callAngles?: string[];
  visualEvidence?: Prisma.InputJsonValue | null;
}): Promise<void> {
  const status = input.qualityScore === null || input.qualityScore === undefined ? "FAILED_REVIEW" : "READY";
  await prisma.$transaction(async (transaction) => {
    await transaction.prospectWebsiteAudit.create({
      data: {
        prospectId: input.prospectId,
        scoringVersion: 1,
        websiteStatus: input.websiteStatus,
        rawScore: input.rawScore,
        qualityScore: input.qualityScore,
        availabilityScore: input.dimensions?.availabilityScore,
        performanceScore: input.dimensions?.performanceScore,
        seoScore: input.dimensions?.seoScore,
        maintenanceScore: input.dimensions?.maintenanceScore,
        visualScore: input.dimensions?.visualScore,
        commercialScore: input.dimensions?.commercialScore,
        confidence: input.confidence,
        technicalEvidence: input.technicalEvidence,
        visualEvidence: input.visualEvidence ?? undefined,
        callAngles: input.callAngles ?? [],
        pageSpeedStrategy: input.dimensions ? "mobile" : null,
      },
    });
    await transaction.prospect.update({
      where: { id: input.prospectId },
      data: {
        status,
        websiteStatus: input.websiteStatus,
        auditedDomain: input.auditedDomain,
        businessShape: input.businessShape,
        qualityScore: input.qualityScore,
        rawQualityScore: input.rawScore,
        auditConfidence: input.confidence,
        callAngles: input.callAngles ?? [],
        scoringVersion: 1,
        opportunitySummary:
          input.qualityScore === null || input.qualityScore === undefined
            ? "האתר דורש בדיקה ידנית לפני פרסום"
            : `אתר בדירוג ${input.qualityScore}/5 עם הזדמנויות שיפור מדידות`,
        nextAuditAt: null,
      },
    });
  });
}

async function saveHardZero(
  prospectId: string,
  websiteStatus: "NO_WEBSITE" | "SOCIAL_ONLY" | "PARKED" | "UNREACHABLE",
  evidence: Prisma.InputJsonValue,
  auditedDomain: string | null = null,
): Promise<void> {
  const score = calculateWebsiteScore({ websiteStatus });
  await saveTerminalAudit({
    prospectId,
    websiteStatus,
    auditedDomain,
    technicalEvidence: evidence,
    qualityScore: score.qualityScore,
    rawScore: score.rawScore,
    dimensions: score,
    confidence: 1,
    callAngles: [
      "אין כרגע אתר עצמאי שעובד עבור העסק",
      "אפשר לבנות בסיס SEO מקומי שנמצא בבעלות העסק",
      "אתר מהיר יכול להפוך חיפושים לפניות ומכירות",
    ],
  });
}

async function recordAuditFailure(
  prospect: { id: string; auditFailureCount: number; firstAuditFailureAt: Date | null },
  code: SafeFetchFailureCode | "PROVIDER_ERROR",
  now: Date,
): Promise<"retry" | "unreachable"> {
  const nextCount = prospect.auditFailureCount + 1;
  const firstFailure = prospect.firstAuditFailureAt ?? now;
  if (nextCount >= 3 && now.getTime() - firstFailure.getTime() >= RETRY_WINDOW_MS) {
    await saveHardZero(prospect.id, "UNREACHABLE", { failureCode: code, attempts: nextCount });
    return "unreachable";
  }

  const retryAt = new Date(
    Math.max(now.getTime() + 12 * 60 * 60 * 1_000, firstFailure.getTime() + RETRY_WINDOW_MS),
  );
  await prisma.prospect.update({
    where: { id: prospect.id },
    data: {
      status: "AUDIT_PENDING",
      auditFailureCount: nextCount,
      firstAuditFailureAt: firstFailure,
      lastAuditFailureAt: now,
      nextAuditAt: retryAt,
    },
  });
  return "retry";
}

async function processDiscovery(cycle: Awaited<ReturnType<typeof claimCycle>>, config: ReturnType<typeof getProspectingConfig>) {
  if (!cycle) return 0;
  const proposal = await prisma.territoryProposal.findFirst({
    where: { cycleId: cycle.id, status: "APPROVED" },
  });
  if (!proposal) throw new Error("Approved territory proposal not found");

  const queryIndex = cycle.discoveryQueryIndex;
  if (queryIndex >= PROSPECTING_CATEGORY_QUERIES.length) {
    await prisma.prospectingCycle.update({ where: { id: cycle.id }, data: { status: "AUDITING" } });
    return 0;
  }

  const discoveredCount = await prisma.prospect.count({ where: { cycleId: cycle.id } });
  const remainingDiscovered = config.maxDiscoveredPerCycle - discoveredCount;
  if (remainingDiscovered <= 0) {
    await prisma.prospectingCycle.update({
      where: { id: cycle.id },
      data: { status: "AUDITING" },
    });
    return 0;
  }
  const provider = new GooglePlacesProspectingProvider({
    apiKey: config.placesApiKey,
    maxDiscoveredPerCycle: remainingDiscovered,
    maxPlacesCallsPerCycle: Math.max(1, config.maxPlacesCallsPerCycle - cycle.placesSearchCalls),
  });
  const places = await provider.discover({
    query: `${PROSPECTING_CATEGORY_QUERIES[queryIndex]} ${proposal.searchQuery}`,
  });
  const suppressions = await prisma.prospectSuppression.findMany({
    where: { placeId: { in: places.map(({ placeId }) => placeId) } },
    select: { placeId: true },
  });
  const suppressed = new Set(suppressions.flatMap(({ placeId }) => (placeId ? [placeId] : [])));
  const eligible = places.filter(({ placeId }) => !suppressed.has(placeId));
  if (eligible.length > 0) {
    await prisma.prospect.createMany({
      data: eligible.map(({ placeId }) => ({
        placeId,
        cycleId: cycle.id,
        status: "AUDIT_PENDING" as const,
        callAngles: [],
      })),
      skipDuplicates: true,
    });
  }

  const nextIndex = queryIndex + 1;
  await prisma.prospectingCycle.update({
    where: { id: cycle.id },
    data: {
      status: nextIndex >= PROSPECTING_CATEGORY_QUERIES.length ? "AUDITING" : "DISCOVERING",
      discoveryQueryIndex: nextIndex,
      placesSearchCalls: { increment: provider.getCallCount() },
    },
  });
  return eligible.length;
}

async function processAudit(cycleId: string, config: ReturnType<typeof getProspectingConfig>, now: Date) {
  const prospect = await prisma.prospect.findFirst({
    where: {
      cycleId,
      status: "AUDIT_PENDING",
      OR: [{ nextAuditAt: null }, { nextAuditAt: { lte: now } }],
    },
    orderBy: { createdAt: "asc" },
  });
  if (!prospect) {
    const remaining = await prisma.prospect.count({
      where: { cycleId, status: { in: ["AUDIT_PENDING", "AUDITING"] } },
    });
    if (remaining === 0) {
      await prisma.prospectingCycle.update({ where: { id: cycleId }, data: { status: "READY" } });
      return "ready" as const;
    }
    return "waiting" as const;
  }

  const claimed = await prisma.prospect.updateMany({
    where: { id: prospect.id, status: "AUDIT_PENDING" },
    data: { status: "AUDITING" },
  });
  if (claimed.count !== 1) return "waiting" as const;

  const places = new GooglePlacesProspectingProvider({
    apiKey: config.placesApiKey,
    maxDiscoveredPerCycle: config.maxDiscoveredPerCycle,
    maxPlacesCallsPerCycle: config.maxPlacesCallsPerCycle,
  });

  try {
    const details = (await places.getLiveDetails([prospect.placeId])).get(prospect.placeId);
    await prisma.prospectingCycle.update({
      where: { id: cycleId },
      data: { placesDetailCalls: { increment: places.getCallCount() } },
    });
    if (!details) {
      await recordAuditFailure(prospect, "PROVIDER_ERROR", now);
      return "waiting" as const;
    }
    if (!details.websiteUri) {
      await saveHardZero(prospect.id, "NO_WEBSITE", { reason: "No website URI returned by live details" });
      return "audited" as const;
    }

    const classification = classifyWebsiteUrl(details.websiteUri);
    if (classification === "SOCIAL_ONLY") {
      await saveHardZero(prospect.id, "SOCIAL_ONLY", { reason: "Only a social or directory profile" });
      return "audited" as const;
    }
    if (classification === "UNKNOWN") {
      await saveTerminalAudit({
        prospectId: prospect.id,
        websiteStatus: "UNKNOWN",
        technicalEvidence: { reason: "Website URL could not be classified safely" },
      });
      return "audited" as const;
    }

    const fetched = await safeFetchHtml(details.websiteUri);
    if (!fetched.ok) {
      if (fetched.code === "BLOCKED_HOST" || fetched.code === "INVALID_URL") {
        await saveTerminalAudit({
          prospectId: prospect.id,
          websiteStatus: "BLOCKED",
          technicalEvidence: { failureCode: fetched.code },
        });
        return "audited" as const;
      }
      await recordAuditFailure(prospect, fetched.code, now);
      return "waiting" as const;
    }

    const domain = normalizeDomain(fetched.url);
    if (looksParked({
      title: fetched.html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1],
      bodyText: fetched.html.replace(/<[^>]+>/g, " ").slice(0, 10_000),
    })) {
      await saveHardZero(prospect.id, "PARKED", { reason: "Registrar or domain-sale page detected" }, domain);
      return "audited" as const;
    }

    const technical = auditHtml({ url: fetched.url, html: fetched.html, now });
    const commerce = auditCommerce({ url: fetched.url, html: fetched.html });
    const pageSpeed = await runPageSpeed(fetched.url, { apiKey: config.pageSpeedApiKey });
    await prisma.prospectingCycle.update({
      where: { id: cycleId },
      data: { pageSpeedCalls: { increment: 1 } },
    });
    const { finalScreenshotDataUrl: _discardedScreenshot, ...pageSpeedEvidence } = pageSpeed;
    void _discardedScreenshot;
    if (!hasPageSpeedScreenshot(pageSpeed)) {
      await saveTerminalAudit({
        prospectId: prospect.id,
        websiteStatus: "ACTIVE",
        auditedDomain: domain,
        technicalEvidence: {
          technical,
          commerce,
          pageSpeed: pageSpeedEvidence,
          visualAudit: "PageSpeed did not return a final screenshot",
        } as unknown as Prisma.InputJsonValue,
        businessShape: commerce.businessShape,
      });
      return "audited" as const;
    }

    const visual = await assessWebsiteVisuals(
      {
        screenshotDataUrl: pageSpeed.finalScreenshotDataUrl,
        technicalEvidence: technical,
        bodyText: fetched.html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/gi, " ").slice(0, 10_000),
        businessShape: commerce.businessShape,
      },
      { apiKey: config.aiApiKey, model: config.aiModel },
    );
    const dimensions = scoreDimensions({
      url: fetched.url,
      technical,
      commerce,
      pageSpeed,
      visualScore: visual.value.visualScore,
    });
    const score = calculateWebsiteScore({ websiteStatus: "ACTIVE", dimensions });

    await saveTerminalAudit({
      prospectId: prospect.id,
      websiteStatus: "ACTIVE",
      auditedDomain: domain,
      technicalEvidence: { technical, commerce, pageSpeed: pageSpeedEvidence } as unknown as Prisma.InputJsonValue,
      visualEvidence: {
        confidence: visual.value.confidence,
        findings: visual.value.findings,
      } as unknown as Prisma.InputJsonValue,
      qualityScore: score.qualityScore,
      rawScore: score.rawScore,
      dimensions,
      confidence: visual.value.confidence,
      businessShape: commerce.businessShape,
      callAngles: visual.value.callAngles,
    });
    await prisma.prospectingCycle.update({
      where: { id: cycleId },
      data: {
        aiCalls: { increment: 1 },
        aiInputTokens: { increment: visual.usage.inputTokens },
        aiOutputTokens: { increment: visual.usage.outputTokens },
        estimatedCostUsd: {
          increment:
            (visual.usage.inputTokens / 1_000_000) * 3 +
            (visual.usage.outputTokens / 1_000_000) * 15,
        },
      },
    });
    return "audited" as const;
  } catch (error) {
    console.error("Prospecting audit failed", {
      prospectId: prospect.id,
      message: error instanceof Error ? error.message : "Unknown provider error",
    });
    await recordAuditFailure(prospect, "PROVIDER_ERROR", now);
    return "waiting" as const;
  }
}

export async function processNextProspectingWork(now = new Date()): Promise<WorkerResult> {
  const config = getProspectingConfig();
  if (!config.enabled) return { enabled: false, action: "disabled" };

  const cycle = await claimCycle(now);
  if (!cycle) return { enabled: true, action: "idle" };

  try {
    if (
      cycle.estimatedCostUsd >= config.maxEstimatedCostUsd ||
      cycle.placesSearchCalls + cycle.placesDetailCalls >= config.maxPlacesCallsPerCycle ||
      cycle.aiCalls >= config.maxAiCallsPerCycle
    ) {
      await prisma.prospectingCycle.update({
        where: { id: cycle.id },
        data: { status: "FAILED", lastError: "Prospecting cost guard reached" },
      });
      return { enabled: true, action: "failed", cycleId: cycle.id, error: "cost-guard" };
    }

    if (cycle.status === "DISCOVERY_QUEUED" || cycle.status === "DISCOVERING") {
      const count = await processDiscovery(cycle, config);
      return { enabled: true, action: "discovered", cycleId: cycle.id, count };
    }
    if (cycle.status === "AUDITING") {
      const action = await processAudit(cycle.id, config, now);
      return { enabled: true, action, cycleId: cycle.id };
    }
    if (cycle.status === "READY") {
      const result = await publishProspectingCycle(cycle.id);
      return { enabled: true, action: "published", cycleId: cycle.id, count: result.count };
    }
    return { enabled: true, action: "idle", cycleId: cycle.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown prospecting worker error";
    await prisma.prospectingCycle.update({
      where: { id: cycle.id },
      data: { lastError: message },
    });
    return { enabled: true, action: "failed", cycleId: cycle.id, error: message };
  } finally {
    await prisma.prospectingCycle.updateMany({
      where: { id: cycle.id, lockToken: cycle.lockToken },
      data: { lockedAt: null, lockToken: null },
    });
  }
}
