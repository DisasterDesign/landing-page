import { financeClientScope, financeProductScope, requireBookSelection } from "@/lib/finance/access";
import { requireAdmin, viewerErrorResponse } from "@/lib/auth/viewer";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { PersistedRoleAuthorizationError, requirePersistedUserRole } from "@/lib/auth/persisted-role";
import { syncClientMonthly, parseProductBody, CLIENT_PRODUCT_SELECT } from "@/lib/client-products";

// GET - list a client's active products
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

    const { id } = await params;
    const visibleClient = await prisma.client.findFirst({ where: { id, ...financeClientScope(viewer) }, select: { id: true } });
    if (!visibleClient) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const products = await prisma.clientProduct.findMany({
      where: { clientId: id, archivedAt: null, ...financeProductScope(viewer) },
      select: CLIENT_PRODUCT_SELECT,
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ data: products });
  } catch (error) {
    const financeError = viewerErrorResponse(error);
    if (financeError) return financeError;
    if (error instanceof PersistedRoleAuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Error fetching client products:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - add a product (another site / system / retainer line) to a client
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

    const { id } = await params;
    const visibleClient = await prisma.client.findFirst({ where: { id, ...financeClientScope(viewer) }, select: { id: true } });
    if (!visibleClient) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const client = await prisma.client.findUnique({ where: { id }, select: { id: true } });
    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const body = await request.json();
    const data = parseProductBody(body);
    const financeBook = requireBookSelection(viewer, body.financeBook, viewer.isOwner ? "PRIVATE" : "SHARED");
    if (!data.name) {
      return NextResponse.json({ error: "שם המוצר חובה" }, { status: 400 });
    }

    if ("agreementId" in body) {
      if (!viewer.isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      if (body.agreementId) {
        const linked = await prisma.agreement.findFirst({ where: { id: String(body.agreementId), clientId: id, financeBook }, select: { id: true } });
        if (!linked) return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
    }
    const product = await prisma.clientProduct.create({
      data: { ...data, financeBook, clientId: id, name: data.name as string },
      select: CLIENT_PRODUCT_SELECT,
    });

    const monthlyAmount = await syncClientMonthly(id);

    return NextResponse.json({ product, monthlyAmount: viewer.isOwner ? monthlyAmount : undefined }, { status: 201 });
  } catch (error) {
    const financeError = viewerErrorResponse(error);
    if (financeError) return financeError;
    if (error instanceof PersistedRoleAuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Error creating client product:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
