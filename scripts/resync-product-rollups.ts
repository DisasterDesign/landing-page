/**
 * Re-derive every client's monthlyAmount under the status-aware rollup rule
 * (only products marked "בוצע" bill), and backfill product.startDate so the
 * "MRR חדש לפי חודש" chart has an entry month for every product.
 *
 * startDate backfill: the client's own startDate, else the client's createdAt.
 * Products that were MOVED in the merge get the createdAt of the client row
 * they originally came from (the archived one), not the survivor's — the
 * entry month of שווארמה is when שווארמה entered, not when המבורגר did.
 *
 *   npx tsx scripts/resync-product-rollups.ts          # dry run
 *   APPLY=1 npx tsx scripts/resync-product-rollups.ts  # write
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.env.APPLY === "1";
const round2 = (n: number) => Math.round(n * 100) / 100;

// product name (under its current client) → archived client number it came from
const MOVED_PRODUCT_ORIGIN: Record<string, number> = {
  "שווארמה": 21,
  "מערכת ניהול": 50,
  "אהוד תייר": 39,
};

async function main() {
  console.log(`mode: ${apply ? "APPLY" : "DRY RUN"}\n`);

  // ---- 1. startDate backfill ------------------------------------------
  const originNumbers = Object.values(MOVED_PRODUCT_ORIGIN);
  const origins = await prisma.client.findMany({
    where: { number: { in: originNumbers } },
    select: { number: true, startDate: true, createdAt: true },
  });
  const originByNumber = new Map(origins.map((o) => [o.number, o]));

  const products = await prisma.clientProduct.findMany({
    where: { archivedAt: null, startDate: null },
    select: {
      id: true,
      name: true,
      client: { select: { number: true, startDate: true, createdAt: true } },
    },
  });

  console.log(`products missing startDate: ${products.length}`);
  for (const p of products) {
    const origin = MOVED_PRODUCT_ORIGIN[p.name]
      ? originByNumber.get(MOVED_PRODUCT_ORIGIN[p.name])
      : null;
    const src = origin ?? p.client;
    const startDate = src.startDate ?? src.createdAt;
    console.log(
      `  ${p.name.slice(0, 24).padEnd(26)} → ${startDate.toISOString().slice(0, 10)}` +
        (origin ? `  (from original client #${MOVED_PRODUCT_ORIGIN[p.name]})` : "")
    );
    if (apply) {
      await prisma.clientProduct.update({ where: { id: p.id }, data: { startDate } });
    }
  }

  // ---- 2. status-aware rollup resync ----------------------------------
  const clients = await prisma.client.findMany({
    where: { archivedAt: null },
    select: {
      id: true,
      number: true,
      name: true,
      monthlyAmount: true,
      products: {
        where: { archivedAt: null },
        select: { name: true, status: true, monthlyAmount: true },
      },
    },
    orderBy: { number: "asc" },
  });

  let before = 0;
  let after = 0;
  console.log("\nrollup changes:");
  let changes = 0;
  for (const c of clients) {
    const old = round2(c.monthlyAmount ?? 0);
    const next = round2(
      c.products
        .filter((p) => p.status === "בוצע")
        .reduce((s, p) => s + (p.monthlyAmount ?? 0), 0)
    );
    before += old;
    after += next;
    if (old !== next) {
      changes++;
      const dropped = c.products.filter((p) => p.status !== "בוצע" && p.monthlyAmount);
      console.log(
        `  #${c.number} ${c.name}: ₪${old} → ₪${next}` +
          (dropped.length ? `  (לא בתשלום: ${dropped.map((d) => `${d.name} ₪${d.monthlyAmount}`).join(", ")})` : "")
      );
      if (apply) {
        await prisma.client.update({ where: { id: c.id }, data: { monthlyAmount: next } });
      }
    }
  }
  if (!changes) console.log("  (none)");

  console.log(`\nMRR: ₪${round2(before)} → ₪${round2(after)}  (Δ ₪${round2(after - before)})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
