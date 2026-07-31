export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { requireOwner, viewerErrorResponse } from "@/lib/auth/viewer";
import { prisma } from "@/lib/prisma";
import { CARDCOM_FEE_RATE, VAT_RATE } from "@/lib/finance";

/**
 * GET /api/partners/[id]?month=YYYY-MM — owner-only drill-down on one partner.
 *
 * The partners board answers "what do I owe each of them". This answers
 * "why" — every client, every agreement, every lead and every commission
 * behind that one number, in the same tables the rest of the admin uses.
 *
 * ATTRIBUTION (the whole point of this route):
 * agreements are scoped by `Agreement.partnerId` — the single explicit
 * "which partner generated this deal" column — falling back to
 * `creditedSellerId` only for rows the backfill has not reached.
 * `createdBy` is deliberately NOT in that chain: it records who TYPED the
 * agreement in, and Elad opens most agreements on a partner's behalf, so
 * using it as attribution is exactly the bug this page exists to end. It
 * stays an audit field and nothing else.
 *
 * Clients are scoped by `Client.ownerId`, which is itself derived from the
 * client's first agreement's partnerId — so the two tables on this page can
 * never disagree about who brought whom.
 *
 * Money math mirrors /api/partner-report and /api/partners/overview exactly
 * (VAT backed out of the gross unless the client is zero-rated, minus
 * Cardcom's 2%), so no two screens can ever quote a different profit.
 */

function monthBounds(month: string | null): {
  start: Date;
  end: Date;
  key: string;
} {
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

/**
 * Agreements this partner generated. The second branch fires only on rows the
 * partnerId backfill has not reached, so it degrades to the old signal instead
 * of showing an empty page mid-migration.
 */
function partnerAgreementScope(partnerId: string): Prisma.AgreementWhereInput {
  return {
    OR: [{ partnerId }, { partnerId: null, creditedSellerId: partnerId }],
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireOwner();
  } catch (error) {
    const authError = viewerErrorResponse(error);
    if (authError) return authError;
    throw error;
  }

  const { id } = await params;
  const { start, end, key } = monthBounds(
    request.nextUrl.searchParams.get("month"),
  );

  const partner = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      username: true,
      isOwner: true,
      role: true,
      revenueSharePct: true,
    },
  });

  // Only the owner and the partners are drillable — a MEMBER has no
  // attribution and would render an empty, confusing page.
  if (!partner || (!partner.isOwner && partner.role !== "SELLER")) {
    return NextResponse.json({ error: "Partner not found" }, { status: 404 });
  }

  const [clients, agreements, leadsByStage, commissions, monthCommissions] =
    await Promise.all([
      prisma.client.findMany({
        where: { ownerId: id, archivedAt: null },
        select: {
          id: true,
          number: true,
          name: true,
          businessName: true,
          status: true,
          monthlyAmount: true,
          amount: true,
          vatExempt: true,
          startDate: true,
          paymentDate: true,
          products: {
            where: { archivedAt: null },
            select: {
              id: true,
              name: true,
              monthlyAmount: true,
              lane: true,
              status: true,
            },
            orderBy: { createdAt: "asc" },
          },
        },
      }),
      prisma.agreement.findMany({
        where: partnerAgreementScope(id),
        select: {
          id: true,
          customerName: true,
          businessName: true,
          tier: true,
          monthlyPrice: true,
          oneTimeFee: true,
          status: true,
          paymentStatus: true,
          signedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.contactSubmission.groupBy({
        by: ["stage"],
        where: { ownerId: id },
        _count: { _all: true },
      }),
      // Full commission history — the ledger behind the first-month model.
      prisma.sellerCommission.findMany({
        where: { sellerId: id },
        select: {
          id: true,
          clientName: true,
          amount: true,
          status: true,
          paidAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      // Commissions credited IN the selected month — the payout figure.
      prisma.sellerCommission.findMany({
        where: { sellerId: id, createdAt: { gte: start, lt: end } },
        select: { amount: true, status: true },
      }),
    ]);

  /** Monthly profit of one billing client: gross → net of VAT → net of fee. */
  const clientFigures = (client: (typeof clients)[number]) => {
    const gross = client.monthlyAmount ?? client.amount ?? 0;
    const vat = client.vatExempt ? 0 : (gross * VAT_RATE) / (100 + VAT_RATE);
    return { gross, profit: gross - vat - gross * CARDCOM_FEE_RATE };
  };

  // Only clients actually billing contribute money; the rest are listed but
  // weigh nothing, exactly as in the partner report.
  const billing = clients.filter((client) => client.status === "בוצע");
  let monthlyGross = 0;
  let monthlyProfit = 0;
  for (const client of billing) {
    const figures = clientFigures(client);
    monthlyGross += figures.gross;
    monthlyProfit += figures.profit;
  }

  const sharePct = partner.isOwner ? null : partner.revenueSharePct;
  const recurringPayout =
    sharePct != null ? monthlyProfit * (sharePct / 100) : 0;
  const firstMonthPayout = monthCommissions.reduce(
    (sum, row) => sum + row.amount,
    0,
  );
  const firstMonthPending = monthCommissions
    .filter((row) => row.status === "PENDING")
    .reduce((sum, row) => sum + row.amount, 0);

  const clientRows = clients
    .map((client) => {
      const figures = clientFigures(client);
      const isBilling = client.status === "בוצע";
      return {
        id: client.id,
        number: client.number,
        name: client.name,
        businessName: client.businessName,
        status: client.status,
        monthlyAmount: client.monthlyAmount ?? client.amount ?? 0,
        // Zero unless billing, so the column sums to monthlyGross/monthlyProfit
        // above instead of promising money that is not being charged.
        monthlyGross: isBilling ? round(figures.gross) : 0,
        monthlyProfit: isBilling ? round(figures.profit) : 0,
        vatExempt: client.vatExempt,
        startDate: client.startDate,
        paymentDate: client.paymentDate,
        products: client.products.map((product) => ({
          id: product.id,
          name: product.name,
          monthlyAmount: product.monthlyAmount,
          lane: product.lane,
          status: product.status,
        })),
      };
    })
    .sort((a, b) => b.monthlyGross - a.monthlyGross || a.name.localeCompare(b.name, "he"));

  const signedThisMonth = agreements.filter(
    (agreement) =>
      agreement.status === "SIGNED" &&
      agreement.signedAt != null &&
      agreement.signedAt >= start &&
      agreement.signedAt < end,
  ).length;

  return NextResponse.json({
    month: key,
    partner: {
      id: partner.id,
      name: partner.name,
      username: partner.username,
      isOwner: partner.isOwner,
      model: partner.isOwner
        ? ("OWNER" as const)
        : sharePct != null
          ? ("RECURRING_SHARE" as const)
          : ("FIRST_MONTH" as const),
      sharePct,
    },
    money: {
      monthlyGross: round(monthlyGross),
      monthlyProfit: round(monthlyProfit),
      recurringPayout: round(recurringPayout),
      firstMonthPayout: round(firstMonthPayout),
      firstMonthPending: round(firstMonthPending),
      payout: round(recurringPayout + firstMonthPayout),
    },
    counts: {
      clients: clients.length,
      billingClients: billing.length,
      agreements: agreements.length,
      signedAgreements: agreements.filter((a) => a.status === "SIGNED").length,
      signedThisMonth,
      leads: leadsByStage.reduce((sum, row) => sum + row._count._all, 0),
    },
    clients: clientRows,
    agreements,
    leads: leadsByStage
      .map((row) => ({ stage: row.stage, count: row._count._all }))
      .sort((a, b) => b.count - a.count),
    commissions,
  });
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
