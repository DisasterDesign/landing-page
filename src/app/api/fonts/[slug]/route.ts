import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET - Public: single font family by slug with all styles
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const font = await prisma.fontFamily.findUnique({
      where: { slug, published: true },
      include: {
        styles: {
          orderBy: { weight: "asc" },
        },
      },
    });

    if (!font) {
      return NextResponse.json({ error: "Font not found" }, { status: 404 });
    }

    return NextResponse.json(font);
  } catch (error) {
    console.error("Error fetching font:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
