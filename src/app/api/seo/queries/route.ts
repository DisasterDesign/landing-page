export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Prisma } from "@prisma/client";

const ALLOWED_SORT = new Set(["clicks", "impressions", "ctr", "position"]);

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const sort = url.searchParams.get("sort") || "clicks";
    const order = url.searchParams.get("order") === "asc" ? "asc" : "desc";
    const limit = Math.min(500, parseInt(url.searchParams.get("limit") || "50", 10));
    const page2only = url.searchParams.get("page2only") === "true";

    const sortField = ALLOWED_SORT.has(sort) ? sort : "clicks";

    // Rows are unique per (query, windowStart) — without pinning the latest
    // window, every synced week would add a duplicate of every query.
    const latest = await prisma.seoQuery.aggregate({ _max: { windowStart: true } });

    const where: Prisma.SeoQueryWhereInput = {
      ...(latest._max.windowStart ? { windowStart: latest._max.windowStart } : {}),
      // "Opportunities": high-value climb range — bottom of page 1 through
      // page 2 (8-20). Pushing 12→6 takes weeks; 50→6 takes a year.
      ...(page2only ? { position: { gte: 8, lte: 20 } } : {}),
    };

    const queries = await prisma.seoQuery.findMany({
      where,
      orderBy: { [sortField]: order },
      take: limit,
    });

    return NextResponse.json({ queries });
  } catch (error) {
    console.error("Queries fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
