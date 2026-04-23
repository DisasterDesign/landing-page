export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getMetaConfig } from "@/lib/facebook";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const oauthConfigured = getMetaConfig() !== null;

    const integrations = await prisma.facebookIntegration.findMany({
      where: { userId: session.user.id },
      select: {
        id: true,
        pageId: true,
        pageName: true,
        subscribedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const recentLeadCount = await prisma.contactSubmission.count({
      where: {
        source: "FACEBOOK",
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    });

    return NextResponse.json({
      oauthConfigured,
      integrations,
      recentLeadCount,
    });
  } catch (error) {
    console.error("Facebook status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
