import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  PersistedRoleAuthorizationError,
  requirePersistedUserRole,
} from "@/lib/auth/persisted-role";
import { CLIENT_PRODUCT_SELECT, syncClientMonthly } from "@/lib/client-products";
import { decideClientDeletion } from "@/lib/clients/deletion";

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

    const { id } = await params;
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        agreements: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            tier: true,
            monthlyPrice: true,
            oneTimeFee: true,
            status: true,
            customerName: true,
            signedAt: true,
            createdAt: true,
            // The card links to /agreement/[token] and its PDF. Without the
            // token both hrefs render /agreement/undefined.
            signToken: true,
          },
        },
        clientNotes: {
          orderBy: { createdAt: "desc" },
          include: {
            author: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
        products: {
          where: { archivedAt: null },
          select: CLIENT_PRODUCT_SELECT,
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(client);
  } catch (error) {
    if (error instanceof PersistedRoleAuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Error fetching client:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await requirePersistedUserRole(session.user.id, ["ADMIN"]);

    const { id } = await params;
    const body = await request.json();

    const updateData: Record<string, unknown> = {};
    if ("name" in body) updateData.name = body.name;
    if ("status" in body) updateData.status = body.status;
    if ("notes" in body) updateData.notes = body.notes || null;
    if ("amount" in body)
      updateData.amount =
        body.amount !== null && body.amount !== "" ? parseFloat(body.amount) : null;
    // monthlyAmount is a rollup of the client's products, so it must never be
    // written straight onto the client — the next product edit would silently
    // overwrite it and the partner report would drift. With a single product
    // the intent is unambiguous, so route the edit there and re-roll. With
    // several, refuse rather than guess which site the money belongs to.
    let rolledMonthly: number | null = null;
    if ("monthlyAmount" in body) {
      const products = await prisma.clientProduct.findMany({
        where: { clientId: id, archivedAt: null },
        select: { id: true },
      });
      if (products.length > 1) {
        return NextResponse.json(
          { error: "ללקוח יש כמה מוצרים — ערוך את הסכום החודשי ברמת המוצר" },
          { status: 409 }
        );
      }
      const value =
        body.monthlyAmount !== null && body.monthlyAmount !== "" ? parseFloat(body.monthlyAmount) : null;
      if (products.length === 1) {
        await prisma.clientProduct.update({
          where: { id: products[0].id },
          data: { monthlyAmount: value },
        });
        rolledMonthly = await syncClientMonthly(id);
      } else {
        updateData.monthlyAmount = value;
      }
    }
    if ("expense" in body)
      updateData.expense =
        body.expense !== null && body.expense !== "" ? parseFloat(body.expense) : null;
    if ("cardcomFee" in body)
      updateData.cardcomFee =
        body.cardcomFee !== null && body.cardcomFee !== "" ? parseFloat(body.cardcomFee) : null;
    if ("websiteUrl" in body)
      updateData.websiteUrl = body.websiteUrl ? String(body.websiteUrl).trim() || null : null;
    if ("email" in body)
      updateData.email = body.email ? String(body.email).trim().toLowerCase() || null : null;
    if ("phone" in body)
      updateData.phone = body.phone ? String(body.phone).trim() || null : null;
    if ("businessName" in body)
      updateData.businessName = body.businessName ? String(body.businessName).trim() || null : null;
    if ("idNumber" in body)
      updateData.idNumber = body.idNumber ? String(body.idNumber).trim() || null : null;
    if ("startDate" in body)
      updateData.startDate =
        body.startDate ? new Date(body.startDate).toISOString() : null;
    if ("paymentDate" in body)
      updateData.paymentDate =
        body.paymentDate ? new Date(body.paymentDate).toISOString() : null;
    if ("partner" in body) {
      const v = String(body.partner ?? "").trim();
      updateData.partner = v || "fuzion";
    }

    const client = await prisma.client.update({
      where: { id },
      data: updateData,
    });

    // The rollup already wrote the authoritative figure; make sure the
    // response carries it rather than the pre-update value.
    return NextResponse.json(
      rolledMonthly !== null ? { ...client, monthlyAmount: rolledMonthly } : client
    );
  } catch (error) {
    if (error instanceof PersistedRoleAuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Error updating client:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await requirePersistedUserRole(session.user.id, ["ADMIN"]);

    const { id } = await params;

    // A client with any financial trace is ARCHIVED, never deleted. This
    // route hard-deleted סולל בונה in Aug 2026 and onDelete: Cascade took
    // three one-off jobs (₪4,000) with it; the DB's 6-hour history window had
    // long closed. See src/lib/clients/deletion.ts.
    const history = await prisma.client.findUnique({
      where: { id },
      select: {
        _count: {
          select: { jobs: true, agreements: true, products: true, expenses: true },
        },
        agreements: { select: { _count: { select: { charges: true } } } },
      },
    });
    if (!history) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const decision = decideClientDeletion({
      jobs: history._count.jobs,
      agreements: history._count.agreements,
      products: history._count.products,
      expenses: history._count.expenses,
      charges: history.agreements.reduce((n, a) => n + a._count.charges, 0),
    });

    if (decision.action === "archive") {
      await prisma.client.update({
        where: { id },
        data: { archivedAt: new Date() },
      });
      return NextResponse.json({
        success: true,
        action: "archived",
        reason: decision.reason,
      });
    }

    await prisma.client.delete({ where: { id } });
    return NextResponse.json({ success: true, action: "deleted" });
  } catch (error) {
    if (error instanceof PersistedRoleAuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Error deleting client:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
