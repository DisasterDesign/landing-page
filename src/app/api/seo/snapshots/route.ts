export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    console.error("Snapshots fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
