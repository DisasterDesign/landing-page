import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner, viewerErrorResponse } from "@/lib/auth/viewer";
import { bulkScheduleBlogPostSchema } from "@/lib/validations";
import { addDays, nextSunday, setHours, setMinutes, setSeconds, setMilliseconds, startOfDay } from "date-fns";

function nextSundayAt7UTC(from: Date): Date {
  const base = startOfDay(from);
  const sunday = from.getUTCDay() === 0 ? base : nextSunday(base);
  return setMilliseconds(
    setSeconds(setMinutes(setHours(sunday, 7), 0), 0),
    0
  );
}

export async function POST(request: NextRequest) {
  try {
    await requireOwner();

    const body = await request.json().catch(() => ({}));
    const parsed = bulkScheduleBlogPostSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const intervalDays = parsed.data.intervalDays ?? 7;
    const startDate = parsed.data.startDate
      ? new Date(parsed.data.startDate)
      : nextSundayAt7UTC(new Date());

    const readyPosts = await prisma.blogPost.findMany({
      where: { status: "READY" },
      orderBy: { createdAt: "asc" },
      select: { id: true, slug: true, title: true },
    });

    if (readyPosts.length === 0) {
      return NextResponse.json({ scheduled: 0, posts: [] });
    }

    const updates = readyPosts.map((post, i) => {
      const scheduledAt = addDays(startDate, i * intervalDays);
      return { id: post.id, slug: post.slug, title: post.title, scheduledAt };
    });

    await prisma.$transaction(
      updates.map((u) =>
        prisma.blogPost.update({
          where: { id: u.id },
          data: { status: "SCHEDULED", scheduledAt: u.scheduledAt },
        })
      )
    );

    return NextResponse.json({
      scheduled: updates.length,
      posts: updates,
    });
  } catch (error) {
    const authResponse = viewerErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Bulk schedule error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
