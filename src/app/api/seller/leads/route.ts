import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import type { Prisma } from "@prisma/client";

// GET - all leads (sellers share the pool and take turns claiming).
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();

    const where: Prisma.ContactSubmissionWhereInput = search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { phone: { contains: search } },
            { email: { contains: search, mode: "insensitive" } },
            { company: { contains: search, mode: "insensitive" } },
          ],
        }
      : {};

    const leads = await prisma.contactSubmission.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        company: true,
        service: true,
        message: true,
        status: true,
        source: true,
        createdAt: true,
        assignees: { select: { id: true, name: true } },
        // Count only the CALLER's notes — the numbered log is personal, and
        // the badge should say "you have 3 notes here", not "someone does".
        _count: { select: { notes: { where: { authorId: session.user.id } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    });

    return NextResponse.json({
      leads: leads.map(({ _count, ...l }) => ({ ...l, myNotesCount: _count.notes })),
    });
  } catch (error) {
    console.error("Error listing seller leads:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
