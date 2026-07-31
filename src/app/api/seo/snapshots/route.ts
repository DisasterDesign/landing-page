export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner, viewerErrorResponse } from "@/lib/auth/viewer";

export async function GET(req: NextRequest) {
  try {
    await requireOwner();

    const url = new URL(req.url);
    const days = Math.min(365, Math.max(1, parseInt(url.searchParams.get("days") || "90", 10)));

    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - days);

    const snapshots = await prisma.seoSnapshot.findMany({
      where: { date: { gte: since } },
      orderBy: { date: "asc" },
    });

    return NextResponse.json({ snapshots });
  } catch (error) {
    const authResponse = viewerErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Snapshots fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
