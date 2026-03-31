import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createFontFamilySchema } from "@/lib/validations";

// GET - Admin: list all font families (including unpublished) with order counts
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const skip = (page - 1) * limit;

    const [fonts, total] = await Promise.all([
      prisma.fontFamily.findMany({
        include: {
          _count: { select: { styles: true, orders: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.fontFamily.count(),
    ]);

    return NextResponse.json({
      data: fonts,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Error fetching fonts:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST - Admin: create font family
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createFontFamilySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, ...rest } = parsed.data;

    // Auto-generate slug from name
    const slug =
      rest.slug ||
      name.trim().replace(/\s+/g, "-").toLowerCase() +
        "-" +
        Date.now().toString(36);

    const font = await prisma.fontFamily.create({
      data: {
        name,
        slug,
        ...rest,
      },
    });

    return NextResponse.json(font, { status: 201 });
  } catch (error) {
    console.error("Error creating font:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
