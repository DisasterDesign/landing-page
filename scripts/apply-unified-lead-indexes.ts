import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.env.APPLY === "1";

async function duplicateCount(query: Prisma.Sql): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>(query);
  return Number(rows[0]?.count ?? 0);
}

async function main(): Promise<void> {
  console.log(`mode: ${apply ? "APPLY" : "DRY RUN"}`);
  const [duplicateActiveAgreements, duplicateScheduledFollowUps] =
    await Promise.all([
      duplicateCount(Prisma.sql`
        SELECT COUNT(*)::bigint AS "count"
        FROM (
          SELECT "leadId"
          FROM "Agreement"
          WHERE "leadId" IS NOT NULL
            AND "status" IN ('DRAFT', 'SENT', 'SIGNED')
          GROUP BY "leadId"
          HAVING COUNT(*) > 1
        ) duplicates
      `),
      duplicateCount(Prisma.sql`
        SELECT COUNT(*)::bigint AS "count"
        FROM (
          SELECT "leadId"
          FROM "LeadFollowUp"
          WHERE "status" = 'SCHEDULED'
          GROUP BY "leadId"
          HAVING COUNT(*) > 1
        ) duplicates
      `),
    ]);
  console.log(
    `preflight: duplicateActiveAgreements=${duplicateActiveAgreements} duplicateScheduledFollowUps=${duplicateScheduledFollowUps}`,
  );
  if (duplicateActiveAgreements > 0 || duplicateScheduledFollowUps > 0) {
    throw new Error(
      "Index preflight failed; resolve active duplicates through audited lifecycle actions",
    );
  }
  if (!apply) {
    console.log("DRY RUN complete; no indexes were created.");
    return;
  }

  await prisma.$transaction(
    async (transaction) => {
      await transaction.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "Agreement_one_active_per_lead"
        ON "Agreement" ("leadId")
        WHERE "leadId" IS NOT NULL AND "status" IN ('DRAFT', 'SENT', 'SIGNED')
      `);
      await transaction.$executeRawUnsafe(`
        CREATE UNIQUE INDEX IF NOT EXISTS "LeadFollowUp_one_scheduled_per_lead"
        ON "LeadFollowUp" ("leadId")
        WHERE "status" = 'SCHEDULED'
      `);
    },
    { maxWait: 30_000, timeout: 300_000 },
  );
  console.log("APPLY complete; lifecycle race-guard indexes exist.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
