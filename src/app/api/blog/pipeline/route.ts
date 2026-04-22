import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const ALL_STATUSES = [
  "DRAFT",
  "READY",
  "SCHEDULED",
  "PUBLISHED",
  "ARCHIVED",
] as const;

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [grouped, nextScheduled, keywords] = await Promise.all([
      prisma.blogPost.groupBy({
        by: ["status"],
        _count: { _all: true },
      }),
      prisma.blogPost.findFirst({
        where: { status: "SCHEDULED", scheduledAt: { gte: new Date() } },
        orderBy: { scheduledAt: "asc" },
        select: { id: true, title: true, slug: true, scheduledAt: true },
      }),
      prisma.blogPost.findMany({
        where: { targetKeyword: { not: null } },
        select: { targetKeyword: true },
        distinct: ["targetKeyword"],
      }),
    ]);

    const counts: Record<(typeof ALL_STATUSES)[number], number> = {
      DRAFT: 0,
      READY: 0,
      SCHEDULED: 0,
      PUBLISHED: 0,
      ARCHIVED: 0,
    };
    for (const row of grouped) {
      if (row.status in counts) {
        counts[row.status as (typeof ALL_STATUSES)[number]] = row._count._all;
      }
    }

    return NextResponse.json({
      counts,
      nextScheduled,
      totalKeywords: keywords.length,
    });
  } catch (error) {
    console.error("Pipeline stats error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
