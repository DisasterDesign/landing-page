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
    const allEnvKeys = Object.keys(process.env).sort();
    const debugEnv = {
      hasClientId: !!process.env.GOOGLE_CLIENT_ID,
      hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      hasRedirectUri: !!process.env.GOOGLE_REDIRECT_URI,
      clientIdPrefix: process.env.GOOGLE_CLIENT_ID?.substring(0, 6) || "EMPTY",
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      hasNextauthSecret: !!process.env.NEXTAUTH_SECRET,
      hasCronSecret: !!process.env.CRON_SECRET,
      totalEnvKeys: allEnvKeys.length,
      hasTestVar: !!process.env.TEST_VAR,
      testVarValue: process.env.TEST_VAR || "EMPTY",
      debugHardcoded: process.env.DEBUG_HARDCODED || "MISSING",
      debugClientId: process.env.DEBUG_CLIENT_ID || "MISSING",
      debugDbExists: process.env.DEBUG_DB_URL_EXISTS || "MISSING",
      envKeySample: allEnvKeys.filter(k => k.startsWith("GOOGLE") || k.startsWith("OAUTH") || k.startsWith("DATABASE") || k.startsWith("NEXTAUTH") || k.startsWith("CRON") || k.startsWith("BLOG") || k.startsWith("TEST")),
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
// plain-type-env-test
