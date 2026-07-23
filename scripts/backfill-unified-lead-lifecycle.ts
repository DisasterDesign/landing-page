import {
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { createHash } from "node:crypto";

import { appendLeadEventOnce } from "@/lib/leads/events";
import { legacyLeadStateHash } from "@/lib/leads/legacy-compat";
import {
  deriveLegacyLeadStage,
  mapLegacyLeadSource,
  mapLegacyProspectInteraction,
} from "@/lib/leads/legacy-mapping";
import { legacySourceMirror } from "@/lib/leads/lifecycle";
import {
  intentForSource,
  isLeadSourceKey,
  type LeadSourceKey,
  validateSourceSnapshot,
  websiteAttributionFromReferrer,
} from "@/lib/leads/source";
import { legacyStatusForStage } from "@/lib/leads/stage-machine";
import { hashSuppressionValue, normalizeDomain } from "@/lib/prospecting/suppression";
import {
  captureMigrationBaseline,
  shouldCancelScheduledFollowUpDuringBackfill,
  shouldInvalidateLeadForSupersession,
  stageAfterSupersession,
} from "./unified-lead-lifecycle-safety";

const prisma = new PrismaClient();
const apply = process.env.APPLY === "1";
const MAX_RETRIES = 2;
const MIGRATION_VERSION = 1;
const BASELINE_KEY = "migration:unified-lead-lifecycle:v1:baseline";

const leadInclude = {
  assignees: { select: { id: true, role: true } },
  owner: { select: { id: true, role: true } },
  eligibleSeller: { select: { id: true, role: true } },
  interactions: { select: { id: true } },
  notes: {
    select: { id: true, authorId: true, createdAt: true },
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
  },
  events: {
    where: {
      type: "MIGRATED" as const,
      dedupeKey: { endsWith: `:unified-lifecycle-backfill:v${MIGRATION_VERSION}` },
    },
    select: { id: true },
    take: 1,
  },
  agreements: {
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      paidAt: true,
      creditedSellerId: true,
      createdBy: true,
      isSellerDeal: true,
    },
  },
  prospect: {
    include: {
      assignedSeller: { select: { id: true, role: true } },
      interactions: { orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }] },
      batch: {
        include: { seller: { select: { id: true, role: true } } },
      },
      cycle: {
        include: {
          proposals: {
            where: { status: "APPROVED" as const },
            orderBy: { approvedAt: "desc" as const },
            take: 1,
          },
        },
      },
    },
  },
} satisfies Prisma.ContactSubmissionInclude;

type LegacyLeadRow = Prisma.ContactSubmissionGetPayload<{
  include: typeof leadInclude;
}>;

interface BackfillCounters {
  examined: number;
  changed: number;
  unchanged: number;
  created: number;
  interactions: number;
  followUps: number;
  suppressions: number;
  commissionsLinked: number;
  creditsFilled: number;
  unresolved: Array<{ kind: string; id: string; reason: string }>;
}

interface LeadSyncResult {
  outcome: "changed" | "unchanged";
  interactions: number;
  followUps: number;
  suppressions: number;
}

const counters: BackfillCounters = {
  examined: 0,
  changed: 0,
  unchanged: 0,
  created: 0,
  interactions: 0,
  followUps: 0,
  suppressions: 0,
  commissionsLinked: 0,
  creditsFilled: 0,
  unresolved: [],
};

function isRetryable(error: unknown): boolean {
  return (
    (error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034") ||
    (error instanceof Error &&
      /serialization|deadlock|write conflict/i.test(error.message))
  );
}

async function serializableRow<T>(
  kind: string,
  id: string,
  callback: (transaction: Prisma.TransactionClient) => Promise<T>,
): Promise<T | null> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await prisma.$transaction(callback, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 10_000,
        timeout: 30_000,
      });
    } catch (error) {
      if (!isRetryable(error)) throw error;
      lastError = error;
    }
  }
  counters.unresolved.push({
    kind,
    id,
    reason:
      lastError instanceof Error
        ? `SERIALIZATION_RETRY_EXHAUSTED: ${lastError.message}`
        : "SERIALIZATION_RETRY_EXHAUSTED",
  });
  return null;
}

async function lockLead(
  transaction: Prisma.TransactionClient,
  leadId: string,
): Promise<void> {
  const locked = await transaction.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`SELECT "id" FROM "ContactSubmission" WHERE "id" = ${leadId} FOR UPDATE`,
  );
  if (locked.length !== 1) throw new Error(`Lead ${leadId} disappeared before lock`);
}

function existingValidatedSnapshot(
  lead: LegacyLeadRow,
  sourceKey: string,
): Record<string, unknown> | null {
  try {
    return validateSourceSnapshot(sourceKey, lead.sourceSnapshot);
  } catch {
    return null;
  }
}

