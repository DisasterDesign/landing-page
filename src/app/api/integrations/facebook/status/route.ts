export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner, viewerErrorResponse } from "@/lib/auth/viewer";
import { getMetaConfig } from "@/lib/facebook";

export async function GET() {
  try {
    const { userId } = await requireOwner();

    const oauthConfigured = getMetaConfig() !== null;

    const integrations = await prisma.facebookIntegration.findMany({
      where: { userId },
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
    const authResponse = viewerErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Facebook status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
