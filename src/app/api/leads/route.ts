export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Prisma } from "@prisma/client";

// GET /api/leads — list contacts. Defaults to "open" leads (NEW + IN_PROGRESS).
// ?all=true to include closed/spam, ?search=q for filter.
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const all = url.searchParams.get("all") === "true";
    const search = url.searchParams.get("search")?.trim();

    const where: Prisma.ContactSubmissionWhereInput = {
      ...(all ? {} : { status: { in: ["NEW", "IN_PROGRESS"] } }),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { email: { contains: search, mode: "insensitive" } },
              { phone: { contains: search } },
              { message: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const leads = await prisma.contactSubmission.findMany({
      where,
      orderBy: [
        { nextFollowUpAt: { sort: "asc", nulls: "last" } },
        { createdAt: "desc" },
      ],
      include: {
        _count: { select: { notes: true } },
      },
      take: 200,
    });

    // Summary stats for the cards
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const weekAhead = new Date(startOfDay);
    weekAhead.setDate(weekAhead.getDate() + 7);
    const weekAgo = new Date(startOfDay);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [openCount, dueThisWeekCount, newThisWeekCount] = await Promise.all([
      prisma.contactSubmission.count({
        where: { status: { in: ["NEW", "IN_PROGRESS"] } },
      }),
      prisma.contactSubmission.count({
        where: {
          status: { in: ["NEW", "IN_PROGRESS"] },
          nextFollowUpAt: { lte: weekAhead },
        },
      }),
      prisma.contactSubmission.count({
        where: { createdAt: { gte: weekAgo } },
      }),
    ]);

    return NextResponse.json({
      leads,
      stats: { openCount, dueThisWeekCount, newThisWeekCount },
    });
  } catch (error) {
    console.error("Leads list error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
