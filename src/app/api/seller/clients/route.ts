export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { clientScope, getViewer, viewerErrorResponse } from "@/lib/auth/viewer";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/seller/clients — the partner's own clients.
 *
 * Scoped by Client.ownerId via clientScope: a partner sees exactly the
 * clients their deals generated, and the only aggregate in the response is
 * over that same scoped set — their own MRR is their business to know; the
 * studio's is not.
 */
export async function GET() {
  try {
    const viewer = await getViewer();
    // Partners are role SELLER; the owner may also call this while testing.
    if (!viewer.isOwner && viewer.role !== "SELLER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const clients = await prisma.client.findMany({
      where: { ...clientScope(viewer), archivedAt: null },
      select: {
        id: true,
        name: true,
        businessName: true,
        status: true,
        monthlyAmount: true,
        startDate: true,
        createdAt: true,
        products: {
          where: { archivedAt: null },
          select: { id: true, name: true, monthlyAmount: true, status: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const monthlyTotal = clients.reduce(
      (sum, client) => sum + (client.monthlyAmount ?? 0),
      0,
    );

    return NextResponse.json({
      clients,
      summary: {
        count: clients.length,
        monthlyTotal: Math.round(monthlyTotal * 100) / 100,
      },
    });
  } catch (error) {
    const auth = viewerErrorResponse(error);
    if (auth) return auth;
    console.error("Seller clients error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
