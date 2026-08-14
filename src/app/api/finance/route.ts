export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireAdmin, viewerErrorResponse } from "@/lib/auth/viewer";
import { prisma } from "@/lib/prisma";
import {
  monthlyIls,
  toIls,
  jobFinance,
  VAT_RATE,
  CARDCOM_FEE_RATE,
} from "@/lib/finance";

/**
 * GET /api/finance
 *
 * The full income/expense picture in one payload:
 * - bottomLine: MRR → VAT → Cardcom 2% → expenses → net profit, plus the
 *   partner split both BEFORE expenses (the current transfer model) and
 *   AFTER expenses (the true economic picture).
 * - byCategory: monthly expense run-rate per category (fixed/variable split).
 * - perClient: P&L per active client — MRR minus VAT minus fee minus
 *   DIRECTLY-attributed expenses (e.g. HIGOLD's Hetzner server). Studio
 *   overhead is intentionally NOT allocated per client.
 * - expenses: raw expense lines for the management table.
 */
export async function GET() {
  try {
    await requireAdmin();
  } catch (error) {
    const authError = viewerErrorResponse(error);
    if (authError) return authError;
    throw error;
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [clients, expenses, paidJobsThisMonth, outstandingJobs] = await Promise.all([
    prisma.client.findMany({
      where: { status: "בוצע", partner: "fuzion", archivedAt: null },
      select: {
        id: true,
        number: true,
        name: true,
        monthlyAmount: true,
        amount: true,
        vatExempt: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.expense.findMany({
      include: { client: { select: { id: true, name: true, number: true } } },
      orderBy: [{ active: "desc" }, { createdAt: "desc" }],
    }),
    // One-off jobs whose payment landed THIS month → this month's one-off income
    prisma.clientJob.findMany({
      where: { status: "PAID", paidAt: { gte: monthStart, lt: monthEnd } },
      select: { amount: true, vatIncluded: true, cardcomFee: true, client: { select: { name: true } } },
    }),
    // Still-owed one-off jobs (for context on the board)
    prisma.clientJob.findMany({
      where: { status: "PENDING" },
      select: { amount: true, vatIncluded: true, cardcomFee: true },
    }),
  ]);

  const activeExpenses = expenses.filter((e) => e.active);

  // --- Expense aggregation (monthly ILS run-rate) ---
  let fixedMonthly = 0;
  let variableMonthly = 0;
  const byCategory: Record<
    string,
    { total: number; fixed: number; variable: number; count: number }
  > = {};
  const attributed: Record<string, number> = {}; // clientId -> monthly ILS

  for (const e of activeExpenses) {
    const m = monthlyIls(e);
    if (e.isFixed) fixedMonthly += m;
    else variableMonthly += m;

    const cat = (byCategory[e.category] ??= {
      total: 0,
      fixed: 0,
      variable: 0,
      count: 0,
    });
    cat.total += m;
    cat.count += 1;
    if (e.isFixed) cat.fixed += m;
    else cat.variable += m;

    if (e.clientId) {
      attributed[e.clientId] = (attributed[e.clientId] ?? 0) + m;
    }
  }
  const totalExpensesMonthly = fixedMonthly + variableMonthly;

  // Active lines whose amount is still unknown (0) — surfaced as gaps.
  const unknownAmounts = activeExpenses
    .filter((e) => e.amount === 0)
    .map((e) => ({ id: e.id, name: e.name, vendor: e.vendor, notes: e.notes }));

  // --- Income + per-client P&L ---
  const perClient = clients.map((c) => {
    const mrr = c.monthlyAmount ?? c.amount ?? 0;
    const vat = c.vatExempt ? 0 : (mrr * VAT_RATE) / (100 + VAT_RATE);
    const cardcomFee = mrr * CARDCOM_FEE_RATE;
    const directExpenses = attributed[c.id] ?? 0;
    const net = mrr - vat - cardcomFee - directExpenses;
    return {
      id: c.id,
      number: c.number,
      name: c.name,
      mrr,
      vat,
      cardcomFee,
      directExpenses,
      net,
      marginPct: mrr > 0 ? (net / mrr) * 100 : 0,
    };
  });

  const totalMrr = perClient.reduce((s, c) => s + c.mrr, 0);
  const totalVat = perClient.reduce((s, c) => s + c.vat, 0);
  const totalCardcomFee = perClient.reduce((s, c) => s + c.cardcomFee, 0);
  const grossProfit = totalMrr - totalVat - totalCardcomFee;

  // One-off job income received this month (net profit basis) — real cash that
  // belongs to this month and enters the partner split.
  const oneOffIncomeThisMonth = paidJobsThisMonth.reduce((s, j) => s + jobFinance(j).profit, 0);
  const oneOffOutstanding = outstandingJobs.reduce((s, j) => s + jobFinance(j).gross, 0);

  const netProfit = grossProfit + oneOffIncomeThisMonth - totalExpensesMonthly;

  return NextResponse.json({
    snapshotAt: new Date().toISOString(),
    bottomLine: {
      totalMrr,
      totalVat,
      totalCardcomFee,
      grossProfit,
      fixedMonthly,
      variableMonthly,
      totalExpensesMonthly,
      oneOffIncomeThisMonth,
      oneOffOutstanding,
      netProfit,
      // Current transfer model (gross MRR, before expenses) vs true economics.
      // The "after expenses" partner share now also reflects one-off income.
      partnerShareBeforeExpenses: (grossProfit + oneOffIncomeThisMonth) / 2,
      partnerShareAfterExpenses: netProfit / 2,
      clientCount: perClient.length,
    },
    byCategory,
    perClient,
    unknownAmounts,
    expenses: expenses.map((e) => ({
      ...e,
      monthlyIls: e.active ? monthlyIls(e) : 0,
      amountIls: toIls(e.amount, e.currency),
    })),
  });
}
