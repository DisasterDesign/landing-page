import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  PersistedRoleAuthorizationError,
  requirePersistedUserRole,
} from "@/lib/auth/persisted-role";
import { syncClientMonthly, parseProductBody, CLIENT_PRODUCT_SELECT } from "@/lib/client-products";

type Ctx = { params: Promise<{ id: string; productId: string }> };

// PATCH - edit one product (name, url, monthly, lane, dates)
export async function PATCH(request: NextRequest, { params }: Ctx) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await requirePersistedUserRole(session.user.id, ["ADMIN"]);

    const { id, productId } = await params;
    const existing = await prisma.clientProduct.findUnique({
      where: { id: productId },
      select: { clientId: true },
    });
    if (!existing || existing.clientId !== id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json();
    const data = parseProductBody(body);
    if ("name" in data && !data.name) {
      return NextResponse.json({ error: "שם המוצר חובה" }, { status: 400 });
    }

    const product = await prisma.clientProduct.update({
      where: { id: productId },
      data,
      select: CLIENT_PRODUCT_SELECT,
    });

    const monthlyAmount = await syncClientMonthly(id);

    return NextResponse.json({ product, monthlyAmount });
  } catch (error) {
    if (error instanceof PersistedRoleAuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Error updating client product:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE - archive a product. Never a hard delete: the monthly figure it
// carried is part of the historical profit split, and the last product of a
// client must not vanish silently either.
export async function DELETE(_request: NextRequest, { params }: Ctx) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await requirePersistedUserRole(session.user.id, ["ADMIN"]);

    const { id, productId } = await params;
    const existing = await prisma.clientProduct.findUnique({
      where: { id: productId },
      select: { clientId: true, archivedAt: true },
    });
    if (!existing || existing.clientId !== id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (!existing.archivedAt) {
      await prisma.clientProduct.update({
        where: { id: productId },
        data: { archivedAt: new Date() },
      });
    }

    const monthlyAmount = await syncClientMonthly(id);

    return NextResponse.json({ success: true, monthlyAmount });
  } catch (error) {
    if (error instanceof PersistedRoleAuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Error archiving client product:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
