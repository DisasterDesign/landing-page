/**
 * Re-enter the three סולל בונה one-off jobs that were lost on 14.8.2026.
 *
 * What happened: they lived on three separate Client rows (#52 "סולל בונה",
 * #53 "סולל בונה תוכנית מנהלים", #54 "סולל בונה") with ₪0 monthly and no
 * status, so on /admin/clients they looked like empty rows and were
 * hard-deleted; onDelete: Cascade took the jobs, and Neon's 6-hour history
 * window had closed. Deletion policy is fixed since (src/lib/clients/deletion.ts
 * — a client with money behind it is archived, never deleted).
 *
 * The originals, recovered from the session transcript of 11.8.2026:
 *   closed 2026-07-01 | unpaid | ₪1,500 | סולל בונה — דף נחיתה למונדיאל
 *   closed 2026-07-01 | unpaid | ₪2,000 | סולל בונה תוכנית מנהלים — דף נחיתה ומערכת ניהול
 *   closed 2026-07-01 | unpaid | ₪500   | סולל בונה — אנימציה
 * All ex-VAT (₪4,000 net, ₪4,720 gross), bank transfer (no Cardcom fee).
 *
 * This time: ONE client, three jobs — Client = who pays, ClientJob = for what.
 * Payment expected ~1.11.2026 (Elad, 16.8: "ישולם עוד חודשיים וחצי"), so
 * שוטף+90 from the July close → expectedPaymentDate = 31.7 + 90d = 29.10.
 *
 * Mirrors POST /api/jobs exactly (one-off client: source "one_off", status "",
 * ownerId = Elad). Refuses to run if a live סולל בונה client already exists.
 *
 * Dry run (default):  npx tsx scripts/restore-solel-boneh.ts
 * Apply:              APPLY=1 npx tsx scripts/restore-solel-boneh.ts
 */
import { PrismaClient } from "@prisma/client";

import { expectedPaymentDate } from "../src/lib/finance";

const prisma = new PrismaClient();
const APPLY = process.env.APPLY === "1";

const CLIENT_NAME = "סולל בונה";
const CLOSED_AT = new Date("2026-07-01T00:00:00Z");
const TERMS_DAYS = 90;

const JOBS = [
  { title: "דף נחיתה למונדיאל", amount: 1500 },
  { title: "תוכנית מנהלים — דף נחיתה ומערכת ניהול", amount: 2000 },
  { title: "אנימציה", amount: 500 },
] as const;

async function main() {
  const owner = await prisma.user.findFirst({
    where: { isOwner: true },
    select: { id: true, name: true, email: true },
  });
  if (!owner) throw new Error("No isOwner user — refusing to guess an owner.");

  const existing = await prisma.client.findMany({
    where: { name: { contains: CLIENT_NAME }, archivedAt: null },
    select: { id: true, number: true, name: true, _count: { select: { jobs: true } } },
  });
  if (existing.length) {
    console.log("A live סולל בונה client already exists — nothing to restore:");
    for (const c of existing) console.log(`  #${c.number} ${c.name} (${c._count.jobs} jobs)`);
    return;
  }

  const expected = expectedPaymentDate(CLOSED_AT, TERMS_DAYS);
  const net = JOBS.reduce((s, j) => s + j.amount, 0);
  console.log(`${APPLY ? "APPLY" : "DRY RUN"} — restore ${CLIENT_NAME}`);
  console.log(`  owner: ${owner.name ?? owner.email} (${owner.id})`);
  console.log(`  client: name="${CLIENT_NAME}" source=one_off status="" partner=fuzion`);
  for (const j of JOBS) {
    console.log(
      `  job: ₪${j.amount} net (₪${Math.round(j.amount * 1.18)} gross) | ${j.title} | closed ${CLOSED_AT.toISOString().slice(0, 10)} | שוטף+${TERMS_DAYS} → expected ${expected.toISOString().slice(0, 10)} | PENDING`,
    );
  }
  console.log(`  total: ₪${net} net, ₪${Math.round(net * 1.18)} gross`);
  if (!APPLY) {
    console.log("\nDry run only. Re-run with APPLY=1 to write.");
    return;
  }

  const result = await prisma.$transaction(async (tx) => {
    const client = await tx.client.create({
      data: {
        name: CLIENT_NAME,
        source: "one_off",
        status: "",
        ownerId: owner.id,
        notes:
          "שוחזר 16.8.2026 — שלוש עבודות שנמחקו בטעות ב-14.8 (היו על שלוש שורות לקוח נפרדות #52/#53/#54). תשלום צפוי ~1.11.2026.",
      },
      select: { id: true, number: true },
    });
    const jobs = [];
    for (const j of JOBS) {
      jobs.push(
        await tx.clientJob.create({
          data: {
            clientId: client.id,
            title: j.title,
            amount: j.amount,
            vatIncluded: false,
            cardcomFee: false,
            closedAt: CLOSED_AT,
            paymentTermsDays: TERMS_DAYS,
            paidAt: null,
            status: "PENDING",
            notes: "שוחזר 16.8.2026 מרשומה שנמחקה ב-14.8",
          },
          select: { id: true, title: true, amount: true },
        }),
      );
    }
    return { client, jobs };
  });

  console.log(`\nWrote client #${result.client.number} (${result.client.id}) with ${result.jobs.length} jobs:`);
  for (const j of result.jobs) console.log(`  ${j.id} ₪${j.amount} ${j.title}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
