export const dynamic = "force-dynamic";

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
      { userId: session.user.id, role: "ADMIN" },
      lead,
    );
    const notes = await prisma.contactNote.findMany({
      where: { contactId: id },
      include: { author: { select: { id: true, name: true } } },
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
      actor: { userId: session.user.id, role: "ADMIN" },
    });
    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    return leadDomainErrorResponse(error);
  }
}

export function DELETE() {
  return NextResponse.json(
    { error: "Lead notes are append-only" },
    { status: 405 },
  );
}
