export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner, viewerErrorResponse } from "@/lib/auth/viewer";
import { getGoogleConfig } from "@/lib/google-oauth";

export async function GET() {
  try {
    const { userId } = await requireOwner();

    const oauthConfigured = getGoogleConfig() !== null;

    const integration = await prisma.googleIntegration.findUnique({
      where: { userId },
      select: {
        email: true,
        gscSiteUrl: true,
        ga4PropertyId: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      oauthConfigured,
      connected: integration !== null,
      integration,
    });
  } catch (error) {
    const authResponse = viewerErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Error fetching seo status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
