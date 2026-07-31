import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner, viewerErrorResponse } from "@/lib/auth/viewer";
import { createFontStyleSchema } from "@/lib/validations";

// POST - Admin: add a new style to font family
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireOwner();

    const { id } = await params;
    const body = await request.json();
    const parsed = createFontStyleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Verify font family exists
    const fontFamily = await prisma.fontFamily.findUnique({ where: { id } });
    if (!fontFamily) {
      return NextResponse.json({ error: "Font family not found" }, { status: 404 });
    }

    const style = await prisma.fontStyle.create({
      data: {
        ...parsed.data,
        fontFamilyId: id,
      },
    });

    return NextResponse.json(style, { status: 201 });
  } catch (error) {
    const authResponse = viewerErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Error creating font style:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE - Admin: remove a style (pass styleId in body)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireOwner();

    await params; // consume params
    const body = await request.json();
    const { styleId } = body;

    if (!styleId) {
      return NextResponse.json({ error: "styleId is required" }, { status: 400 });
    }

    await prisma.fontStyle.delete({ where: { id: styleId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    const authResponse = viewerErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Error deleting font style:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
