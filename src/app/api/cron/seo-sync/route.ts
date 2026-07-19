export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isCronAuthorized } from "@/lib/cron-auth";
import { syncIntegration } from "@/lib/seo-sync";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const integrations = await prisma.googleIntegration.findMany({
    where: { gscSiteUrl: { not: null } },
    select: { userId: true },
  });

  const results = [];
  for (const { userId } of integrations) {
    const result = await syncIntegration(userId);
    results.push(result);
  }

  return NextResponse.json({
    synced: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
    results,
  });
}
