import { financeClientScope } from "@/lib/finance/access";
import { requireAdmin, viewerErrorResponse } from "@/lib/auth/viewer";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { PersistedRoleAuthorizationError, requirePersistedUserRole } from "@/lib/auth/persisted-role";

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
    const body = await request.json().catch(() => ({}));
    const restore = body?.restore === true;

    const client = await prisma.client.update({
      where: { id },
      data: { archivedAt: restore ? null : new Date() },
    });

    return NextResponse.json(client);
  } catch (error) {
    const financeError = viewerErrorResponse(error);
    if (financeError) return financeError;
    if (error instanceof PersistedRoleAuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Error archiving client:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
