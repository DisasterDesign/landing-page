/**
 * Phase 1 of the multi-product migration: give every existing client exactly
 * one ClientProduct that mirrors the row it came from.
 *
 * After this runs, SUM(products.monthlyAmount) must equal SUM(clients.
 * monthlyAmount) to the agora. That invariant is what makes phase 2 (pointing
 * the partner report and finance at products) safe to verify: if the total
 * moves, the migration is wrong, not the reports.
 *
 * Idempotent — a client that already has products is skipped, so re-running
 * cannot double-count.
 *
 *   npx tsx scripts/backfill-client-products.ts          # dry run (no writes)
 *   APPLY=1 npx tsx scripts/backfill-client-products.ts  # write
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.env.APPLY === "1";
const round2 = (n: number) => Math.round(n * 100) / 100;

async function main() {
  const clients = await prisma.client.findMany({
    select: {
      id: true,
      number: true,
      name: true,
      status: true,
      monthlyAmount: true,
      websiteUrl: true,
      startDate: true,
      paymentDate: true,
      archivedAt: true,
      agreements: { select: { id: true } },
      products: { select: { id: true } },
    },
    orderBy: { number: "asc" },
  });

  const todo = clients.filter((c) => c.products.length === 0);
  const skipped = clients.length - todo.length;

  console.log(`clients: ${clients.length} | need a product: ${todo.length} | already have one: ${skipped}`);
  console.log(`mode: ${apply ? "APPLY (writing)" : "DRY RUN (no writes)"}\n`);

  for (const c of todo) {
    // Link the agreement only when there is exactly one — client #33 carries a
    // second agreement that belongs to a different brand, and guessing there
    // would bake a known data error into the new table.
    const agreementId = c.agreements.length === 1 ? c.agreements[0].id : null;

    const data = {
      clientId: c.id,
      name: c.name,
      websiteUrl: c.websiteUrl,
      monthlyAmount: c.monthlyAmount,
      status: c.status,
      startDate: c.startDate,
      paymentDate: c.paymentDate,
      archivedAt: c.archivedAt,
      agreementId,
    };

    console.log(
      `  #${String(c.number).padEnd(4)} ${c.name.slice(0, 26).padEnd(28)} ₪${String(c.monthlyAmount ?? 0).padStart(8)}` +
        `  ${c.websiteUrl ? "site" : "    "}  ${agreementId ? "agr" : "   "}${c.archivedAt ? "  ARCHIVED" : ""}`
    );

    if (apply) await prisma.clientProduct.create({ data });
  }

  // ---- invariant check -------------------------------------------------
  const clientTotal = round2(clients.reduce((s, c) => s + (c.monthlyAmount ?? 0), 0));
  const products = await prisma.clientProduct.findMany({ select: { monthlyAmount: true } });
  const productTotal = round2(products.reduce((s, p) => s + (p.monthlyAmount ?? 0), 0));

  console.log(`\n  sum(Client.monthlyAmount)        = ₪${clientTotal}`);
  console.log(`  sum(ClientProduct.monthlyAmount) = ₪${productTotal}  (${products.length} products)`);

  if (!apply) {
    console.log("\n  dry run — product total reflects only what already exists.");
  } else if (clientTotal === productTotal) {
    console.log("\n  ✓ INVARIANT HOLDS — totals match exactly. Phase 2 is safe to start.");
  } else {
    console.log(`\n  ✗ INVARIANT BROKEN — off by ₪${round2(clientTotal - productTotal)}. Do NOT proceed to phase 2.`);
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
