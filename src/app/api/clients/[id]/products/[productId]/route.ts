import { financeProductScope, requireBookSelection, requireUnpaidBookChange } from "@/lib/finance/access";
import { requireAdmin, viewerErrorResponse } from "@/lib/auth/viewer";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { PersistedRoleAuthorizationError, requirePersistedUserRole } from "@/lib/auth/persisted-role";
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
    const viewer = await requireAdmin();

    const { id, productId } = await params;
    const visibleProduct = await prisma.clientProduct.findFirst({ where: { id: productId, clientId: id, ...financeProductScope(viewer) }, select: { id: true } });
    if (!visibleProduct) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const existing = await prisma.clientProduct.findUnique({
      where: { id: productId },
      select: { clientId: true, financeBook: true, agreementId: true, paymentDate: true },
    });
    if (!existing || existing.clientId !== id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json();
    const data = parseProductBody(body);
    const financeBook = requireBookSelection(viewer, body.financeBook, existing.financeBook);
    if (existing.paymentDate && "paymentDate" in body && !body.paymentDate) return NextResponse.json({ error: "לא ניתן למחוק תאריך תשלום מרשומה כספית" }, { status: 409 });
    if (financeBook !== existing.financeBook || ("agreementId" in body && body.agreementId !== existing.agreementId)) {
      const payments = await prisma.financeTransaction.count({ where: { OR: [{ clientProductId: productId }, ...(existing.agreementId ? [{ agreementId: existing.agreementId }] : [])] } });
      const agreement = existing.agreementId ? await prisma.agreement.findUnique({ where: { id: existing.agreementId }, select: { paidAt: true, _count: { select: { charges: true } } } }) : null;
      requireUnpaidBookChange(existing.financeBook, financeBook, Boolean(existing.paymentDate) || payments > 0 || Boolean(agreement?.paidAt) || (agreement?._count.charges ?? 0) > 0);
      if (existing.agreementId) return NextResponse.json({ error: "יש ליצור מוצר חדש לשינוי שיוך הסכם" }, { status: 409 });
    }
    data.financeBook = financeBook;
    if ("name" in data && !data.name) {
      return NextResponse.json({ error: "שם המוצר חובה" }, { status: 400 });
    }

    if ("agreementId" in body) {
      if (!viewer.isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      if (body.agreementId) {
        const linked = await prisma.agreement.findFirst({ where: { id: String(body.agreementId), clientId: id, financeBook }, select: { id: true } });
        if (!linked) return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }
    const product = await prisma.clientProduct.update({
      where: { id: productId },
      data,
      select: CLIENT_PRODUCT_SELECT,
    });

    const monthlyAmount = await syncClientMonthly(id);

    return NextResponse.json({ product, monthlyAmount: viewer.isOwner ? monthlyAmount : undefined });
  } catch (error) {
    const financeError = viewerErrorResponse(error);
    if (financeError) return financeError;
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
    const viewer = await requireAdmin();

    const { id, productId } = await params;
    const visibleProduct = await prisma.clientProduct.findFirst({ where: { id: productId, clientId: id, ...financeProductScope(viewer) }, select: { id: true } });
    if (!visibleProduct) return NextResponse.json({ error: "Not found" }, { status: 404 });
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

    return NextResponse.json({ success: true, monthlyAmount: viewer.isOwner ? monthlyAmount : undefined });
  } catch (error) {
    const financeError = viewerErrorResponse(error);
    if (financeError) return financeError;
    if (error instanceof PersistedRoleAuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Error archiving client product:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
