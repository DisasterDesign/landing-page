export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // High impressions but not yet on page 1 (positions 8-20).
    const opportunities = await prisma.seoQuery.findMany({
      where: { position: { gte: 8, lte: 20 } },
      orderBy: { impressions: "desc" },
      take: 50,
    });

    return NextResponse.json({ opportunities });
  } catch (error) {
    console.error("Opportunities fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
