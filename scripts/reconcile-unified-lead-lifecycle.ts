import { Prisma, PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";

import { legacyLeadStateHash } from "@/lib/leads/legacy-compat";
import { verifiedFirstPaymentEvidence } from "@/lib/leads/payment-verification";
import {
  baselineNoteHistoryIsIntact,
  missingBaselineLeadIds,
  parseMigrationBaseline,
  shouldRequireBackfillNoteSnapshot,
} from "./unified-lead-lifecycle-safety";

const prisma = new PrismaClient();
const BASELINE_KEY = "migration:unified-lead-lifecycle:v1:baseline";

type RemediationClass =
  | "SOURCE_OR_OWNERSHIP_REVIEW"
  | "ACTIVE_AGREEMENT_DUPLICATE"
  | "ACTIVE_FOLLOW_UP_DUPLICATE"
  | "MISSING_AGREEMENT_CREDIT"
  | "ORPHAN_SELLER_AGREEMENT"
  | "ORPHAN_SELLER_COMMISSION"
  | "COUNT_OR_HISTORY_MISMATCH";

interface Invariant {
  name: string;
  failures: number;
  remediation: RemediationClass;
  details?: string;
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

function eventMetadata(
  value: Prisma.JsonValue | null,
): Record<string, Prisma.JsonValue> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, Prisma.JsonValue>)
    : null;
}

async function scalarCount(query: Prisma.Sql): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>(query);
  return Number(rows[0]?.count ?? 0);
}

