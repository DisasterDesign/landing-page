export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { getViewer, viewerErrorResponse } from "@/lib/auth/viewer";
import { computeSettlement, monthlyIlsOf } from "@/lib/partners/settlement";
import { bookOf, splitByBook } from "@/lib/clients/books";
import { prisma } from "@/lib/prisma";

const VAT_RATE = 18;
const CARDCOM_FEE_RATE = 0.02;

interface PartnerRow {
  id: string;
  number: number;
  name: string;
  amount: number;
  vat: number;
  cardcomFee: number;
  profit: number;
  partnerShare: number;
  paymentDate: string | null;
}

/**
 * GET /api/partner-report
 *
 * Snapshot of every client currently active in recurring payment
 * (status = "בוצע"). Each row's `amount` is treated as the monthly
 * recurring contribution; the report is a current-state snapshot the
 * user saves at end of month for the partner transfer.
 *
 * Per row:
 *   profit       = amount - VAT(18% inclusive) - cardcomFee(2%)
 *   partnerShare = profit × the OWNING partner's revenueSharePct
 *
 * The hard 50/50 died with the partner model (28.7.2026): each client's
 * share follows Client.ownerId → User.revenueSharePct. A client owned by
 * the owner himself, or by a first-month-commission partner (they were
 * already paid at closing), contributes zero here.
 */
export async function GET(_req: NextRequest) {
  try {
    // ADMIN, not owner-only: Roy is back at ADMIN under full transparency
    // (12.8.2026), and the dashboard KPIs read this route. getViewer reads the
    // persisted role, never the JWT.
    const viewer = await getViewer();
    if (viewer.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } catch (error) {
    const authError = viewerErrorResponse(error);
    if (authError) return authError;
    throw error;
  }

  const clients = await prisma.client.findMany({
    // Archived clients are excluded: merging a multi-site client moves its
    // money onto the surviving row and archives the absorbed one, so counting
    // archived rows here would double-count the profit split.
    where: { status: "בוצע", archivedAt: null },
    select: {
      id: true,
      number: true,
      name: true,
      amount: true,
      monthlyAmount: true,
      paymentDate: true,
      vatExempt: true,
      partner: true,
      owner: { select: { revenueSharePct: true } },
    },
    orderBy: { name: "asc" },
  });

  const rows: PartnerRow[] = clients.map((c) => {
    // Use the true MONTHLY (gross) figure — NOT Client.amount, which is the
    // cumulative total received and would inflate the profit split over time.
    const amount = c.monthlyAmount ?? c.amount ?? 0;
    // Foreign (zero-rated) clients: no VAT was collected, so none is backed out.
    const vat = c.vatExempt ? 0 : (amount * VAT_RATE) / (100 + VAT_RATE);
    const cardcomFee = amount * CARDCOM_FEE_RATE;
    const profit = amount - vat - cardcomFee;
    const sharePct = c.owner?.revenueSharePct ?? 0;
    const partnerShare = profit * (sharePct / 100);
    return {
      id: c.id,
      number: c.number,
      name: c.name,
      amount,
      vat,
      cardcomFee,
      profit,
      partnerShare,
      paymentDate: c.paymentDate ? c.paymentDate.toISOString() : null,
      book: bookOf(c),
    };
  });

  const totals = rows.reduce(
    (acc, r) => ({
      amount: acc.amount + r.amount,
      vat: acc.vat + r.vat,
      cardcomFee: acc.cardcomFee + r.cardcomFee,
      profit: acc.profit + r.profit,
      partnerShare: acc.partnerShare + r.partnerShare,
    }),
    { amount: 0, vat: 0, cardcomFee: 0, profit: 0, partnerShare: 0 }
  );

  // Average per active client — how much an average client is worth across
  // each figure (gross, VAT, fee, profit, each partner's share).
  const n = rows.length;
  const averages = {
    amount: n > 0 ? totals.amount / n : 0,
    vat: n > 0 ? totals.vat / n : 0,
    cardcomFee: n > 0 ? totals.cardcomFee / n : 0,
    profit: n > 0 ? totals.profit / n : 0,
    partnerShare: n > 0 ? totals.partnerShare / n : 0,
  };

  // Two books in one report: `totals` stays the combined figure every existing
  // caller already reads, and `books` lets the dashboard show the partnership
  // separately — the 100-client goal is a Fuzion goal and must not be inflated
  // by Elad's private retainers.
  const books = splitByBook(
    clients.map((c, i) => ({
      partner: c.partner,
      amount: rows[i].amount,
      profit: rows[i].profit,
      partnerShare: rows[i].partnerShare,
    })),
  );

  // ---- the Elad↔Roy settlement (12.8.2026 model) -----------------------
  // profit = Fuzion net revenue − SHARED expenses, split 50/50. An expense
  // tied to a personal-book client is Elad's own and never enters the pool;
  // its payer is likewise never reimbursed through the split.
  const expenseRows = await prisma.expense.findMany({
    where: { active: true },
    select: {
      name: true,
      vendor: true,
      category: true,
      amount: true,
      currency: true,
      frequency: true,
      isFixed: true,
      client: { select: { partner: true } },
      paidBy: { select: { isOwner: true } },
    },
  });
  const settlementExpenses = expenseRows.map((e) => ({
    amountIls: monthlyIlsOf(e),
    // Backfilled to Elad; a null payer defaults to owner so a data gap can
    // only ever under-reimburse Roy, never over-pay him.
    paidBy: (e.paidBy?.isOwner ?? true) ? ("owner" as const) : ("partner" as const),
    shared: e.client?.partner !== "personal",
  }));
  const settlement = computeSettlement({
    fuzionNetRevenue: books.fuzion.profit,
    expenses: settlementExpenses,
  });
  const expensesByCategory: Record<string, number> = {};
  for (let i = 0; i < expenseRows.length; i++) {
    const monthly = settlementExpenses[i].amountIls;
    if (!settlementExpenses[i].shared || monthly === 0) continue;
    const k = expenseRows[i].category;
    expensesByCategory[k] = Math.round(((expensesByCategory[k] ?? 0) + monthly) * 100) / 100;
  }

  return NextResponse.json({
    snapshotAt: new Date().toISOString(),
    rows,
    totals,
    averages,
    count: rows.length,
    books,
    settlement,
    expensesByCategory,
  });
}