function firstPartyHosts(): ReadonlySet<string> {
  const configured = (process.env.LEGACY_FIRST_PARTY_HOSTS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return new Set(["fuzionwebz.com", "www.fuzionwebz.com", ...configured]);
}

function safeWebsiteAttribution(
  legacySource: string | null,
): Record<string, string> {
  if (!legacySource) return { landingPage: "/contact" };
  try {
    const parsed = new URL(legacySource);
    if (
      !["http:", "https:"].includes(parsed.protocol) ||
      !firstPartyHosts().has(parsed.hostname.toLowerCase())
    ) {
      return { landingPage: "/contact" };
    }
    return websiteAttributionFromReferrer(parsed.toString());
  } catch {
    return { landingPage: "/contact" };
  }
}

function internalBusinessCategory(
  value: string | null,
): "UNKNOWN" | "SERVICE" | "RETAIL" | "ECOMMERCE" {
  return value === "SERVICE" || value === "RETAIL" || value === "ECOMMERCE"
    ? value
    : "UNKNOWN";
}

function historicalSourceSnapshot(
  lead: LegacyLeadRow,
  sourceKey: "google_maps" | "meta_lead_ads" | "website",
  plannedExternalLeadId: string | null,
): Record<string, unknown> | null {
  const existing =
    sourceKey === "google_maps"
      ? null
      : existingValidatedSnapshot(lead, sourceKey);
  if (existing) return existing;

  let candidate: Record<string, unknown> | null = null;
  if (sourceKey === "meta_lead_ads") {
    if (!plannedExternalLeadId?.trim()) return null;
    candidate = {
      externalLeadId: plannedExternalLeadId,
      ...(lead.externalFormId ? { formId: lead.externalFormId } : {}),
      ...(lead.externalFormName ? { formName: lead.externalFormName } : {}),
      ...(lead.externalCampaignId
        ? { campaignId: lead.externalCampaignId }
        : {}),
      ...(lead.externalAdId ? { adId: lead.externalAdId } : {}),
      nonContactAnswers: [],
      receivedAt: lead.createdAt.toISOString(),
    };
  } else if (sourceKey === "website") {
    candidate = {
      ...safeWebsiteAttribution(lead.source),
      ...(lead.service?.trim() ? { service: lead.service.trim() } : {}),
      receivedAt: lead.createdAt.toISOString(),
    };
  } else {
    const prospect = lead.prospect;
    const batch = prospect?.batch;
    const territory = prospect?.cycle.proposals[0]?.displayName?.trim();
    if (
      !prospect ||
      !batch ||
      batch.cycleId !== prospect.cycleId ||
      prospect.cycle.status !== "PUBLISHED" ||
      !territory ||
      prospect.qualityScore === null ||
      !prospect.opportunitySummary?.trim() ||
      plannedExternalLeadId !== `gplaces:${prospect.placeId}`
    ) {
      return null;
    }
    const scoringVersion = prospect.scoringVersion ?? 1;
    candidate = {
      territory,
      cycleId: prospect.cycleId,
      batchId: batch.id,
      weekStart: batch.weekStart.toISOString(),
      placeId: prospect.placeId,
      websiteStatus: prospect.websiteStatus,
      auditedDomain: prospect.auditedDomain,
      internalBusinessCategory: internalBusinessCategory(
        prospect.businessShape,
      ),
      internalBusinessCategoryVersion:
        prospect.businessShapeVersion ?? 1,
      qualityScore: prospect.qualityScore,
      scoringVersion,
      opportunitySummary: prospect.opportunitySummary,
      callAngles: prospect.callAngles
        .slice(0, 3)
        .map((text, index) => ({
          id: `${scoringVersion}:${index + 1}`,
          text,
          version: scoringVersion,
        })),
    };
  }

  try {
    return validateSourceSnapshot(sourceKey, candidate);
  } catch {
    return null;
  }
}

function isHistoricalSourceKey(
  value: LeadSourceKey,
): value is "google_maps" | "meta_lead_ads" | "website" {
  return (
    value === "google_maps" ||
    value === "meta_lead_ads" ||
    value === "website"
  );
}

function sameIds(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    [...left].sort().every((value, index) => value === [...right].sort()[index])
  );
}

function noteHistoryHash(
  notes: readonly { id: string; authorId: string; createdAt: Date }[],
): string {
  return createHash("sha256")
    .update(
      JSON.stringify(
        notes.map((note) => ({
          id: note.id,
          authorId: note.authorId,
          createdAt: note.createdAt.toISOString(),
        })),
      ),
    )
    .digest("hex");
}

