import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

/**
 * A seller's private working log on a lead — "called, no answer, retry
 * tomorrow" style notes. Reuses ContactNote (the admin side already stores
 * lead notes there), scoped hard to the caller: a seller reads and deletes
 * ONLY their own notes. Admin notes on the same lead may carry internal
 * context that is not for sellers, and the numbering Elad asked for only
 * makes sense over one person's sequence anyway.
 */

// GET - my notes on this lead, oldest first (stable numbering: first = #1)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const notes = await prisma.contactNote.findMany({
      where: { contactId: id, authorId: session.user.id },
      select: { id: true, body: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ notes });
  } catch (error) {
    console.error("Error fetching seller lead notes:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

const createSchema = z.object({ body: z.string().trim().min(1, "פתק ריק").max(2000) });

// POST - add a note
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const parsed = createSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "פתק ריק" }, { status: 400 });
    }

    const lead = await prisma.contactSubmission.findUnique({ where: { id }, select: { id: true } });
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 });
    }

    const note = await prisma.contactNote.create({
      data: { contactId: id, authorId: session.user.id, body: parsed.data.body },
      select: { id: true, body: true, createdAt: true },
    });

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    console.error("Error creating seller lead note:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE - remove one of MY notes (?noteId=...)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const noteId = new URL(request.url).searchParams.get("noteId");
    if (!noteId) {
      return NextResponse.json({ error: "noteId חובה" }, { status: 400 });
    }

    // deleteMany with the full ownership predicate — deleting someone else's
    // note (or a note from another lead) is a silent no-op, not an error probe.
    const res = await prisma.contactNote.deleteMany({
      where: { id: noteId, contactId: id, authorId: session.user.id },
    });

    return NextResponse.json({ deleted: res.count });
  } catch (error) {
    console.error("Error deleting seller lead note:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
