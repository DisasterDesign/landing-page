import { financeClientScope } from "@/lib/finance/access";
import { requireAdmin, viewerErrorResponse } from "@/lib/auth/viewer";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { PersistedRoleAuthorizationError, requirePersistedUserRole } from "@/lib/auth/persisted-role";
import { createClientNoteSchema } from "@/lib/validations";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await requirePersistedUserRole(session.user.id, ["ADMIN"]);
    const viewer = await requireAdmin();
    if (!viewer.isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const visibleClient = await prisma.client.findFirst({ where: { id, ...financeClientScope(viewer) }, select: { id: true } });
    if (!visibleClient) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const notes = await prisma.clientNote.findMany({
      where: { clientId: id },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: notes });
  } catch (error) {
    const financeError = viewerErrorResponse(error);
    if (financeError) return financeError;
    if (error instanceof PersistedRoleAuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Error fetching client notes:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await requirePersistedUserRole(session.user.id, ["ADMIN"]);
    const viewer = await requireAdmin();
    if (!viewer.isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    const visibleClient = await prisma.client.findFirst({ where: { id, ...financeClientScope(viewer) }, select: { id: true } });
    if (!visibleClient) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const body = await request.json();
    const parsed = createClientNoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const client = await prisma.client.findUnique({ where: { id }, select: { id: true } });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const note = await prisma.clientNote.create({
      data: {
        clientId: id,
        authorId: session.user.id,
        body: parsed.data.body,
      },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    const financeError = viewerErrorResponse(error);
    if (financeError) return financeError;
    if (error instanceof PersistedRoleAuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Error creating client note:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
