/**
 * One-off import of Elad's personal retainers — the clients he billed before
 * the Fuzion partnership, which pay only him and split with nobody.
 *
 * The list is hand-confirmed, not derived. Cardcom cannot tell a personal
 * retainer from a partnership client (same terminal, no distinguishing field),
 * and the automated match was weak on top of that: only 16 of 25 agreements
 * carry a cardcomAccountId and only 8 of 25 clients have a ת.ז. Elad picked
 * these eight off the reconciliation by hand on 2026-08-11.
 *
 * Every row carries its Cardcom AccountId so the next reconciliation is a
 * join, not a guessing game.
 *
 * Dry run (default):  npx tsx scripts/import-personal-clients.ts
 * Apply:              APPLY=1 npx tsx scripts/import-personal-clients.ts
 */
import { PrismaClient } from "@prisma/client";

import { PERSONAL_BOOK } from "../src/lib/clients/books";
import { USD_TO_ILS } from "../src/lib/finance";

const prisma = new PrismaClient();

interface Row {
  name: string;
  cardcomAccountId: number;
  /** Gross, as actually charged. */
  monthly: number;
  idNumber: string;
  /** Foreign client: charged in USD, zero-rated VAT (sec. 30(a)(5)). */
  usd?: boolean;
}

const ROWS: Row[] = [
  { name: "אלי אלוני", cardcomAccountId: 1012, monthly: 300, idNumber: "066037532" },
  { name: "אמיר חירש", cardcomAccountId: 1023, monthly: 118, idNumber: "303035851" },
  { name: "דפנה אילין", cardcomAccountId: 1007, monthly: 89, idNumber: "309960847" },
  { name: "שיר קפלן", cardcomAccountId: 1008, monthly: 70, idNumber: "332396696" },
  { name: "דניאל ניניוס", cardcomAccountId: 1009, monthly: 59, idNumber: "037024114" },
  { name: "חן כהן", cardcomAccountId: 1016, monthly: 59, idNumber: "311513170" },
  { name: "יהל גיבון", cardcomAccountId: 1014, monthly: 49, idNumber: "208025528" },
  // Charged $104 (CoinId=2). Stored in shekels because Client has no currency
  // field; the figure drifts with the rate and is recomputed, not authoritative.
  { name: "ארתור גריבץ", cardcomAccountId: 1010, monthly: 104, idNumber: "017330721", usd: true },
];

// Deliberately absent: דוריאל קובלנץ (account 1006). Cardcom reports
// IsActive=false and Elad confirmed the standing order was stopped.

async function main() {
  const apply = process.env.APPLY === "1";
  const owner = await prisma.user.findFirst({
    where: { isOwner: true },
    select: { id: true, name: true },
  });
  if (!owner) throw new Error("No owner user found");

  console.log(`owner: ${owner.name} (${owner.id})`);
  console.log(apply ? "MODE: APPLY\n" : "MODE: DRY RUN — nothing will be written\n");

  let created = 0;
  let skipped = 0;
  let totalIls = 0;

  for (const r of ROWS) {
    const monthlyIls = r.usd ? Math.round(r.monthly * USD_TO_ILS) : r.monthly;

    const clash = await prisma.client.findFirst({
      where: {
        OR: [
          { cardcomAccountIds: { has: r.cardcomAccountId } },
          { name: r.name },
          ...(r.idNumber ? [{ idNumber: r.idNumber }] : []),
        ],
      },
      select: { id: true, name: true, cardcomAccountIds: true },
    });

    if (clash) {
      console.log(
        `  SKIP  ${r.name.padEnd(16)} — already present as "${clash.name}" (${clash.id})`,
      );
      skipped++;
      continue;
    }

    totalIls += monthlyIls;
    const note = r.usd
      ? `ריטיינר אישי. מחויב $${r.monthly} בקארדקום (CoinId=2); הסכום בשקלים מחושב לפי ${USD_TO_ILS} ומשתנה עם השער. Cardcom AccountId ${r.cardcomAccountId}.`
      : `ריטיינר אישי מלפני השותפות. Cardcom AccountId ${r.cardcomAccountId}.`;

    console.log(
      `  ${apply ? "CREATE" : "WOULD"}  ${r.name.padEnd(16)} ₪${String(monthlyIls).padStart(4)}` +
        `${r.usd ? `  (=$${r.monthly})` : ""}  acct ${r.cardcomAccountId}`,
    );

    if (apply) {
      await prisma.client.create({
        data: {
          name: r.name,
          // "בוצע" is what the partner report filters on — without it the
          // client exists but never reaches MRR.
          status: "בוצע",
          monthlyAmount: monthlyIls,
          idNumber: r.idNumber,
          cardcomAccountIds: [r.cardcomAccountId],
          // The book. Keeps it out of the Fuzion client goal.
          partner: PERSONAL_BOOK,
          // Ownership is what actually zeroes the partner share: Elad's
          // revenueSharePct is null, and partner-report reads `?? 0`.
          ownerId: owner.id,
          vatExempt: r.usd === true,
          notes: note,
        },
      });
    }
    created++;
  }

  console.log(
    `\n${apply ? "created" : "would create"}: ${created} | skipped: ${skipped} | added monthly gross: ₪${totalIls.toLocaleString()}`,
  );
  if (!apply) console.log("\nRe-run with APPLY=1 to write.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("FAILED:", e.message);
  await prisma.$disconnect();
  process.exit(1);
});