async function synchronizeLockedLead(
  transaction: Prisma.TransactionClient,
  leadId: string,
  defaultSellerId: string | null,
): Promise<LeadSyncResult> {
  const lead = await transaction.contactSubmission.findUnique({
    where: { id: leadId },
    include: leadInclude,
  });
  if (!lead) throw new Error(`Lead ${leadId} disappeared after lock`);

  const legacyAssigneeIds = lead.assignees.map(({ id }) => id);
  const legacyFingerprint = legacyLeadStateHash({
    status: lead.status,
    assigneeIds: legacyAssigneeIds,
    source: lead.source,
    acquisitionChannel: lead.acquisitionChannel,
    externalLeadId: lead.externalLeadId,
    externalFormId: lead.externalFormId,
    externalFormName: lead.externalFormName,
    externalCampaignId: lead.externalCampaignId,
    externalAdId: lead.externalAdId,
    nextFollowUpAt: lead.nextFollowUpAt,
    lastContactedAt: lead.lastContactedAt,
    closedAt: lead.closedAt,
  });
  const compatibilityIsCurrent = lead.legacyStateHash === legacyFingerprint;
  let canonicalSnapshot: Record<string, unknown> | null = null;
  let sourceMapping: {
    intentLevel: NonNullable<typeof lead.intentLevel>;
    sourceKey: LeadSourceKey;
  } | null = null;
  if (
    compatibilityIsCurrent &&
    lead.intentLevel &&
    lead.sourceKey &&
    isLeadSourceKey(lead.sourceKey) &&
    intentForSource(lead.sourceKey) === lead.intentLevel &&
    (lead.sourceKey !== "google_maps" || !lead.migrationReviewRequired)
  ) {
    canonicalSnapshot = existingValidatedSnapshot(lead, lead.sourceKey);
    if (canonicalSnapshot) {
      sourceMapping = {
        intentLevel: lead.intentLevel,
        sourceKey: lead.sourceKey,
      };
    }
  }
  sourceMapping ??= mapLegacyLeadSource({
    acquisitionChannel: lead.acquisitionChannel,
    source: lead.source,
    prospect: lead.prospect ? { placeId: lead.prospect.placeId } : null,
  });
  const importedLegacyInteractionIds = lead.prospect
    ? await transaction.leadInteraction.findMany({
        where: {
          legacyProspectInteractionId: {
            in: lead.prospect.interactions.map(({ id }) => id),
          },
        },
        select: { legacyProspectInteractionId: true },
      })
    : [];
  const importedIdSet = new Set(
    importedLegacyInteractionIds.flatMap(({ legacyProspectInteractionId }) =>
      legacyProspectInteractionId ? [legacyProspectInteractionId] : [],
    ),
  );
  const missingLegacyInteractions =
    lead.prospect?.interactions.filter(({ id }) => !importedIdSet.has(id))
      .length ?? 0;
  const latestProspectInteraction = lead.prospect?.interactions.at(-1);
  let stage = deriveLegacyLeadStage({
    paidAt:
      lead.agreements.find(
        (agreement) =>
          agreement.paymentStatus === "COMPLETED" && agreement.paidAt,
      )?.paidAt ?? null,
    status: lead.status,
    agreements: lead.agreements,
    prospectStatus: lead.prospect?.status,
    prospectInteractionCount: lead.prospect?.interactions.length ?? 0,
    latestProspectOutcome: latestProspectInteraction?.outcome,
  });
  const hasActiveAgreement = lead.agreements.some(({ status }) =>
    ["DRAFT", "SENT", "SIGNED"].includes(status),
  );
  if (
    compatibilityIsCurrent &&
    lead.stage &&
    !hasActiveAgreement &&
    missingLegacyInteractions === 0 &&
    stage !== "WON"
  ) {
    stage = lead.stage;
  }
  const replaced =
    Boolean(lead.prospect?.batch?.supersededAt) ||
    Boolean(lead.prospect?.cycle.supersededAt);
  const supersessionSafety = {
    stage,
    hasProspect: lead.prospect !== null,
    replaced,
    ownerId: lead.ownerId,
    legacyAssigneeCount: legacyAssigneeIds.length,
    canonicalInteractionCount: lead.interactions.length,
    prospectInteractionCount: lead.prospect?.interactions.length ?? 0,
  };
  const invalidatedBySupersession =
    shouldInvalidateLeadForSupersession(supersessionSafety);
  stage = stageAfterSupersession(supersessionSafety);

  const reviewReasons: string[] = [];
  let plannedExternalLeadId = lead.externalLeadId;
  if (lead.prospect) {
    const expectedExternalLeadId = `gplaces:${lead.prospect.placeId}`;
    if (lead.externalLeadId === null) {
      const collision = await transaction.contactSubmission.findFirst({
        where: {
          id: { not: lead.id },
          externalLeadId: expectedExternalLeadId,
        },
        select: { id: true },
      });
      if (collision) {
        reviewReasons.push("GOOGLE_EXTERNAL_ID_COLLISION");
      } else {
        plannedExternalLeadId = expectedExternalLeadId;
      }
    } else if (lead.externalLeadId !== expectedExternalLeadId) {
      reviewReasons.push("GOOGLE_EXTERNAL_ID_CONTRADICTION");
    }
  }
  const snapshot =
    sourceMapping === null
      ? null
      : canonicalSnapshot ??
        (isHistoricalSourceKey(sourceMapping.sourceKey)
          ? historicalSourceSnapshot(
              lead,
              sourceMapping.sourceKey,
              plannedExternalLeadId,
            )
          : null);
  if (!sourceMapping) reviewReasons.push("LEGACY_SOURCE_AMBIGUOUS");
  if (sourceMapping && !snapshot) {
    reviewReasons.push("LEGACY_SOURCE_CONTEXT_INCOMPLETE");
  }
  if (!stage) reviewReasons.push("LEGACY_STAGE_AMBIGUOUS");
  const activeAgreementCount = lead.agreements.filter(({ status }) =>
    ["DRAFT", "SENT", "SIGNED"].includes(status),
  ).length;
  if (activeAgreementCount > 1) {
    reviewReasons.push("ACTIVE_AGREEMENT_DUPLICATE");
  }

  const prospectSellerId =
    lead.prospect?.assignedSellerId ?? lead.prospect?.batch?.sellerId ?? null;
  const prospectSellerIsValid =
    !lead.prospect ||
    (lead.prospect.assignedSellerId
      ? lead.prospect.assignedSeller?.role === "SELLER"
      : lead.prospect.batch?.seller.role === "SELLER");
  let ownerId: string | null = null;
  let eligibleSellerId: string | null = null;
  let plannedAssigneeIds = legacyAssigneeIds;
  if (lead.prospect) {
    const canonicalOwnerIsValid =
      lead.ownerId !== null &&
      lead.owner?.role === "SELLER" &&
      lead.eligibleSellerId === lead.ownerId &&
      lead.eligibleSeller?.role === "SELLER";
    const singleLegacySeller =
      lead.assignees.length === 1 && lead.assignees[0]?.role === "SELLER"
        ? lead.assignees[0].id
        : null;
    ownerId = canonicalOwnerIsValid
      ? lead.ownerId
      : singleLegacySeller ??
        (lead.prospect.interactions.length > 0 ? prospectSellerId : null);
    eligibleSellerId = ownerId ?? prospectSellerId;
    plannedAssigneeIds = ownerId ? [ownerId] : [];
    const selectedSellerIsValid =
      canonicalOwnerIsValid ||
      singleLegacySeller !== null ||
      prospectSellerIsValid;
    if (!eligibleSellerId || !selectedSellerIsValid) {
      ownerId = null;
      eligibleSellerId = null;
      plannedAssigneeIds = [];
      reviewReasons.push("PROSPECT_SELLER_MISSING_OR_INVALID");
    }
  } else if (legacyAssigneeIds.length === 1) {
    ownerId = legacyAssigneeIds[0]!;
    eligibleSellerId = ownerId;
    plannedAssigneeIds = [ownerId];
  } else if (legacyAssigneeIds.length > 1) {
    plannedAssigneeIds = legacyAssigneeIds;
    reviewReasons.push("LEGACY_MULTI_ASSIGNEE");
  } else {
    eligibleSellerId = defaultSellerId;
    plannedAssigneeIds = [];
    if (!eligibleSellerId) reviewReasons.push("ELIGIBLE_SELLER_MISSING");
  }

  if (
    ownerId &&
    !lead.assignees.some(
      (assignee) => assignee.id === ownerId && assignee.role === "SELLER",
    ) &&
    ownerId !== prospectSellerId
  ) {
    ownerId = null;
    eligibleSellerId = null;
    plannedAssigneeIds = legacyAssigneeIds;
    reviewReasons.push("LEGACY_OWNER_NOT_SELLER");
  }

  const safeSource =
    sourceMapping && snapshot ? sourceMapping : null;
  const mirror = safeSource ? legacySourceMirror(safeSource.sourceKey) : null;
  const candidateFollowUpAt =
    lead.prospect?.nextFollowUpAt ?? lead.nextFollowUpAt;
  const nextFollowUpAt =
    stage === "WON" || stage === "LOST" || stage === "SPAM"
      ? null
      : candidateFollowUpAt;
  const lastContactedAt =
    latestProspectInteraction?.createdAt ??
    lead.prospect?.lastContactedAt ??
    lead.lastContactedAt;
  const paidAt =
    lead.agreements.find(
      (agreement) =>
        agreement.paymentStatus === "COMPLETED" && agreement.paidAt,
    )?.paidAt ?? null;
  const closedAt =
    stage === "WON"
      ? lead.closedAt ?? paidAt
      : stage === "LOST"
        ? lead.closedAt ?? latestProspectInteraction?.createdAt ?? null
        : lead.closedAt;
  const status = stage ? legacyStatusForStage(stage) : lead.status;
  const source = mirror?.source ?? lead.source;
  const acquisitionChannel =
    mirror?.acquisitionChannel ?? lead.acquisitionChannel;
  const finalFingerprint = legacyLeadStateHash({
    status,
    assigneeIds: plannedAssigneeIds,
    source,
    acquisitionChannel,
    externalLeadId: plannedExternalLeadId,
    externalFormId: lead.externalFormId,
    externalFormName: lead.externalFormName,
    externalCampaignId: lead.externalCampaignId,
    externalAdId: lead.externalAdId,
    nextFollowUpAt,
    lastContactedAt,
    closedAt,
  });
  const firstInteractionAt = lead.prospect?.interactions[0]?.createdAt ?? null;
  const doNotContactAt =
    [...(lead.prospect?.interactions ?? [])]
      .reverse()
      .find(({ outcome }) => outcome === "DO_NOT_CALL")?.createdAt ??
    lead.doNotContactAt;
  const suppressionSecret = process.env.PROSPECTING_HASH_SECRET?.trim();
  const suppressionActorId = ownerId ?? prospectSellerId;
  if (
    lead.prospect &&
    doNotContactAt &&
    (!suppressionSecret || !suppressionActorId)
  ) {
    reviewReasons.push("SUPPRESSION_EVIDENCE_INCOMPLETE");
  }
  const needsActiveFollowUp =
    Boolean(
      nextFollowUpAt &&
        nextFollowUpAt.getTime() > Date.now() &&
        ownerId &&
        (lead.status === "IN_PROGRESS" ||
          lead.prospect?.status === "FOLLOW_UP"),
    );
  const scheduledFollowUps = await transaction.leadFollowUp.findMany({
    where: { leadId: lead.id, status: "SCHEDULED" },
    select: { id: true, dueAt: true, ownerId: true },
    orderBy: { createdAt: "asc" },
  });
  if (scheduledFollowUps.length > 1) {
    reviewReasons.push("ACTIVE_FOLLOW_UP_DUPLICATE");
  }
  const activeFollowUp = scheduledFollowUps[0] ?? null;
  const activeFollowUpMatches =
    needsActiveFollowUp &&
    activeFollowUp !== null &&
    nextFollowUpAt !== null &&
    activeFollowUp.ownerId === ownerId &&
    activeFollowUp.dueAt.getTime() === nextFollowUpAt.getTime();
  const shouldCancelActiveFollowUp =
    shouldCancelScheduledFollowUpDuringBackfill({
      stage,
      hasScheduledFollowUp: activeFollowUp !== null,
      needsLegacyFollowUp: needsActiveFollowUp,
    });
  let suppressionExists = true;
  if (lead.prospect && doNotContactAt && suppressionSecret) {
    const domainHash = lead.prospect.auditedDomain
      ? hashSuppressionValue(
          normalizeDomain(lead.prospect.auditedDomain),
          suppressionSecret,
        )
      : null;
    suppressionExists = Boolean(
      await transaction.prospectSuppression.findFirst({
        where: {
          OR: [
            { placeId: lead.prospect.placeId },
            ...(domainHash ? [{ domainHash }] : []),
          ],
        },
        select: { id: true },
      }),
    );
  }
  const migrationReviewRequired = reviewReasons.length > 0;
  const lossReason =
    stage === "LOST"
      ? invalidatedBySupersession
        ? "BATCH_SUPERSEDED"
        : latestProspectInteraction?.outcome === "DO_NOT_CALL"
          ? "DO_NOT_CONTACT"
          : latestProspectInteraction?.outcome === "WRONG_NUMBER"
            ? "BAD_CONTACT"
            : latestProspectInteraction?.outcome === "NOT_INTERESTED"
              ? "NO_INTEREST"
              : lead.lossReason
      : lead.lossReason;

  const canonicalMatches =
    lead.legacyStateHash === finalFingerprint &&
    legacyFingerprint === finalFingerprint &&
    lead.intentLevel === (safeSource?.intentLevel ?? null) &&
    lead.sourceKey === (safeSource?.sourceKey ?? null) &&
    lead.stage === stage &&
    lead.ownerId === ownerId &&
    lead.eligibleSellerId === eligibleSellerId &&
    lead.migrationReviewRequired === migrationReviewRequired &&
    sameIds(legacyAssigneeIds, plannedAssigneeIds) &&
    missingLegacyInteractions === 0 &&
    scheduledFollowUps.length <= 1 &&
    (needsActiveFollowUp
      ? activeFollowUpMatches
      : shouldCancelActiveFollowUp
        ? activeFollowUp === null
        : true) &&
    suppressionExists &&
    lead.events.length === 1;
  if (canonicalMatches) {
    return {
      outcome: "unchanged",
      interactions: 0,
      followUps: 0,
      suppressions: 0,
    };
  }
  if (!apply) {
    return {
      outcome: "changed",
      interactions: missingLegacyInteractions,
      followUps:
        needsActiveFollowUp && !activeFollowUp ? 1 : 0,
      suppressions:
        lead.prospect &&
        doNotContactAt &&
        suppressionSecret &&
        suppressionActorId &&
        !suppressionExists
          ? 1
          : 0,
    };
  }

  let interactionsCreated = 0;
  let followUpsCreated = 0;
  let suppressionsCreated = 0;
  await transaction.contactSubmission.update({
    where: { id: lead.id },
    data: {
      intentLevel: safeSource?.intentLevel ?? null,
      sourceKey: safeSource?.sourceKey ?? null,
      sourceSnapshot: snapshot
        ? (snapshot as Prisma.InputJsonValue)
        : Prisma.DbNull,
      stage,
      externalLeadId: plannedExternalLeadId,
      ownerId,
      eligibleSellerId,
      firstClaimedAt: ownerId
        ? lead.firstClaimedAt ?? firstInteractionAt ?? lead.createdAt
        : lead.firstClaimedAt,
      ownerAssignedAt: ownerId
        ? lead.ownerAssignedAt ?? firstInteractionAt ?? lead.createdAt
        : null,
      firstContactedAt: lead.firstContactedAt ?? firstInteractionAt,
      lastContactedAt,
      doNotContactAt,
      nextFollowUpAt,
      closedAt,
      wonAt: stage === "WON" ? lead.wonAt ?? paidAt : lead.wonAt,
      lostAt:
        stage === "LOST"
          ? lead.lostAt ?? closedAt ?? lead.createdAt
          : lead.lostAt,
      lossReason,
      status,
      source,
      acquisitionChannel,
      migrationReviewRequired,
      migrationReviewReason: reviewReasons.join(",") || null,
      assignees: { set: plannedAssigneeIds.map((id) => ({ id })) },
      legacyStateHash: finalFingerprint,
    },
  });

  if (lead.prospect) {
    for (const interaction of lead.prospect.interactions) {
      const mapped = mapLegacyProspectInteraction(interaction);
      const result = await transaction.leadInteraction.createMany({
        data: {
          leadId: lead.id,
          authorId: interaction.authorId,
          ...mapped,
        },
        skipDuplicates: true,
      });
      interactionsCreated += result.count;
    }
  }

  if (
    needsActiveFollowUp &&
    nextFollowUpAt &&
    ownerId &&
    scheduledFollowUps.length <= 1
  ) {
    if (activeFollowUp) {
      if (!activeFollowUpMatches) {
        await transaction.leadFollowUp.update({
          where: { id: activeFollowUp.id },
          data: {
            ownerId,
            dueAt: nextFollowUpAt,
            reason: "Legacy active follow-up migration",
            reminderSentAt: null,
          },
        });
      }
    } else {
      await transaction.leadFollowUp.create({
        data: {
          leadId: lead.id,
          ownerId,
          createdById: ownerId,
          dueAt: nextFollowUpAt,
          reason: "Legacy active follow-up migration",
        },
      });
      followUpsCreated += 1;
    }
  } else if (
    shouldCancelActiveFollowUp &&
    activeFollowUp &&
    scheduledFollowUps.length === 1
  ) {
    await transaction.leadFollowUp.update({
      where: { id: activeFollowUp.id },
      data: { status: "CANCELLED", cancelledAt: new Date() },
    });
  }

  if (lead.prospect && doNotContactAt) {
    if (suppressionSecret && suppressionActorId && !suppressionExists) {
      const domainHash = lead.prospect.auditedDomain
        ? hashSuppressionValue(
            normalizeDomain(lead.prospect.auditedDomain),
            suppressionSecret,
          )
        : null;
      await transaction.prospectSuppression.create({
        data: {
          placeId: lead.prospect.placeId,
          domainHash,
          reason: "Legacy DO_NOT_CALL migration",
          sourceProspectId: lead.prospect.id,
          createdById: suppressionActorId,
        },
      });
      suppressionsCreated += 1;
    }
  }

  await appendLeadEventOnce(transaction, {
    leadId: lead.id,
    type: "MIGRATED",
    actor: { type: "SYSTEM" },
    fromStage: lead.stage,
    toStage: stage,
    occurredAt: new Date(),
    dedupeKey: `lead:${lead.id}:unified-lifecycle-backfill:v${MIGRATION_VERSION}`,
    metadata: {
      action: "UNIFIED_LEAD_LIFECYCLE_BACKFILL",
      version: MIGRATION_VERSION,
      reviewRequired: migrationReviewRequired,
      legacyNoteIds: lead.notes.map(({ id }) => id),
      legacyNoteHistoryHash: noteHistoryHash(lead.notes),
    },
  });
  return {
    outcome: "changed",
    interactions: interactionsCreated,
    followUps: followUpsCreated,
    suppressions: suppressionsCreated,
  };
}

