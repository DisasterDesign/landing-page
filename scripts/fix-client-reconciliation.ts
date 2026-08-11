/**
 * Corrections from the 2026-08-11 Cardcom reconciliation, each confirmed by
 * Elad against the charge stream.
 *
 * Dry run (default):  npx tsx scripts/fix-client-reconciliation.ts
 * Apply:              APPLY=1 npx tsx scripts/fix-client-reconciliation.ts
 */
import { PrismaClient } from "@prisma/client";

import { PERSONAL_BOOK } from "../src/lib/clients/books";

const prisma = new PrismaClient();

async function main() {
  const apply = process.env.APPLY === "1";
  console.log(apply ? "MODE: APPLY\n" : "MODE: DRY RUN — nothing will be written\n");

  const owner = await prisma.user.findFirst({
    where: { isOwner: true },
    select: { id: true },
  });
  if (!owner) throw new Error("no owner user");

  // 1. פיקס טיקטס — the app held 450, which is the price BEFORE VAT. The field
  //    is treated as gross everywhere (partner-report backs VAT out of it), so
  //    the row understated the client by 81/month and underpaid Roy's share.
  //    Cardcom bills 531 monthly; the 1,593 charge on 20.7 was three months of
  //    debt settled in one payment after the card was cancelled.
  const ft = await prisma.client.findFirst({
    where: { name: { contains: "פיקס טיקטס" } },
    select: { id: true, name: true, monthlyAmount: true },
  });
  if (!ft) {
    console.log("  !! פיקס טיקטס not found — skipping");
  } else if (ft.monthlyAmount === 531) {
    console.log("  SKIP  פיקס טיקטס already 531");
  } else {
    console.log(`  ${apply ? "FIX " : "WOULD"}  פיקס טיקטס  ₪${ft.monthlyAmount} → ₪531  (450 was net of VAT)`);
    if (apply) {
      await prisma.client.update({
        where: { id: ft.id },
        data: {
          monthlyAmount: 531,
          notes: "מחיר תוקן 11.8.26: היה ₪450 (לפני מע\"מ) בשדה שנקרא כברוטו. קארדקום מחייבת ₪531/חודש.",
        },
      });
    }
  }

  // 2. אמיר חן — a personal retainer, distinct from אמיר חירש who was already
  //    imported. Different person, different Cardcom account, same first name.
  const existing = await prisma.client.findFirst({
    where: { OR: [{ cardcomAccountIds: { has: 1015 } }, { idNumber: "040012379" }, { name: "אמיר חן" }] },
    select: { id: true, name: true },
  });
  if (existing) {
    console.log(`  SKIP  אמיר חן already present as "${existing.name}"`);
  } else {
    console.log(`  ${apply ? "ADD " : "WOULD"}  אמיר חן  ₪118  acct 1015  [אישי]`);
    if (apply) {
      await prisma.client.create({
        data: {
          name: "אמיר חן",
          status: "בוצע",
          monthlyAmount: 118,
          idNumber: "040012379",
          cardcomAccountIds: [1015],
          partner: PERSONAL_BOOK,
          ownerId: owner.id,
          notes: "ריטיינר אישי מלפני השותפות. Cardcom AccountId 1015.",
        },
      });
    }
  }

  console.log(apply ? "\ndone." : "\nRe-run with APPLY=1 to write.");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("FAILED:", e.message);
  await prisma.$disconnect();
  process.exit(1);
});
