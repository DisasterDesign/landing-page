/**
 * READ-ONLY monthly expense sweep: dump the Expense ledger + run the
 * settlement exactly as /api/partner-report does. No writes.
 */
import { PrismaClient } from "@prisma/client";
import { computeSettlement, monthlyIlsOf } from "@/lib/partners/settlement";
import { bookOf, splitByBook } from "@/lib/clients/books";

const prisma = new PrismaClient();
const VAT_RATE = 18;
const CARDCOM_FEE_RATE = 0.02;

async function main() {
  // ---------- expenses ----------
  const expenses = await prisma.expense.findMany({
    orderBy: [{ active: "desc" }, { category: "asc" }, { name: "asc" }],
    select: {
      id: true, name: true, vendor: true, category: true, amount: true,
      currency: true, frequency: true, isFixed: true, active: true,
      notes: true, createdAt: true, updatedAt: true, startedAt: true,
      client: { select: { name: true, partner: true } },
      paidBy: { select: { name: true, isOwner: true } },
    },
  });

  console.log(`=== EXPENSE LEDGER (${expenses.length} rows) ===`);
  for (const e of expenses) {
    const monthly = monthlyIlsOf(e);
    console.log(
      [
        e.active ? "ON " : "OFF",
        e.name.slice(0, 42).padEnd(44),
        `${e.amount} ${e.currency}/${e.frequency}`.padEnd(22),
        `≈₪${monthly.toFixed(2)}/ח`.padEnd(14),
        e.category.padEnd(10),
        `payer=${e.paidBy?.name ?? "NULL"}`.padEnd(20),
        e.client ? `client=${e.client.name}(${e.client.partner ?? "-"})` : "",
      ].join(" ")
    );
    if (e.notes) console.log(`      note: ${e.notes}`);
  }

  // ---------- clients / revenue ----------
  const clients = await prisma.client.findMany({
    where: { status: "בוצע", archivedAt: null },
    select: {
      id: true, number: true, name: true, amount: true, monthlyAmount: true,
      vatExempt: true, partner: true,
      owner: { select: { name: true, revenueSharePct: true } },
    },
  });

  const rows = clients.map((c) => {
    const amount = c.monthlyAmount ?? c.amount ?? 0;
    const vat = c.vatExempt ? 0 : (amount * VAT_RATE) / (100 + VAT_RATE);
    const cardcomFee = amount * CARDCOM_FEE_RATE;
    const profit = amount - vat - cardcomFee;
    const sharePct = c.owner?.revenueSharePct ?? 0;
    return { partner: c.partner, amount, profit, partnerShare: profit * (sharePct / 100), book: bookOf(c) };
  });

  const books = splitByBook(rows);

  const expenseRows = expenses.filter((e) => e.active);
  const settlementExpenses = expenseRows.map((e) => ({
    amountIls: monthlyIlsOf(e),
    paidBy: (e.paidBy?.isOwner ?? true) ? ("owner" as const) : ("partner" as const),
    shared: e.client?.partner !== "personal",
  }));
  const settlement = computeSettlement({
    fuzionNetRevenue: books.fuzion.profit,
    expenses: settlementExpenses,
  });

  const byCat: Record<string, number> = {};
  expenseRows.forEach((e, i) => {
    const m = settlementExpenses[i].amountIls;
    if (!settlementExpenses[i].shared || m === 0) return;
    byCat[e.category] = (byCat[e.category] ?? 0) + m;
  });

  console.log("\n=== BOOKS ===");
  for (const k of ["fuzion", "personal", "combined"] as const) {
    const b = books[k];
    console.log(`${k.padEnd(9)} count=${b.count} gross=₪${b.amount.toFixed(2)} netProfit=₪${b.profit.toFixed(2)} partnerShare=₪${b.partnerShare.toFixed(2)}`);
  }

  console.log("\n=== SHARED EXPENSES BY CATEGORY (₪/month) ===");
  Object.entries(byCat).sort((a, b) => b[1] - a[1]).forEach(([k, v]) =>
    console.log(`${k.padEnd(12)} ₪${v.toFixed(2)}`)
  );

  console.log("\n=== SETTLEMENT ===");
  console.log(`Fuzion net revenue : ₪${books.fuzion.profit.toFixed(2)}`);
  console.log(`Shared expenses    : ₪${settlement.sharedExpenses.toFixed(2)}`);
  console.log(`Personal expenses  : ₪${settlement.personalExpenses.toFixed(2)}`);
  console.log(`Profit             : ₪${settlement.profit.toFixed(2)}`);
  console.log(`Roy entitlement    : ₪${settlement.royEntitlement.toFixed(2)}`);
  console.log(`TRANSFER TO ROY    : ₪${settlement.transferToRoy.toFixed(2)}`);

  const partnerPaid = expenseRows.filter((_, i) => settlementExpenses[i].shared && settlementExpenses[i].paidBy === "partner");
  console.log(`\nShared expenses paid by Roy: ${partnerPaid.length}`);
  partnerPaid.forEach((e, i) => console.log(`  - ${e.name} ₪${monthlyIlsOf(e).toFixed(2)}`));

  await prisma.$disconnect();
}

main().catch(async (e) => { console.error("FAILED:", e); await prisma.$disconnect(); process.exit(1); });
