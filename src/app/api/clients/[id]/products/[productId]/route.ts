import { financeProductScope, requireBookSelection, requireUnpaidBookChange } from "@/lib/finance/access";
import { requireAdmin, viewerErrorResponse } from "@/lib/auth/viewer";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { PersistedRoleAuthorizationError, requirePersistedUserRole } from "@/lib/auth/persisted-role";
import { syncClientMonthly, parseProductBody, CLIENT_PRODUCT_SELECT } from "@/lib/client-products";
import { correctProductPrice } from "@/lib/finance/product-price-write";
import { ProductPriceError } from "@/lib/finance/product-price";

type Ctx = { params: Promise<{ id: string; productId: string }> };

// Price provenance is owner-only, even for a shared product.
export async function GET(_request: NextRequest, { params }: Ctx) {
  try {
    const viewer = await requireAdmin();
    if (!viewer.isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    const { id, productId } = await params;
    const product = await prisma.clientProduct.findFirst({ where: { id: productId, clientId: id, archivedAt: null }, select: { id: true } });
    if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const revisions = await prisma.clientProductPriceRevision.findMany({ where: { productId }, orderBy: { version: "desc" }, take: 20 });
    return NextResponse.json({ revisions });
  } catch (error) {
    return viewerErrorResponse(error) ?? NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

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
    if ("priceCorrection" in body) {
      if (!viewer.isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      if (Object.keys(body).length !== 1 || !body.priceCorrection || typeof body.priceCorrection !== "object" || Array.isArray(body.priceCorrection)) {
        return NextResponse.json({ error: "יש לשלוח תיקון מחיר בנפרד" }, { status: 400 });
      }
      const result = await prisma.$transaction(db => correctProductPrice(db, viewer.userId, id, productId, body.priceCorrection), { isolationLevel: "Serializable" });
      return NextResponse.json(result);
    }
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
    const result = await prisma.$transaction(async db => {
      // Older inline editors cannot turn a corrected USD price into shekels.
      const changed = await db.clientProduct.updateMany({
        where: { id: productId, clientId: id, ...( "monthlyAmount" in data ? { monthlyPriceVersion: 0 } : {}) }, data,
      });
      if (changed.count !== 1) throw new ProductPriceError("יש לערוך מחיר מתועד דרך תיקון מחיר", 409);
      const product = await db.clientProduct.findUniqueOrThrow({ where: { id: productId }, select: CLIENT_PRODUCT_SELECT });
      const monthlyAmount = await syncClientMonthly(id, db);
      return { product, monthlyAmount: viewer.isOwner ? monthlyAmount : undefined };
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ProductPriceError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error && typeof error === "object" && "code" in error && error.code === "P2034") return NextResponse.json({ error: "המחיר השתנה; יש לטעון מחדש" }, { status: 409 });
    const financeError = viewerErrorResponse(error);
    if (financeError) return financeError;
    if (error instanceof PersistedRoleAuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Error updating client product");
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
