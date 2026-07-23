import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { assertActorCanMutateLead } from "@/lib/leads/authorization";
import { leadDomainErrorResponse } from "@/lib/leads/http";
import { addLeadNote } from "@/lib/leads/interactions";
import { prisma } from "@/lib/prisma";
import { leadCompanyNoteSchema } from "@/lib/validations";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;
    const lead = await prisma.contactSubmission.findUnique({
      where: { id },
      select: {
        ownerId: true,
        migrationReviewRequired: true,
        intentLevel: true,
        sourceKey: true,
        stage: true,
      },
    });
    if (!lead) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await assertActorCanMutateLead(
      prisma,
      { userId: session.user.id, role: "SELLER" },
      lead,
    );
    // Sellers see only their OWN notes — restored pre-unified behaviour.
    // Admin notes may carry internal context (pricing floors, client history)
    // that is not for sellers; the admin side still sees the full thread.
    const notes = await prisma.contactNote.findMany({
      where: { contactId: id, authorId: session.user.id },
      select: {
        id: true,
        body: true,
        createdAt: true,
        author: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ notes });
  } catch (error) {
    return leadDomainErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = leadCompanyNoteSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  try {
    const { id } = await params;
    const note = await addLeadNote({
      leadId: id,
      body: parsed.data.body,
      actor: { userId: session.user.id, role: "SELLER" },
    });
    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    return leadDomainErrorResponse(error);
  }
}

export function DELETE() {
  // Kept append-only deliberately: notes are part of the lead's commercial
  // history, and the writer-boundary invariant tests enforce that no API
  // route mutates it destructively. (Sellers still only SEE their own notes
  // — the privacy filter lives in GET above.)
  return NextResponse.json(
    { error: "Lead notes are append-only" },
    { status: 405 },
  );
}
