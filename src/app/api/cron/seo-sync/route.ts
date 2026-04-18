import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncIntegration } from "@/lib/seo-sync";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  // Vercel cron sends a special header. Also accept a CRON_SECRET bearer for
  // manual triggers from the local CLI.
  const isVercelCron = req.headers.get("user-agent")?.includes("vercel-cron");
  const auth = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET
    ? `Bearer ${process.env.CRON_SECRET}`
    : null;
  const isAuthorized =
    isVercelCron || (expected !== null && auth === expected) || !expected;

  if (!isAuthorized) {
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