async function processLead(
  leadId: string,
  defaultSellerId: string | null,
): Promise<void> {
  const result = await serializableRow("LEAD", leadId, async (transaction) => {
    await lockLead(transaction, leadId);
    return synchronizeLockedLead(transaction, leadId, defaultSellerId);
  });
  counters.examined += 1;
  if (!result) return;
  counters[result.outcome] += 1;
  counters.interactions += result.interactions;
  counters.followUps += result.followUps;
  counters.suppressions += result.suppressions;
}

async function ensurePublishedProspectLead(
  prospectId: string,
  defaultSellerId: string | null,
): Promise<string | null> {
  const result = await serializableRow(
    "PROSPECT",
    prospectId,
    async (transaction): Promise<{
      leadId: string | null;
      created: boolean;
      sync: LeadSyncResult | null;
    }> => {
    const prospect = await transaction.prospect.findUnique({
      where: { id: prospectId },
      include: {
        batch: true,
        cycle: {
          include: {
            proposals: {
              where: { status: "APPROVED" },
              orderBy: { approvedAt: "desc" },
              take: 1,
            },
          },
        },
      },
    });
    if (!prospect) throw new Error(`Prospect ${prospectId} disappeared`);
    const externalLeadId = `gplaces:${prospect.placeId}`;
    const matched = prospect.promotedLeadId
      ? { id: prospect.promotedLeadId }
      : await transaction.contactSubmission.findFirst({
          where: {
            OR: [
              { sourceKey: "google_maps", externalLeadId },
              { externalLeadId },
            ],
          },
          select: { id: true },
        });

    let leadId = matched?.id ?? null;
    let createdByBackfill = false;
    if (!leadId) {
      if (!apply) return { leadId: null, created: true, sync: null };
      const sellerId =
        prospect.assignedSellerId ?? prospect.batch?.sellerId ?? defaultSellerId;
      const mirror = legacySourceMirror("google_maps");
      const createdAt = prospect.publishedAt ?? prospect.createdAt;
      const legacyStateHash = legacyLeadStateHash({
        status: "NEW",
        assigneeIds: [],
        source: mirror.source,
        acquisitionChannel: mirror.acquisitionChannel,
        externalLeadId,
        externalFormId: null,
        externalFormName: null,
        externalCampaignId: null,
        externalAdId: null,
        nextFollowUpAt: prospect.nextFollowUpAt,
        lastContactedAt: prospect.lastContactedAt,
        closedAt: null,
      });
      const created = await transaction.contactSubmission.create({
        data: {
          company: null,
          status: "NEW",
          tags: [],
          source: mirror.source,
          acquisitionChannel: mirror.acquisitionChannel,
          externalLeadId,
          eligibleSellerId: sellerId,
          migrationReviewRequired: true,
          migrationReviewReason: "PROSPECT_SOURCE_CONTEXT_PENDING",
          legacyStateHash,
          nextFollowUpAt: prospect.nextFollowUpAt,
          lastContactedAt: prospect.lastContactedAt,
          createdAt,
        },
      });
      leadId = created.id;
      createdByBackfill = true;
    }

    await lockLead(transaction, leadId);
    if (apply && prospect.promotedLeadId !== leadId) {
      await transaction.prospect.update({
        where: { id: prospect.id },
        data: { promotedLeadId: leadId },
      });
    }
    const sync = await synchronizeLockedLead(
      transaction,
      leadId,
      defaultSellerId,
    );
    if (apply && createdByBackfill) {
      await appendLeadEventOnce(transaction, {
        leadId,
        type: "MIGRATED",
        actor: { type: "SYSTEM" },
        occurredAt: prospect.publishedAt ?? prospect.createdAt,
        dedupeKey: `lead:${leadId}:prospect-created-by-backfill:v${MIGRATION_VERSION}`,
        metadata: {
          action: "PUBLISHED_PROSPECT_LEAD_CREATED",
          version: MIGRATION_VERSION,
          prospectId: prospect.id,
          cycleId: prospect.cycleId,
        },
      });
    }
    return { leadId, created: createdByBackfill, sync };
    },
  );
  if (!result) return null;
  if (result.created) counters.created += 1;
  if (!result.sync) return result.leadId;
  counters.examined += 1;
  counters[result.sync.outcome] += 1;
  counters.interactions += result.sync.interactions;
  counters.followUps += result.sync.followUps;
  counters.suppressions += result.sync.suppressions;
  return result.leadId;
}

