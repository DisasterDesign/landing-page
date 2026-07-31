import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  PersistedRoleAuthorizationError,
  requirePersistedUserRole,
} from "@/lib/auth/persisted-role";
import { CLIENT_PRODUCT_SELECT, syncClientMonthly } from "@/lib/client-products";
import { requireOwner, viewerErrorResponse } from "@/lib/auth/viewer";

// GET - Auth required: list all clients
//
// Optional `?partnerId=` narrows the list to the clients that partner
// generated. It is an owner-only lens — the partners board uses it to drill
// from a payout row into the deals behind it — NOT a partner's own scoping.
// Partners never reach this route (the ADMIN guard below already stops them);
// their scoping is enforced query-side in the /seller surface via clientScope.
// Without the param the query is untouched, so every existing caller behaves
// exactly as before.
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await requirePersistedUserRole(session.user.id, ["ADMIN"]);

    const partnerId = new URL(request.url).searchParams.get("partnerId");
    // Only the owner may look at the business through another person's eyes.
    // Checked only when the param is present, so the unfiltered path keeps
    // its original single role check and its original cost.
    if (partnerId) await requireOwner();

    const clients = await prisma.client.findMany({
      // A merged-away client is archived, not deleted — its history still
      // matters. It must not keep occupying a row in the table though.
      // `ownerId` is the derived mirror of the client's first agreement's
      // partnerId — attribution is decided on the agreement, never here.
      where: {
        archivedAt: null,
        ...(partnerId ? { ownerId: partnerId } : {}),
      },
      orderBy: { number: "asc" },
      include: {
        products: {
          where: { archivedAt: null },
          select: CLIENT_PRODUCT_SELECT,
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return NextResponse.json({ data: clients });
  } catch (error) {
    if (error instanceof PersistedRoleAuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    // Only reachable from the `?partnerId=` branch above — a non-owner asking
    // for someone else's clients gets 403, not a 500.
    const viewerError = viewerErrorResponse(error);
    if (viewerError) return viewerError;
    console.error("Error fetching clients:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Auth required: create new client
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await requirePersistedUserRole(session.user.id, ["ADMIN"]);

    const body = await request.json();

    const client = await prisma.client.create({
      data: {
        name: body.name || "",
        status: body.status || "",
        notes: body.notes || null,
        amount: body.amount != null ? parseFloat(body.amount) : null,
        expense: body.expense != null ? parseFloat(body.expense) : null,
        // A hand-created client is the admin's own deal — partner deals
        // arrive through agreements, which attribute ownership at signing.
        ownerId: session.user.id,
      },
    });

    // Every client owns at least one product — the grouped table, the rollup
    // and the lane split all assume it, so a client with zero products would
    // read as ₪0 MRR rather than "not filled in yet".
    const product = await prisma.clientProduct.create({
      data: {
        clientId: client.id,
        name: client.name || "מוצר ראשי",
        status: client.status,
        monthlyAmount: body.monthlyAmount != null ? parseFloat(body.monthlyAmount) : null,
        websiteUrl: body.websiteUrl ? String(body.websiteUrl).trim() || null : null,
      },
      select: CLIENT_PRODUCT_SELECT,
    });
    const monthlyAmount = await syncClientMonthly(client.id);

    // Must carry `products` — the clients table reads products.length on every
    // row, so returning a bare client would crash the render for the new row.
    return NextResponse.json({ ...client, monthlyAmount, products: [product] }, { status: 201 });
  } catch (error) {
    if (error instanceof PersistedRoleAuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Error creating client:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
