export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner, viewerErrorResponse } from "@/lib/auth/viewer";

const ALLOWED_SORT = new Set(["clicks", "impressions", "ctr", "position"]);

export async function GET(req: NextRequest) {
  try {
    await requireOwner();

    const url = new URL(req.url);
    const sort = url.searchParams.get("sort") || "clicks";
    const order = url.searchParams.get("order") === "asc" ? "asc" : "desc";
    const limit = Math.min(500, parseInt(url.searchParams.get("limit") || "50", 10));
    const sortField = ALLOWED_SORT.has(sort) ? sort : "clicks";

    // Aggregate SeoQuery rows by topPage to derive page-level stats.
    const queries = await prisma.seoQuery.findMany({
      where: { topPage: { not: null } },
      select: {
        topPage: true,
        clicks: true,
        impressions: true,
        position: true,
      },
    });

    const byPage = new Map<
      string,
      { page: string; clicks: number; impressions: number; positionSum: number }
    >();
    for (const q of queries) {
      if (!q.topPage) continue;
      const entry = byPage.get(q.topPage) ?? {
        page: q.topPage,
        clicks: 0,
        impressions: 0,
        positionSum: 0,
      };
      entry.clicks += q.clicks;
      entry.impressions += q.impressions;
      entry.positionSum += q.position * q.impressions;
      byPage.set(q.topPage, entry);
    }

    const pages = Array.from(byPage.values()).map((p) => ({
      page: p.page,
      clicks: p.clicks,
      impressions: p.impressions,
      ctr: p.impressions > 0 ? p.clicks / p.impressions : 0,
      position: p.impressions > 0 ? p.positionSum / p.impressions : 0,
    }));

    pages.sort((a, b) => {
      const av = a[sortField as keyof typeof a] as number;
      const bv = b[sortField as keyof typeof b] as number;
      return order === "asc" ? av - bv : bv - av;
    });

    return NextResponse.json({ pages: pages.slice(0, limit) });
  } catch (error) {
    const authResponse = viewerErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Pages fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