async function backfillAgreementCredit(agreementId: string): Promise<void> {
  const filled = await serializableRow("AGREEMENT", agreementId, async (transaction) => {
    const agreement = await transaction.agreement.findUnique({
      where: { id: agreementId },
      include: {
        commission: true,
        lead: { select: { id: true, stage: true } },
      },
    });
    if (!agreement || agreement.creditedSellerId) return false;
    let sellerId: string | null = null;
    if (agreement.commission) {
      const commissionSeller = await transaction.user.findFirst({
        where: { id: agreement.commission.sellerId, role: "SELLER" },
        select: { id: true },
      });
      sellerId = commissionSeller?.id ?? null;
    }
    if (!sellerId && agreement.isSellerDeal) {
      const creator = await transaction.user.findFirst({
        where: { id: agreement.createdBy, role: "SELLER" },
        select: { id: true },
      });
      sellerId = creator?.id ?? null;
    }
    if (!sellerId) return false;
    if (apply) {
      await transaction.agreement.update({
        where: { id: agreement.id },
        data: { creditedSellerId: sellerId },
      });
      if (agreement.lead) {
        await appendLeadEventOnce(transaction, {
          leadId: agreement.lead.id,
          type: "MIGRATED",
          actor: { type: "SYSTEM" },
          fromStage: agreement.lead.stage,
          toStage: agreement.lead.stage,
          dedupeKey: `lead:${agreement.lead.id}:agreement-credit-backfill:${agreement.id}:v${MIGRATION_VERSION}`,
          metadata: {
            action: "AGREEMENT_CREDIT_BACKFILLED",
            agreementId: agreement.id,
            sellerId,
            version: MIGRATION_VERSION,
          },
        });
      }
    }
    return true;
  });
  if (filled) counters.creditsFilled += 1;
}

