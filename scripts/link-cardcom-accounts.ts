/**
 * Links Cardcom standing orders to the clients they belong to.
 *
 * Every mapping here was confirmed by Elad against the charge stream on
 * 2026-08-11, or is an exact name+amount agreement. Nothing is guessed: an
 * earlier pass matched ספיר אבוטבול to jumarie on amount alone and was wrong,
 * because two different clients both bill ₪236.
 *
 * Without these links the unlinked-order alert fires on twelve known clients
 * and gets muted within a week.
 *
 * Dry run (default):  npx tsx scripts/link-cardcom-accounts.ts
 * Apply:              APPLY=1 npx tsx scripts/link-cardcom-accounts.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** clientName → the Cardcom accounts that bill for it. */
const LINKS: Array<{ client: string; accounts: number[]; why: string }> = [
  { client: "פיקס טיקטס", accounts: [1020], why: "אושר — ₪531 חודשי + סילוק חוב 1,593" },
  { client: "jumarie", accounts: [1021], why: "אושר: ספיר אבוטבול = ג'ומרי" },
  { client: "שי חיים", accounts: [1037], why: "אושר: shy haim = שי פרויקטים" },
  // Four standing orders on one client — the reason this column is a list.
  { client: "מקורות", accounts: [1047], why: "אושר: נדב גרינברג = אחד מפרויקטי מקורות" },
  { client: "יוני", accounts: [1022, 1032], why: "שתי הוראות: ₪118 + ₪234.82 = ₪353" },
];

async function main() {
  const apply = process.env.APPLY === "1";
  console.log(apply ? "MODE: APPLY\n" : "MODE: DRY RUN\n");

  for (const l of LINKS) {
    const c = await prisma.client.findFirst({
      where: { name: { contains: l.client }, archivedAt: null },
      select: { id: true, name: true, cardcomAccountIds: true },
    });
    if (!c) {
      console.log(`  !! ${l.client} — not found`);
      continue;
    }
    const merged = [...new Set([...c.cardcomAccountIds, ...l.accounts])].sort(
      (a, b) => a - b,
    );
    if (merged.join() === [...c.cardcomAccountIds].sort((a, b) => a - b).join()) {
      console.log(`  SKIP  ${c.name} — already [${merged.join(", ")}]`);
      continue;
    }
    console.log(
      `  ${apply ? "LINK" : "WOULD"}  ${c.name.padEnd(16)} [${merged.join(", ")}]   ${l.why}`,
    );
    if (apply) {
      await prisma.client.update({
        where: { id: c.id },
        data: { cardcomAccountIds: merged },
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
