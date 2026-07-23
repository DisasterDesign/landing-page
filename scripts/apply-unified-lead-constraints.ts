import { Prisma, PrismaClient } from "@prisma/client";

import { legacyLeadStateHash } from "@/lib/leads/legacy-compat";

const prisma = new PrismaClient();
const apply = process.env.APPLY === "1";

interface ConstraintPreflightResult {
  incompleteLeads: number;
  reviewRequiredLeads: number;
  hashMismatches: number;
  invalidCommissionClassifications: number;
  externalLeadIdCollisions: number;
  compositeIndexExists: boolean;
}

async function scalarCount(query: Prisma.Sql): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>(query);
  return Number(rows[0]?.count ?? 0);
}

export async function runUnifiedLeadConstraintsPreflight(): Promise<ConstraintPreflightResult> {
  const [
    incompleteLeads,
    reviewRequiredLeads,
    invalidCommissionClassifications,
    externalLeadIdCollisions,
    compositeIndexes,
    leads,
  ] = await Promise.all([
    prisma.contactSubmission.count({
      where: {
        OR: [
          { intentLevel: null },
          { sourceKey: null },
          { stage: null },
        ],
      },
    }),
    prisma.contactSubmission.count({
      where: { migrationReviewRequired: true },
    }),
    scalarCount(Prisma.sql`
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
    scalarCount(Prisma.sql`
      SELECT COUNT(*)::bigint AS "count"
      FROM (
        SELECT "externalLeadId"
        FROM "ContactSubmission"
        WHERE "externalLeadId" IS NOT NULL
        GROUP BY "externalLeadId"
        HAVING COUNT(*) > 1
      ) collisions
    `),
    prisma.$queryRaw<Array<{ indexname: string; indexdef: string }>>(Prisma.sql`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = ANY(current_schemas(false))
        AND tablename = 'ContactSubmission'
        AND indexname = 'Lead_source_external_unique'
    `),
    prisma.contactSubmission.findMany({
      include: { assignees: { select: { id: true } } },
      orderBy: { id: "asc" },
    }),
  ]);

  let hashMismatches = 0;
  for (const lead of leads) {
    const expected = legacyLeadStateHash({
      status: lead.status,
      assigneeIds: lead.assignees.map(({ id }) => id),
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
    if (lead.legacyStateHash !== expected) hashMismatches += 1;
  }
  const compositeIndexExists =
    compositeIndexes.length === 1 &&
    compositeIndexes[0]!.indexdef.includes("UNIQUE") &&
    compositeIndexes[0]!.indexdef.includes('"sourceKey"') &&
    compositeIndexes[0]!.indexdef.includes('"externalLeadId"');
  return {
    incompleteLeads,
    reviewRequiredLeads,
    hashMismatches,
    invalidCommissionClassifications,
    externalLeadIdCollisions,
    compositeIndexExists,
  };
}

function assertPreflight(result: ConstraintPreflightResult): void {
  console.log(
    `preflight: incompleteLeads=${result.incompleteLeads} reviewRequiredLeads=${result.reviewRequiredLeads} hashMismatches=${result.hashMismatches} invalidCommissionClassifications=${result.invalidCommissionClassifications} externalLeadIdCollisions=${result.externalLeadIdCollisions} compositeIndexExists=${result.compositeIndexExists}`,
  );
  if (
    result.incompleteLeads > 0 ||
    result.reviewRequiredLeads > 0 ||
    result.hashMismatches > 0 ||
    result.invalidCommissionClassifications > 0 ||
    result.externalLeadIdCollisions > 0 ||
    !result.compositeIndexExists
  ) {
    throw new Error(
      "Constraint preflight failed; reconciliation/resolution must reach zero before hardening",
    );
  }
}

async function main(): Promise<void> {
  console.log(`mode: ${apply ? "APPLY" : "DRY RUN"}`);
  const preflight = await runUnifiedLeadConstraintsPreflight();
  assertPreflight(preflight);
  if (!apply) {
    console.log("DRY RUN complete; no constraints were changed.");
    return;
  }

  await prisma.$transaction(
    async (transaction) => {
      await transaction.$executeRawUnsafe(`
        ALTER TABLE "ContactSubmission"
          ALTER COLUMN "intentLevel" SET NOT NULL,
          ALTER COLUMN "sourceKey" SET NOT NULL,
          ALTER COLUMN "stage" SET NOT NULL
      `);
      await transaction.$executeRawUnsafe(`
        DROP INDEX IF EXISTS "ContactSubmission_externalLeadId_key"
      `);
    },
    { maxWait: 30_000, timeout: 300_000 },
  );
  console.log("APPLY complete; unified Lead nullability is hardened.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