async function backfillCommissionLink(commissionId: string): Promise<void> {
  const result = await serializableRow(
    "COMMISSION",
    commissionId,
    async (
      transaction,
    ): Promise<"linked" | "orphan" | "conflict" | "unchanged"> => {
    const commission = await transaction.sellerCommission.findUnique({
      where: { id: commissionId },
    });
    if (!commission) return "unchanged";
    const agreement = await transaction.agreement.findUnique({
      where: { id: commission.agreementId },
      select: {
        id: true,
        lead: { select: { id: true, stage: true } },
      },
    });
    if (!agreement) {
      return commission.agreementLinkStatus ? "unchanged" : "orphan";
    }
    if (
      commission.agreementLinkStatus === "LINKED" &&
      commission.agreementRefId === agreement.id
    ) {
      return "unchanged";
    }
    if (
      commission.agreementLinkStatus &&
      (commission.agreementLinkStatus !== "LINKED" ||
        commission.agreementRefId !== agreement.id)
    ) {
      return "conflict";
    }
    if (apply) {
      await transaction.sellerCommission.update({
        where: { id: commission.id },
        data: {
          agreementRefId: agreement.id,
          agreementLinkStatus: "LINKED",
        },
      });
      if (agreement.lead) {
        await appendLeadEventOnce(transaction, {
          leadId: agreement.lead.id,
          type: "MIGRATED",
          actor: { type: "SYSTEM" },
          fromStage: agreement.lead.stage,
          toStage: agreement.lead.stage,
          dedupeKey: `lead:${agreement.lead.id}:commission-link-backfill:${commission.id}:v${MIGRATION_VERSION}`,
          metadata: {
            action: "HISTORICAL_COMMISSION_LINKED",
            agreementId: agreement.id,
            commissionId: commission.id,
            version: MIGRATION_VERSION,
          },
        });
      }
    }
    return "linked";
    },
  );
  if (result === "linked") counters.commissionsLinked += 1;
  if (result === "orphan" || result === "conflict") {
    counters.unresolved.push({
      kind: "COMMISSION",
      id: commissionId,
      reason:
        result === "orphan"
          ? "ORPHAN_SELLER_COMMISSION"
          : "CONFLICTING_COMMISSION_CLASSIFICATION",
    });
  }
}

