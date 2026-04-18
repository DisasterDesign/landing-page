export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getGoogleConfig } from "@/lib/google-oauth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const oauthConfigured = getGoogleConfig() !== null;

    // DEBUG — remove after confirming
    const debug = {
      processEnvLen: (process.env.GOOGLE_CLIENT_ID || "").length,
      hasSecret: !!(process.env.GOOGLE_CLIENT_SECRET),
      hasRedirect: !!(process.env.GOOGLE_REDIRECT_URI),
      redirectVal: (process.env.GOOGLE_REDIRECT_URI || "").slice(0, 30),
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
      debug,
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
