export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getGoogleConfig } from "@/lib/google-oauth";
import * as envValues from "@/lib/env-values";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const oauthConfigured = getGoogleConfig() !== null;

    // DEBUG — remove after confirming env injection works
    const debug = {
      envValuesClientId: !!envValues.GOOGLE_CLIENT_ID,
      envValuesClientIdLen: (envValues.GOOGLE_CLIENT_ID || "").length,
      processEnvClientId: !!process.env.GOOGLE_CLIENT_ID,
      processEnvClientIdLen: (process.env.GOOGLE_CLIENT_ID || "").length,
      allEnvValuesKeys: Object.keys(envValues).filter(k => !k.startsWith("__")),
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
