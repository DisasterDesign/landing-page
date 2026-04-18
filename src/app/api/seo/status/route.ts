export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getGoogleConfig } from "@/lib/google-oauth";
import { getInjectedEnv } from "@/lib/env-injected-reader";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const oauthConfigured = getGoogleConfig() !== null;

    // DEBUG — remove after confirming env injection works
    const env = getInjectedEnv();
    const debug = {
      injectedClientIdLen: (env.GOOGLE_CLIENT_ID || "").length,
      injectedKeys: Object.keys(env),
      processEnvClientIdLen: (process.env.GOOGLE_CLIENT_ID || "").length,
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
