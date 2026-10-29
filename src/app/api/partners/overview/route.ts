export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { requireOwner, viewerErrorResponse } from "@/lib/auth/viewer";
import { buildFinanceReport } from "@/lib/finance/report-data";
import { partnerForecastFigures, clientMonthlyProfit } from "@/lib/finance/partner-forecast";
import type { Viewer } from "@/lib/auth/viewer";
import { prisma } from "@/lib/prisma";
import { resolveAgreementPartnerId } from "@/lib/leads/agreement-lifecycle";

/**
 * GET /api/partners/overview?month=YYYY-MM — owner-only.
 *
 * One screen answering "who brought what, and what do I owe each of them
 * this month". Every partner sees only their own slice everywhere else in
 * the app; this is the only place the whole board is visible, which is why
 * it is behind requireOwner and never linked from the seller surface.
 *
 * The two payout models live side by side:
 * - RECURRING_SHARE (Roy, revenueSharePct = 50): a percentage of the monthly
 *   shared-book profit after shared costs, regardless of who generated it.
 * - FIRST_MONTH (Degaron, Elbaz, revenueSharePct = null): the first month's
 *   price of each deal, once, when the payment clears. Counted here in the
 *   month the commission row was created.
 *
 * Profit math mirrors /api/partner-report exactly (VAT backed out of the
 * gross unless the client is zero-rated, minus Cardcom's 2%), so the two
 * pages can never disagree about what a client is worth.
 */
function monthBounds(month: string | null): { start: Date; end: Date; key: string } {
  const now = new Date();
  const parsed = month?.match(/^(\d{4})-(\d{2})$/);
  const year = parsed ? Number(parsed[1]) : now.getFullYear();
  const monthIndex = parsed ? Number(parsed[2]) - 1 : now.getMonth();
  return {
    start: new Date(year, monthIndex, 1),
    end: new Date(year, monthIndex + 1, 1),
    key: `${year}-${String(monthIndex + 1).padStart(2, "0")}`,
  };
}

export async function GET(request: NextRequest) {
  let viewer: Viewer;
  try {
    viewer = await requireOwner();
  } catch (error) {
    const authError = viewerErrorResponse(error);
    if (authError) return authError;
    throw error;
  }

  const { start, end, key } = monthBounds(
    request.nextUrl.searchParams.get("month"),
  );

  const [partners, owner, clients, commissions, signedThisMonth] =
    await Promise.all([
      prisma.user.findMany({
        // Not `role: "SELLER"`: Roy went back to ADMIN on 12.8.2026 but keeps
        // his 50% recurring share, and filtering by role would silently drop
        // him from this page the moment he was promoted. A partner is anyone
        // who is paid — a share percentage or the seller role — except the
        // owner, whose money is the remainder, not a payout.
        where: {
          isOwner: false,
          OR: [{ role: "SELLER" }, { revenueSharePct: { not: null } }],
        },
        select: { id: true, name: true, username: true, revenueSharePct: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.user.findFirst({
        where: { isOwner: true },
        select: { id: true, name: true },
      }),
      prisma.client.findMany({
        where: { archivedAt: null },
        select: {
          id: true,
          name: true,
          status: true,
          monthlyAmount: true,
          vatExempt: true,
          ownerId: true,
        },
      }),
      // First-month commissions credited in the selected month.
      prisma.sellerCommission.findMany({
        where: { createdAt: { gte: start, lt: end } },
        select: {
          id: true,
          sellerId: true,
          clientName: true,
          amount: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.agreement.findMany({
        where: { status: "SIGNED", signedAt: { gte: start, lt: end } },
        select: {
          id: true,
          customerName: true,
          businessName: true,
          monthlyPrice: true,
          signedAt: true,
          partnerId: true,
          creditedSellerId: true,
        },
      }),
    ]);

  const report = await buildFinanceReport(viewer, "combined");

  /** Monthly profit of one billing client, gross → net of VAT → net of fee. */
  const clientProfit = (client: (typeof clients)[number]) => {
    return clientMonthlyProfit(client);
  };

  const billing = clients.filter((client) => client.status === "בוצע");

  const rowFor = (
    id: string,
    name: string,
    sharePct: number | null,
    isOwnerRow: boolean,
  ) => {
    const own = billing.filter((client) => client.ownerId === id);
    let gross = 0;
    let profit = 0;
    for (const client of own) {
      const figures = clientProfit(client);
      gross += figures.gross;
      profit += figures.profit;
    }
    const firstMonth = commissions.filter((row) => row.sellerId === id);
    const figures = partnerForecastFigures(isOwnerRow, sharePct, report);
    if(figures){ gross=figures.gross; profit=figures.profit; }
    const firstMonthTotal = sharePct != null ? 0 : firstMonth.reduce((sum, row) => sum + row.amount, 0);
    const recurringPayout = sharePct != null ? figures!.payout : 0;
    return {
      id,
      name,
      isOwner: isOwnerRow,
      model: isOwnerRow
        ? ("OWNER" as const)
        : sharePct != null
          ? ("RECURRING_SHARE" as const)
          : ("FIRST_MONTH" as const),
      sharePct,
      clientCount: figures?.clientCount ?? own.length,
      monthlyGross: round(gross),
      monthlyProfit: round(profit),
      // What leaves the business to this partner for the selected month.
      payoutThisMonth: round(recurringPayout + firstMonthTotal),
      recurringPayout: round(recurringPayout),
      firstMonthPayout: round(firstMonthTotal),
      firstMonthPending: round(
        firstMonth
          .filter((row) => row.status === "PENDING")
          .reduce((sum, row) => sum + row.amount, 0),
      ),
      // Attribution comes from partnerId (creditedSellerId only for rows
      // written before it existed). `createdBy` is audit-only — crediting the
      // typist is what made 8 of 14 signed deals land on the wrong partner.
      dealsSignedThisMonth: signedThisMonth.filter(
        (agreement) => resolveAgreementPartnerId(agreement) === id,
      ).length,
    };
  };

  const partnerRows = partners.map((partner) =>
    rowFor(partner.id, partner.name, partner.revenueSharePct, false),
  );
  const ownerRow = owner
    ? rowFor(owner.id, owner.name, null, true)
    : null;

  // The owner keeps whatever the business earns minus the partner payouts.
  const businessProfit = report.bottomLine.netProfit;
  const businessGross = report.bottomLine.totalMrr;
  const partnerPayouts = round(
    partnerRows.reduce((sum, row) => sum + row.payoutThisMonth, 0),
  );

  const unattributed = billing.filter((client) => !client.ownerId).length;

  return NextResponse.json({
    month: key,
    forecast: true,
    snapshotAt: report.snapshotAt,
    partners: partnerRows,
    owner: ownerRow,
    totals: {
      businessGross,
      businessProfit,
      partnerPayouts,
      ownerKeeps: round(businessProfit - partnerPayouts),
      billingClients: billing.length,
      unattributed,
    },
    deals: signedThisMonth
      .map((agreement) => ({
        id: agreement.id,
        name: agreement.businessName || agreement.customerName,
        monthlyPrice: agreement.monthlyPrice,
        signedAt: agreement.signedAt,
        partnerId: resolveAgreementPartnerId(agreement),
      }))
      .sort(
        (a, b) =>
          (b.signedAt?.getTime() ?? 0) - (a.signedAt?.getTime() ?? 0),
      ),
    commissions,
  });
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
