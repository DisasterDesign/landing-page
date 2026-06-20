import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET - the seller's commissions + totals (pending / paid).
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rows = await prisma.sellerCommission.findMany({
      where: { sellerId: session.user.id },
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

    return NextResponse.json({
      rows,
      summary: { count: rows.length, totalPending, totalPaid, total: totalPending + totalPaid },
    });
  } catch (error) {
    console.error("Error listing seller commissions:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