async function main(): Promise<void> {
  console.log("mode: READ ONLY RECONCILIATION");
  const invariants: Invariant[] = [];
  const [leads, prospects, contactNoteCount, prospectInteractionCount, baselineRow] =
    await Promise.all([
      prisma.contactSubmission.findMany({
        include: {
          assignees: { select: { id: true } },
          notes: {
            select: { id: true, authorId: true, createdAt: true },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          },
          events: {
            where: {
              type: "MIGRATED",
              dedupeKey: { endsWith: ":unified-lifecycle-backfill:v1" },
            },
            select: { metadata: true },
            take: 1,
          },
          agreements: {
            select: {
              id: true,
              paymentId: true,
              paymentStatus: true,
              paidAt: true,
              paidAmount: true,
              cardcomDealId: true,
              cardcomVerifiedLowProfileId: true,
              cardcomVerifiedReturnValue: true,
              cardcomVerifiedTransactionId: true,
              cardcomVerifiedAmount: true,
              cardcomPaymentVerifiedAt: true,
            },
          },
        },
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
        select: {
          id: true,
          placeId: true,
          promotedLeadId: true,
        },
        orderBy: { id: "asc" },
      }),
      prisma.contactNote.count(),
      prisma.prospectInteraction.count({
        where: {
          prospect: {
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
        },
      }),
      prisma.keyValue.findUnique({
        where: { key: BASELINE_KEY },
        select: { value: true },
      }),
    ]);
  const baseline = parseMigrationBaseline(baselineRow?.value);
  const baselineLeadIds = new Set(
    baseline?.contactSubmissionIds ?? [],
  );
  const leadsById = new Map(leads.map((lead) => [lead.id, lead]));
  const leadsByExternalId = new Map<string, typeof leads>();
  for (const lead of leads) {
    if (!lead.externalLeadId) continue;
    const bucket = leadsByExternalId.get(lead.externalLeadId) ?? [];
    bucket.push(lead);
    leadsByExternalId.set(lead.externalLeadId, bucket);
  }

  let badPublishedProspects = 0;
  for (const prospect of prospects) {
    const expectedExternalId = `gplaces:${prospect.placeId}`;
    const matches = leadsByExternalId.get(expectedExternalId) ?? [];
    const promoted = prospect.promotedLeadId
      ? leadsById.get(prospect.promotedLeadId)
      : null;
    if (
      matches.length !== 1 ||
      !promoted ||
      promoted.id !== matches[0]?.id ||
      promoted.intentLevel !== "OUTBOUND" ||
      promoted.sourceKey !== "google_maps"
    ) {
      badPublishedProspects += 1;
    }
  }
  invariants.push({
    name: "PUBLISHED_PROSPECT_EXACTLY_ONE_OUTBOUND_LEAD",
    failures: badPublishedProspects,
    remediation: "COUNT_OR_HISTORY_MISMATCH",
  });

  invariants.push({
    name: "DUPLICATE_SOURCE_EXTERNAL_ID",
    failures: await scalarCount(Prisma.sql`
      SELECT COUNT(*)::bigint AS "count"
      FROM (
        SELECT "sourceKey", "externalLeadId"
        FROM "ContactSubmission"
        WHERE "sourceKey" IS NOT NULL AND "externalLeadId" IS NOT NULL
        GROUP BY "sourceKey", "externalLeadId"
        HAVING COUNT(*) > 1
      ) duplicate_pairs
    `),
    remediation: "COUNT_OR_HISTORY_MISMATCH",
  });
  invariants.push({
    name: "DUPLICATE_LEGACY_PROSPECT_INTERACTION",
    failures: await scalarCount(Prisma.sql`
      SELECT COUNT(*)::bigint AS "count"
      FROM (
        SELECT "legacyProspectInteractionId"
        FROM "LeadInteraction"
        WHERE "legacyProspectInteractionId" IS NOT NULL
        GROUP BY "legacyProspectInteractionId"
        HAVING COUNT(*) > 1
      ) duplicate_interactions
    `),
    remediation: "COUNT_OR_HISTORY_MISMATCH",
  });

  const incompleteLeads = leads.filter(
    (lead) => !lead.intentLevel || !lead.sourceKey || !lead.stage,
  ).length;
  invariants.push({
    name: "LEAD_CANONICAL_FIELDS_COMPLETE",
    failures: incompleteLeads,
    remediation: "SOURCE_OR_OWNERSHIP_REVIEW",
  });
  invariants.push({
    name: "MIGRATION_REVIEW_CLEARED",
    failures: leads.filter((lead) => lead.migrationReviewRequired).length,
    remediation: "SOURCE_OR_OWNERSHIP_REVIEW",
  });

  let hashMismatches = 0;
  let ownershipMismatches = 0;
  let wonWithoutPayment = 0;
  let paymentWithoutWon = 0;
  let unverifiedPaymentWithoutReview = 0;
  for (const lead of leads) {
    const assigneeIds = lead.assignees.map(({ id }) => id);
    const expectedHash = legacyLeadStateHash({
      status: lead.status,
      assigneeIds,
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
    if (lead.legacyStateHash !== expectedHash) hashMismatches += 1;
    if (
      assigneeIds.length > 1 ||
      (lead.ownerId !== null &&
        (assigneeIds.length !== 1 ||
          assigneeIds[0] !== lead.ownerId ||
          lead.eligibleSellerId !== lead.ownerId)) ||
      (lead.ownerId === null && assigneeIds.length !== 0)
    ) {
      ownershipMismatches += 1;
    }
    const hasVerifiedFirstPayment = lead.agreements.some(
      (agreement) => verifiedFirstPaymentEvidence(agreement) !== null,
    );
    const hasUnverifiedFirstPayment = lead.agreements.some(
      (agreement) =>
        (agreement.paymentStatus === "COMPLETED" ||
          agreement.paidAt !== null) &&
        verifiedFirstPaymentEvidence(agreement) === null,
    );
    if (hasUnverifiedFirstPayment && !lead.migrationReviewRequired) {
      unverifiedPaymentWithoutReview += 1;
    }
    if (
      (lead.status === "CLOSED" || lead.stage === "WON") &&
      !hasVerifiedFirstPayment
    ) {
      wonWithoutPayment += 1;
    }
    if (
      hasVerifiedFirstPayment &&
      (lead.status !== "CLOSED" || lead.stage !== "WON")
    ) {
      paymentWithoutWon += 1;
    }
  }
  invariants.push({
    name: "LEGACY_STATE_HASH_MATCHES",
    failures: hashMismatches,
    remediation: "COUNT_OR_HISTORY_MISMATCH",
  });
  invariants.push({
    name: "OWNERSHIP_IS_UNAMBIGUOUS",
    failures: ownershipMismatches,
    remediation: "SOURCE_OR_OWNERSHIP_REVIEW",
  });
  invariants.push({
    name: "CLOSED_OR_WON_HAS_VERIFIED_FIRST_PAYMENT",
    failures: wonWithoutPayment,
    remediation: "ORPHAN_SELLER_AGREEMENT",
  });
  invariants.push({
    name: "VERIFIED_FIRST_PAYMENT_IS_WON",
    failures: paymentWithoutWon,
    remediation: "ORPHAN_SELLER_AGREEMENT",
  });
  invariants.push({
    name: "UNVERIFIED_FIRST_PAYMENT_REQUIRES_REVIEW",
    failures: unverifiedPaymentWithoutReview,
    remediation: "ORPHAN_SELLER_AGREEMENT",
  });

  invariants.push({
    name: "ONE_ACTIVE_AGREEMENT_PER_LEAD",
    failures: await scalarCount(Prisma.sql`
      SELECT COUNT(*)::bigint AS "count"
      FROM (
        SELECT "leadId"
        FROM "Agreement"
        WHERE "leadId" IS NOT NULL
          AND "status" IN ('DRAFT', 'SENT', 'SIGNED')
        GROUP BY "leadId"
        HAVING COUNT(*) > 1
      ) duplicate_agreements
    `),
    remediation: "ACTIVE_AGREEMENT_DUPLICATE",
  });
  invariants.push({
    name: "ONE_SCHEDULED_FOLLOW_UP_PER_LEAD",
    failures: await scalarCount(Prisma.sql`
      SELECT COUNT(*)::bigint AS "count"
      FROM (
        SELECT "leadId"
        FROM "LeadFollowUp"
        WHERE "status" = 'SCHEDULED'
        GROUP BY "leadId"
        HAVING COUNT(*) > 1
      ) duplicate_follow_ups
    `),
    remediation: "ACTIVE_FOLLOW_UP_DUPLICATE",
  });

  invariants.push({
    name: "SELLER_AGREEMENT_HAS_VALID_LEAD_RELATION",
    failures: await scalarCount(Prisma.sql`
      SELECT COUNT(*)::bigint AS "count"
      FROM "Agreement" agreement
      LEFT JOIN "ContactSubmission" lead ON lead."id" = agreement."leadId"
      WHERE agreement."isSellerDeal" = TRUE
        AND (agreement."leadId" IS NULL OR lead."id" IS NULL)
    `),
    remediation: "ORPHAN_SELLER_AGREEMENT",
  });
  invariants.push({
    name: "SELLER_DEAL_HAS_CREDITED_SELLER",
    failures: await scalarCount(Prisma.sql`
      SELECT COUNT(*)::bigint AS "count"
      FROM "Agreement"
      WHERE "isSellerDeal" = TRUE AND "creditedSellerId" IS NULL
    `),
    remediation: "MISSING_AGREEMENT_CREDIT",
  });

  invariants.push({
    name: "COMMISSION_LINK_IS_CLASSIFIED_AND_VALID",
    failures: await scalarCount(Prisma.sql`
      SELECT COUNT(*)::bigint AS "count"
      FROM "SellerCommission" commission
      LEFT JOIN "Agreement" agreement
        ON agreement."id" = commission."agreementRefId"
      WHERE commission."agreementLinkStatus" IS NULL
         OR (
           commission."agreementLinkStatus" = 'LINKED'
           AND (
             commission."agreementRefId" IS NULL
             OR agreement."id" IS NULL
           )
         )
         OR (
           commission."agreementLinkStatus" = 'LEGACY_ORPHAN'
           AND (
             commission."agreementRefId" IS NOT NULL
             OR commission."agreementLinkReviewedAt" IS NULL
             OR commission."agreementLinkReviewedById" IS NULL
             OR NULLIF(BTRIM(commission."agreementLinkReviewReason"), '') IS NULL
           )
         )
    `),
    remediation: "ORPHAN_SELLER_COMMISSION",
  });

  const migratedLegacyInteractionCount = await prisma.leadInteraction.count({
    where: { legacyProspectInteractionId: { not: null } },
  });
  const mislinkedLegacyInteractions = await scalarCount(Prisma.sql`
    SELECT COUNT(*)::bigint AS "count"
    FROM "ProspectInteraction" legacy
    INNER JOIN "Prospect" prospect ON prospect."id" = legacy."prospectId"
    LEFT JOIN "LeadInteraction" canonical
      ON canonical."legacyProspectInteractionId" = legacy."id"
    WHERE (
      prospect."publishedAt" IS NOT NULL
      OR prospect."promotedLeadId" IS NOT NULL
      OR prospect."status" IN (
        'PUBLISHED',
        'FOLLOW_UP',
        'QUALIFIED',
        'NOT_INTERESTED',
        'DO_NOT_CALL'
      )
    )
      AND (
        canonical."id" IS NULL
        OR canonical."leadId" IS DISTINCT FROM prospect."promotedLeadId"
      )
  `);
  invariants.push({
    name: "PROSPECT_INTERACTION_HISTORY_COUNT_MATCHES",
    failures: Math.max(
      Math.abs(
        prospectInteractionCount - migratedLegacyInteractionCount,
      ),
      mislinkedLegacyInteractions,
    ),
    remediation: "COUNT_OR_HISTORY_MISMATCH",
    details: `legacy=${prospectInteractionCount} canonical=${migratedLegacyInteractionCount} missingOrMislinked=${mislinkedLegacyInteractions}`,
  });
  const invalidNotes = await scalarCount(Prisma.sql`
    SELECT COUNT(*)::bigint AS "count"
    FROM "ContactNote" note
    LEFT JOIN "ContactSubmission" lead ON lead."id" = note."contactId"
    LEFT JOIN "User" author ON author."id" = note."authorId"
    WHERE lead."id" IS NULL OR author."id" IS NULL OR note."createdAt" IS NULL
  `);
  const currentNotes = leads.flatMap((lead) =>
    lead.notes.map((note) => ({ ...note, contactId: lead.id })),
  );
  const baselineNoteHistoryFailure =
    baseline && baselineNoteHistoryIsIntact(baseline, currentNotes) ? 0 : 1;
  let changedLegacyNoteHistory = 0;
  for (const lead of leads) {
    if (
      !baseline ||
      !shouldRequireBackfillNoteSnapshot(baseline, lead.id)
    ) {
      continue;
    }
    const metadata = eventMetadata(lead.events[0]?.metadata ?? null);
    const legacyNoteIds = Array.isArray(metadata?.legacyNoteIds)
      ? metadata.legacyNoteIds.filter(
          (value): value is string => typeof value === "string",
        )
      : null;
    const expectedHash =
      typeof metadata?.legacyNoteHistoryHash === "string"
        ? metadata.legacyNoteHistoryHash
        : null;
    if (!legacyNoteIds || !expectedHash) {
      changedLegacyNoteHistory += 1;
      continue;
    }
    const legacyIdSet = new Set(legacyNoteIds);
    const originalNotes = lead.notes.filter(({ id }) => legacyIdSet.has(id));
    if (
      originalNotes.length !== legacyNoteIds.length ||
      noteHistoryHash(originalNotes) !== expectedHash
    ) {
      changedLegacyNoteHistory += 1;
    }
  }
  invariants.push({
    name: "CONTACT_NOTE_HISTORY_INTACT",
    failures:
      invalidNotes +
      baselineNoteHistoryFailure +
      changedLegacyNoteHistory,
    remediation: "COUNT_OR_HISTORY_MISMATCH",
    details: `count=${contactNoteCount} baseline=${baseline ? baseline.contactNoteCount : "MISSING"} invalid=${invalidNotes} baselineChanged=${baselineNoteHistoryFailure} changedLegacyHistory=${changedLegacyNoteHistory}`,
  });

  const createdProspectLeadRows = await prisma.$queryRaw<
    Array<{ leadId: string }>
  >(Prisma.sql`
    SELECT DISTINCT event."leadId" AS "leadId"
    FROM "LeadEvent" event
    INNER JOIN "ContactSubmission" lead ON lead."id" = event."leadId"
    WHERE event."type" = 'MIGRATED'
      AND event."dedupeKey" LIKE '%:prospect-created-by-backfill:v1'
  `);
  const createdProspectLeadIds = new Set(
    createdProspectLeadRows.map(({ leadId }) => leadId),
  );
  const missingPreBackfillLeads = baseline
    ? missingBaselineLeadIds(
        baseline,
        leads.map(({ id }) => id),
      )
    : [];
  const newNonProspectLeads = leads.filter(
    ({ id }) =>
      !baselineLeadIds.has(id) &&
      !createdProspectLeadIds.has(id),
  ).length;
  const expectedPostBackfillLeadCount =
    baseline === null
      ? null
      : baseline.contactSubmissionCount +
        createdProspectLeadIds.size +
        newNonProspectLeads;
  const leadCountMismatch =
    expectedPostBackfillLeadCount === null ||
    leads.length !== expectedPostBackfillLeadCount;
  invariants.push({
    name: "LEAD_COUNT_INVARIANT",
    failures: baseline
      ? Math.max(missingPreBackfillLeads.length, leadCountMismatch ? 1 : 0)
      : 1,
    remediation: "COUNT_OR_HISTORY_MISMATCH",
    details: `post=${leads.length} capturedPre=${baseline?.contactSubmissionCount ?? "MISSING"} missingPre=${missingPreBackfillLeads.length} newPublishedProspects=${createdProspectLeadIds.size} newNonProspect=${newNonProspectLeads}`,
  });

  let totalFailures = 0;
  for (const invariant of invariants) {
    totalFailures += invariant.failures;
    const status = invariant.failures === 0 ? "PASS" : "FAIL";
    console.log(
      `${status} ${invariant.name}: failures=${invariant.failures} remediation=${invariant.remediation}${invariant.details ? ` ${invariant.details}` : ""}`,
    );
  }
  console.log(
    `summary: invariants=${invariants.length} failures=${totalFailures}`,
  );
  if (totalFailures > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
