import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner, viewerErrorResponse } from "@/lib/auth/viewer";
import { updateFontFamilySchema } from "@/lib/validations";

// GET - Admin: single font family with styles and orders
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireOwner();

    const { id } = await params;

    const font = await prisma.fontFamily.findUnique({
      where: { id },
      include: {
        styles: { orderBy: { weight: "asc" } },
        orders: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });

    if (!font) {
      return NextResponse.json({ error: "Font not found" }, { status: 404 });
    }

    return NextResponse.json(font);
  } catch (error) {
    const authResponse = viewerErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Error fetching font:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH - Admin: update font family
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireOwner();

    const { id } = await params;
    const body = await request.json();
    const parsed = updateFontFamilySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const font = await prisma.fontFamily.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json(font);
  } catch (error) {
    const authResponse = viewerErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Error updating font:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Admin: delete font family
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireOwner();

    const { id } = await params;

    await prisma.fontFamily.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    const authResponse = viewerErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Error deleting font:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
