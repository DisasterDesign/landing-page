/**
 * Backfill Client.monthlyAmount (the true recurring monthly, gross) from each
 * client's linked agreement, so the partner report stops inflating the profit
 * split off the cumulative Client.amount.
 *
 * Prints a BEFORE/AFTER of the partner-report monthly basis so the impact is
 * visible before trusting it. Run AFTER `prisma db push`.
 *
 *   npx tsx scripts/backfill-client-monthly.ts          # dry run (no writes)
 *   APPLY=1 npx tsx scripts/backfill-client-monthly.ts  # write monthlyAmount
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const VAT_RATE = 18;
const withVat = (net: number) => Math.round(net * (1 + VAT_RATE / 100) * 100) / 100;
const apply = process.env.APPLY === "1";

async function main() {
  const clients = await prisma.client.findMany({
    where: { status: "בוצע" },
    select: {
      id: true,
      number: true,
      name: true,
      amount: true,
      monthlyAmount: true,
      vatExempt: true,
      agreements: {
        where: { monthlyPrice: { gt: 0 } },
        orderBy: [{ paymentStatus: "asc" }, { createdAt: "desc" }],
        select: { monthlyPrice: true, vatExempt: true, paymentStatus: true },
      },
    },
    orderBy: { number: "asc" },
  });

  let beforeMonthlyBasis = 0; // what the OLD report summed (Client.amount)
  let afterMonthlyBasis = 0; // what the NEW report sums (monthlyAmount)
  let updated = 0;

  for (const c of clients) {
    const cumulative = c.amount ?? 0;
    beforeMonthlyBasis += cumulative;

    // Prefer a COMPLETED agreement; otherwise the most recent with a price.
    const best =
      c.agreements.find((a) => a.paymentStatus === "COMPLETED") ?? c.agreements[0];
    let monthly: number | null = c.monthlyAmount ?? null;
    if (best) {
      monthly = best.vatExempt ? best.monthlyPrice : withVat(best.monthlyPrice);
    }

    // Fallback for manual clients with no agreement: keep the report's old
    // behavior (use the stored amount) rather than zeroing them out.
    const effective = monthly ?? cumulative;
    afterMonthlyBasis += effective;

    const flag = monthly == null ? " (no agreement — left as-is)" : "";
    console.log(
      `#${c.number} ${c.name}: amount=${cumulative} → monthly=${monthly ?? "—"}${flag}`
    );

    if (apply && monthly != null && monthly !== c.monthlyAmount) {
      await prisma.client.update({
        where: { id: c.id },
        data: { monthlyAmount: monthly },
      });
      updated++;
    }
  }

  console.log("\n=== Partner-report monthly basis ===");
  console.log(`BEFORE (off cumulative Client.amount): ${beforeMonthlyBasis.toLocaleString()} ₪`);
  console.log(`AFTER  (off true monthlyAmount):       ${afterMonthlyBasis.toLocaleString()} ₪`);
  console.log(`Active clients: ${clients.length}`);
  console.log(apply ? `\nApplied: updated ${updated} clients.` : `\nDRY RUN — re-run with APPLY=1 to write.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
