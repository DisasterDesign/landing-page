import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getViewer, viewerErrorResponse } from "@/lib/auth/viewer";

const VAT_RATE = 18;
const CARDCOM_FEE_RATE = 0.02;

// GET - the partner's own earnings: first-month commissions + (for a
// recurring-share partner like Roy) the monthly share of their clients.
export async function GET() {
  try {
    const viewer = await getViewer();

    const rows = await prisma.sellerCommission.findMany({
      where: { sellerId: viewer.userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        agreementId: true,
        clientName: true,
        amount: true,
        status: true,
        paidAt: true,
        briefTaskId: true,
        createdAt: true,
      },
    });

    const totalPending = rows
      .filter((r) => r.status === "PENDING")
      .reduce((s, r) => s + r.amount, 0);
    const totalPaid = rows
      .filter((r) => r.status === "PAID")
      .reduce((s, r) => s + r.amount, 0);

    // Recurring-share partner: their share of the monthly profit of the
    // billing clients THEY generated. Same math as the partner report
    // (net of VAT unless zero-rated, minus the Cardcom fee) so the two
    // views can never disagree.
    let recurringShare: {
      sharePct: number;
      clientCount: number;
      monthlyGross: number;
      monthlyShare: number;
    } | null = null;
    if (viewer.revenueSharePct != null) {
      const clients = await prisma.client.findMany({
        where: {
          ownerId: viewer.userId,
          partner: "fuzion",
          status: "בוצע",
          archivedAt: null,
        },
        select: { monthlyAmount: true, vatExempt: true },
      });
      let gross = 0;
      let profit = 0;
      for (const client of clients) {
        const amount = client.monthlyAmount ?? 0;
        gross += amount;
        const net = client.vatExempt ? amount : (amount * 100) / (100 + VAT_RATE);
        profit += net - amount * CARDCOM_FEE_RATE;
      }
      recurringShare = {
        sharePct: viewer.revenueSharePct,
        clientCount: clients.length,
        monthlyGross: Math.round(gross * 100) / 100,
        monthlyShare:
          Math.round(profit * (viewer.revenueSharePct / 100) * 100) / 100,
      };
    }

    return NextResponse.json({
      rows,
      summary: { count: rows.length, totalPending, totalPaid, total: totalPending + totalPaid },
      recurringShare,
    });
  } catch (error) {
    const auth = viewerErrorResponse(error);
    if (auth) return auth;
    console.error("Error listing seller commissions:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
