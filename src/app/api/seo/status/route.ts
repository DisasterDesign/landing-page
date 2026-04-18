export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getGoogleConfig } from "@/lib/google-oauth";
import * as envRuntime from "@/lib/env-runtime";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const oauthConfigured = getGoogleConfig() !== null;

    // Debug - will remove after confirming fix
    const debugEnv = {
      processEnv: !!process.env.GOOGLE_CLIENT_ID,
      injectedModule: !!envRuntime.GOOGLE_CLIENT_ID,
      oauthConfigured,
    };

    const integration = await prisma.googleIntegration.findUnique({
      where: { userId: session.user.id },
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
      debugEnv,
      connected: integration !== null,
      integration,
    });
  } catch (error) {
    console.error("Error fetching seo status:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
