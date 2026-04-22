export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const isVercelCron = req.headers.get("user-agent")?.includes("vercel-cron");
  const auth = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || "";
  const expected = cronSecret ? `Bearer ${cronSecret}` : null;
  const isAuthorized =
    isVercelCron || (expected !== null && auth === expected) || !expected;

  if (!isAuthorized) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const now = new Date();

  const due = await prisma.blogPost.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: now } },
    select: { id: true, slug: true, title: true },
  });

  if (due.length > 0) {
    await prisma.blogPost.updateMany({
      where: { id: { in: due.map((p) => p.id) } },
      data: {
        status: "PUBLISHED",
        published: true,
        publishedAt: now,
      },
    });
  }

  return NextResponse.json({
    published: due.length,
    posts: due,
  });
}