function settingSellerId(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function resolveDefaultSellerId(): Promise<string | null> {
  for (const key of [
    "sales:defaultSellerId",
    "prospecting:defaultSellerId",
  ]) {
    const setting = await prisma.keyValue.findUnique({
      where: { key },
      select: { value: true },
    });
    const id = settingSellerId(setting?.value);
    if (!id) continue;
    const seller = await prisma.user.findFirst({
      where: { id, role: "SELLER" },
      select: { id: true },
    });
    if (seller) return seller.id;
  }
  return null;
}

async function ensureMigrationBaseline(): Promise<void> {
  if (!apply) return;
  await prisma.$transaction(
    async (transaction) => {
      const existing = await transaction.keyValue.findUnique({
        where: { key: BASELINE_KEY },
        select: { key: true },
      });
      if (existing) return;
      const baseline = await captureMigrationBaseline(
        {
          async loadLeadIds() {
            const leads = await transaction.contactSubmission.findMany({
              select: { id: true },
              orderBy: { id: "asc" },
            });
            return leads.map(({ id }) => id);
          },
          async loadNotes() {
            return transaction.contactNote.findMany({
              select: {
                id: true,
                contactId: true,
                authorId: true,
                createdAt: true,
              },
              orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            });
          },
        },
        { version: MIGRATION_VERSION },
      );
      await transaction.keyValue.create({
        data: {
          key: BASELINE_KEY,
          value: baseline as unknown as Prisma.InputJsonValue,
        },
      });
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 30_000,
      timeout: 300_000,
    },
  );
}

async function main(): Promise<void> {
  console.log(`mode: ${apply ? "APPLY" : "DRY RUN"}`);
  await ensureMigrationBaseline();
  const [leadIds, prospectIds, agreementIds, commissionIds, notesBefore] =
    await Promise.all([
      prisma.contactSubmission.findMany({
        select: { id: true },
        orderBy: { id: "asc" },
      }),
      prisma.prospect.findMany({
        where: {
          OR: [
            { publishedAt: { not: null } },
            { promotedLeadId: { not: null } },
            {
              status: {
                in: [
                  "PUBLISHED",
                  "FOLLOW_UP",
                  "QUALIFIED",
                  "NOT_INTERESTED",
                  "DO_NOT_CALL",
                ],
              },
            },
          ],
        },
        select: { id: true },
        orderBy: { id: "asc" },
      }),
      prisma.agreement.findMany({
        select: { id: true },
        orderBy: { id: "asc" },
      }),
      prisma.sellerCommission.findMany({
        select: { id: true },
        orderBy: { id: "asc" },
      }),
      prisma.contactNote.count(),
    ]);
  console.log(
    `input counts: leads=${leadIds.length} publishedProspects=${prospectIds.length} agreements=${agreementIds.length} commissions=${commissionIds.length} notes=${notesBefore}`,
  );
  const defaultSellerId = await resolveDefaultSellerId();

  const prospectLeadIds = new Set<string>();
  for (const { id } of prospectIds) {
    const leadId = await ensurePublishedProspectLead(id, defaultSellerId);
    if (leadId) prospectLeadIds.add(leadId);
  }
  for (const { id } of leadIds) {
    if (!prospectLeadIds.has(id)) await processLead(id, defaultSellerId);
  }
  for (const { id } of agreementIds) await backfillAgreementCredit(id);
  for (const { id } of commissionIds) await backfillCommissionLink(id);

  const notesAfter = await prisma.contactNote.count();
  if (notesAfter !== notesBefore) {
    counters.unresolved.push({
      kind: "HISTORY",
      id: "ContactNote",
      reason: `CONTACT_NOTE_COUNT_CHANGED:${notesBefore}->${notesAfter}`,
    });
  }
  console.log(
    `result counts: examined=${counters.examined} changed=${counters.changed} unchanged=${counters.unchanged} prospectLeads=${counters.created} interactions=${counters.interactions} followUps=${counters.followUps} suppressions=${counters.suppressions} commissionLinks=${counters.commissionsLinked} credits=${counters.creditsFilled}`,
  );
  for (const unresolved of counters.unresolved) {
    console.error(
      `UNRESOLVED ${unresolved.kind} ${unresolved.id}: ${unresolved.reason}`,
    );
  }
  if (counters.unresolved.length > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
