/**
 * Phase 3 of the multi-product migration: fold the client rows that are really
 * one paying customer into a single client holding several products.
 *
 * Groups confirmed by Elad (2026-07-19):
 *   יוני         → burger site + shawarma site + an admin system not yet billing
 *   עמק איילון   → its own site + אהוד תייר (same customer, different brand)
 *
 * Everything hanging off an absorbed client (products, agreements, jobs,
 * expenses, notes) moves to the survivor; the absorbed row is zeroed and
 * archived rather than deleted, so its number and history survive.
 *
 * The whole thing runs in a transaction per group and asserts the MRR total is
 * unchanged at the end — a merge that moves money is a bug, not a merge.
 *
 *   npx tsx scripts/merge-clients.ts          # dry run
 *   APPLY=1 npx tsx scripts/merge-clients.ts  # write
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.env.APPLY === "1";
const round2 = (n: number) => Math.round(n * 100) / 100;

type Group = {
  label: string;
  survivorNumber: number;
  survivorName?: string;
  // client number → what its product should be called under the merged client
  productNames: Record<number, string>;
  absorbNumbers: number[];
};

const GROUPS: Group[] = [
  {
    label: "יוני",
    survivorNumber: 20,
    survivorName: "יוני",
    productNames: { 20: "המבורגר", 21: "שווארמה", 50: "מערכת ניהול" },
    absorbNumbers: [21, 50],
  },
  {
    label: "עמק איילון",
    survivorNumber: 33,
    productNames: { 33: "עמק איילון", 39: "אהוד תייר" },
    absorbNumbers: [39],
  },
  // Confirmed by Elad 2026-07-19 (screenshot): these three rows are one
  // paying customer — מקורות.
  {
    label: "מקורות",
    survivorNumber: 44,
    survivorName: "מקורות",
    productNames: { 44: "Aquatis", 46: "Nadav Grinberg", 48: "יעקב גרינברג" },
    absorbNumbers: [46, 48],
  },
];

async function mrrTotal() {
  const clients = await prisma.client.findMany({
    where: { archivedAt: null },
    select: { monthlyAmount: true },
  });
  return round2(clients.reduce((s, c) => s + (c.monthlyAmount ?? 0), 0));
}

async function main() {
  const before = await mrrTotal();
  const beforeCount = await prisma.client.count({ where: { archivedAt: null } });
  console.log(`BEFORE  clients: ${beforeCount}  MRR: ₪${before}`);
  console.log(`mode: ${apply ? "APPLY (writing)" : "DRY RUN (no writes)"}\n`);

  for (const g of GROUPS) {
    const numbers = [g.survivorNumber, ...g.absorbNumbers];
    const rows = await prisma.client.findMany({
      where: { number: { in: numbers } },
      select: {
        id: true,
        number: true,
        name: true,
        amount: true,
        monthlyAmount: true,
        archivedAt: true,
        products: { select: { id: true, name: true, monthlyAmount: true, archivedAt: true } },
      },
    });

    const survivor = rows.find((r) => r.number === g.survivorNumber);
    if (!survivor) {
      console.log(`  ✗ ${g.label}: survivor #${g.survivorNumber} not found — skipping`);
      continue;
    }
    const absorbed = rows.filter((r) => g.absorbNumbers.includes(r.number));
    if (absorbed.length !== g.absorbNumbers.length) {
      console.log(`  ✗ ${g.label}: expected ${g.absorbNumbers.length} rows to absorb, found ${absorbed.length} — skipping`);
      continue;
    }
    if (absorbed.some((a) => a.archivedAt)) {
      console.log(`  • ${g.label}: already merged (an absorbed row is archived) — skipping`);
      continue;
    }

    const groupMonthly = round2(rows.reduce((s, r) => s + (r.monthlyAmount ?? 0), 0));
    const groupCumulative = round2(rows.reduce((s, r) => s + (r.amount ?? 0), 0));

    console.log(`  ${g.label}  →  client #${survivor.number} "${g.survivorName ?? survivor.name}"`);
    for (const r of rows) {
      const target = g.productNames[r.number] ?? r.name;
      console.log(`      #${r.number} ${r.name.padEnd(24)} ₪${String(r.monthlyAmount ?? 0).padStart(7)}  →  product "${target}"`);
    }
    console.log(`      merged monthly ₪${groupMonthly} | merged cumulative ₪${groupCumulative}`);

    if (!apply) {
      console.log("");
      continue;
    }

    await prisma.$transaction(async (tx) => {
      for (const a of absorbed) {
        await tx.clientProduct.updateMany({ where: { clientId: a.id }, data: { clientId: survivor.id } });
        await tx.agreement.updateMany({ where: { clientId: a.id }, data: { clientId: survivor.id } });
        await tx.clientJob.updateMany({ where: { clientId: a.id }, data: { clientId: survivor.id } });
        await tx.expense.updateMany({ where: { clientId: a.id }, data: { clientId: survivor.id } });
        await tx.clientNote.updateMany({ where: { clientId: a.id }, data: { clientId: survivor.id } });

        // Zero the money AND archive. Zeroing is the belt to the archive's
        // braces: any reader that forgets to filter archivedAt still totals
        // correctly instead of double-counting the merged revenue.
        await tx.client.update({
          where: { id: a.id },
          data: {
            amount: 0,
            monthlyAmount: 0,
            archivedAt: new Date(),
            notes: `מוזג ללקוח #${survivor.number} (${g.label})`,
          },
        });
      }

      // Rename each moved product to its short form under the merged client.
      for (const r of rows) {
        const target = g.productNames[r.number];
        if (!target) continue;
        for (const p of r.products) {
          await tx.clientProduct.update({ where: { id: p.id }, data: { name: target } });
        }
      }

      await tx.client.update({
        where: { id: survivor.id },
        data: {
          amount: groupCumulative,
          monthlyAmount: groupMonthly,
          ...(g.survivorName ? { name: g.survivorName } : {}),
        },
      });
    });

    console.log(`      ✓ merged\n`);
  }

  const after = await mrrTotal();
  const afterCount = await prisma.client.count({ where: { archivedAt: null } });
  // Status-aware, matching syncClientMonthly: only "בוצע" products bill, so
  // only they may be compared against the client rollups.
  const products = await prisma.clientProduct.findMany({
    where: { archivedAt: null, status: "בוצע", client: { archivedAt: null } },
    select: { monthlyAmount: true },
  });
  const productTotal = round2(products.reduce((s, p) => s + (p.monthlyAmount ?? 0), 0));

  console.log(`AFTER   clients: ${afterCount}  MRR: ₪${after}`);
  console.log(`        products: ${products.length}  sum: ₪${productTotal}`);

  if (!apply) return;

  if (after !== before) {
    console.log(`\n  ✗ MRR MOVED by ₪${round2(after - before)} — investigate before trusting the reports.`);
    process.exitCode = 1;
  } else if (productTotal !== after) {
    console.log(`\n  ✗ ROLLUP DRIFT — products ₪${productTotal} vs clients ₪${after}.`);
    process.exitCode = 1;
  } else {
    console.log(`\n  ✓ MRR unchanged at ₪${after} and the product rollup agrees. Merge is clean.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
