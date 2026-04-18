export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getFreshAccessToken } from "@/lib/google-oauth";
import { fetchReferralSources } from "@/lib/analytics";

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const integration = await prisma.googleIntegration.findUnique({
      where: { userId: session.user.id },
      select: { ga4PropertyId: true },
    });

    if (!integration?.ga4PropertyId) {
      return NextResponse.json(
        { error: "יש לבחור נכס Analytics קודם", referrals: [] },
        { status: 400 }
      );
    }

    const accessToken = await getFreshAccessToken(session.user.id);
    if (!accessToken) {
      return NextResponse.json({ error: "לא מחובר ל-Google" }, { status: 400 });
    }

    const today = new Date();
    const startDate = new Date(today);
    startDate.setUTCDate(startDate.getUTCDate() - 28);

    const referrals = await fetchReferralSources(
      accessToken,
      integration.ga4PropertyId,
      ymd(startDate),
      ymd(today)
    );

    referrals.sort((a, b) => b.sessions - a.sessions);

    return NextResponse.json({ referrals });
  } catch (error) {
    console.error("Referrals fetch error:", error);
    return NextResponse.json(
      { error: "Internal server error", referrals: [] },
      { status: 500 }
    );
  }
}
