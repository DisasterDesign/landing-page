import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { CLIENT_PRODUCT_SELECT, syncClientMonthly } from "@/lib/client-products";

// GET - Auth required: list all clients
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const clients = await prisma.client.findMany({
      // A merged-away client is archived, not deleted — its history still
      // matters. It must not keep occupying a row in the table though.
      where: { archivedAt: null },
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
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const client = await prisma.client.create({
      data: {
        name: body.name || "",
        status: body.status || "",
        notes: body.notes || null,
        amount: body.amount != null ? parseFloat(body.amount) : null,
        expense: body.expense != null ? parseFloat(body.expense) : null,
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
    console.error("Error creating client:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
