export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isCronAuthorized } from "@/lib/cron-auth";

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
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
