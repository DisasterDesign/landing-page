export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { syncIntegration } from "@/lib/seo-sync";

export const maxDuration = 120;

const RATE_LIMIT_MS = 5 * 60 * 1000; // 5 minutes

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const lastSnapshot = await prisma.seoSnapshot.findFirst({
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (
      lastSnapshot &&
      Date.now() - lastSnapshot.createdAt.getTime() < RATE_LIMIT_MS
    ) {
      return NextResponse.json(
        {
          error: "סנכרון בוצע לאחרונה. נסה שוב בעוד כמה דקות.",
        },
        { status: 429 }
      );
    }

    const result = await syncIntegration(session.user.id);
    if (!result.ok) {
      return NextResponse.json(
        { error: `הסנכרון נכשל: ${result.error}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: `הסנכרון הושלם — ${result.daysSynced} ימים, ${result.queriesSynced} מילים`,
    });
  } catch (error) {
    console.error("Refresh error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
