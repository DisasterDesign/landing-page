export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const schema = z.object({
  body: z.string().min(1, "תוכן ההערה חובה").max(2000),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const note = await prisma.contactNote.create({
      data: {
        contactId: id,
        authorId: session.user.id,
        body: parsed.data.body.trim(),
      },
      include: { author: { select: { id: true, name: true } } },
    });

    // Touch lastContactedAt and bump status from NEW → IN_PROGRESS
    await prisma.contactSubmission.update({
      where: { id },
      data: {
        lastContactedAt: new Date(),
        isRead: true,
        status: { set: undefined }, // no-op placeholder; conditionally update below
      },
    }).catch(() => {});
    // Separate "if NEW → IN_PROGRESS" update so we don't override CLOSED/SPAM.
    await prisma.contactSubmission.updateMany({
      where: { id, status: "NEW" },
      data: { status: "IN_PROGRESS" },
    });

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    console.error("Lead note create error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
