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

    const where: Prisma.SeoQueryWhereInput = page2only
      ? { position: { gte: 11, lte: 20 } }
      : {};

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
