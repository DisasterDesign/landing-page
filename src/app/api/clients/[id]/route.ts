import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

// PATCH - Auth required: update client field(s)
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

    // Build update data from allowed fields
    const updateData: Record<string, unknown> = {};
    if ("name" in body) updateData.name = body.name;
    if ("status" in body) updateData.status = body.status;
    if ("notes" in body) updateData.notes = body.notes || null;
    if ("amount" in body)
      updateData.amount =
        body.amount !== null && body.amount !== "" ? parseFloat(body.amount) : null;
    if ("expense" in body)
      updateData.expense =
        body.expense !== null && body.expense !== "" ? parseFloat(body.expense) : null;
    if ("cardcomFee" in body)
      updateData.cardcomFee =
        body.cardcomFee !== null && body.cardcomFee !== "" ? parseFloat(body.cardcomFee) : null;
    if ("websiteUrl" in body)
      updateData.websiteUrl = body.websiteUrl ? String(body.websiteUrl).trim() || null : null;
    if ("startDate" in body)
      updateData.startDate =
        body.startDate ? new Date(body.startDate).toISOString() : null;
    if ("paymentDate" in body)
      updateData.paymentDate =
        body.paymentDate ? new Date(body.paymentDate).toISOString() : null;

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

// DELETE - Auth required: delete client
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
