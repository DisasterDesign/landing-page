import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner, viewerErrorResponse } from "@/lib/auth/viewer";

export const dynamic = "force-dynamic";

// GET - Owner: all seller commissions + per-seller payout totals.
export async function GET() {
  try {
    await requireOwner();

    const commissions = await prisma.sellerCommission.findMany({
      include: { seller: { select: { id: true, name: true } } },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });

    const rows = commissions.map((c) => ({
      id: c.id,
      sellerId: c.sellerId,
      sellerName: c.seller.name,
      agreementId: c.agreementId,
      clientName: c.clientName,
      amount: c.amount,
      status: c.status,
      paidAt: c.paidAt ? c.paidAt.toISOString() : null,
      briefTaskId: c.briefTaskId,
      createdAt: c.createdAt.toISOString(),
    }));

    // Per-seller payout summary.
    const bySeller = new Map<
      string,
      { sellerId: string; sellerName: string; pending: number; paid: number; count: number }
    >();
    for (const c of commissions) {
      const cur =
        bySeller.get(c.sellerId) ?? {
          sellerId: c.sellerId,
          sellerName: c.seller.name,
          pending: 0,
          paid: 0,
          count: 0,
        };
      if (c.status === "PAID") cur.paid += c.amount;
      else cur.pending += c.amount;
      cur.count += 1;
      bySeller.set(c.sellerId, cur);
    }

    const totalPending = rows
      .filter((r) => r.status === "PENDING")
      .reduce((s, r) => s + r.amount, 0);

    return NextResponse.json({
      rows,
      sellers: Array.from(bySeller.values()).sort((a, b) => b.pending - a.pending),
      totalPending,
    });
  } catch (error) {
    const auth = viewerErrorResponse(error);
    if (auth) return auth;
    console.error("Error listing commissions:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
