export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Prisma } from "@prisma/client";

const ALLOWED_SORT = new Set(["lastSeen", "firstSeen", "sourceDomain"]);

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const sort = url.searchParams.get("sort") || "lastSeen";
    const order = url.searchParams.get("order") === "asc" ? "asc" : "desc";
    const sortField = (
      ALLOWED_SORT.has(sort) ? sort : "lastSeen"
    ) as keyof Prisma.BacklinkOrderByWithRelationInput;

    const backlinks = await prisma.backlink.findMany({
      orderBy: { [sortField]: order } as Prisma.BacklinkOrderByWithRelationInput,
      take: 500,
    });

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const totalCount = backlinks.length;
    const uniqueDomains = new Set(backlinks.map((b) => b.sourceDomain)).size;
    const newThisWeek = backlinks.filter(
      (b) => b.firstSeen.getTime() >= sevenDaysAgo.getTime()
    ).length;

    return NextResponse.json({
      backlinks,
      summary: { totalCount, uniqueDomains, newThisWeek },
    });
  } catch (error) {
    console.error("Backlinks fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
