import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
            signToken: true,
          },
        },
        clientNotes: {
          orderBy: { createdAt: "desc" },
          include: {
            author: { select: { id: true, name: true, avatarUrl: true } },
          },
        },
      },
    });

    if (!client) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(client);
  } catch (error) {
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
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const updateData: Record<string, unknown> = {};
    if ("name" in body) updateData.name = body.name;
    if ("status" in body) updateData.status = body.status;
    if ("notes" in body) updateData.notes = body.notes || null;
    if ("amount" in body)
      updateData.amount =
        body.amount !== null && body.amount !== "" ? parseFloat(body.amount) : null;
    if ("monthlyAmount" in body)
      updateData.monthlyAmount =
        body.monthlyAmount !== null && body.monthlyAmount !== "" ? parseFloat(body.monthlyAmount) : null;
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

    return NextResponse.json(client);
  } catch (error) {
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
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    await prisma.client.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting client:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
