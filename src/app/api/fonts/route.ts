import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET - Public: list published font families with styles
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const featured = searchParams.get("featured");

    const where: Record<string, unknown> = { published: true };
    if (category) where.category = category;
    if (featured === "true") where.featured = true;

    const fonts = await prisma.fontFamily.findMany({
      where,
      include: {
        styles: {
          select: {
            id: true,
            name: true,
            weight: true,
            fontFileUrl: true,
            pricePersonal: true,
            priceCommercial: true,
          },
          orderBy: { weight: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(fonts);
  } catch (error) {
    console.error("Error fetching fonts:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
