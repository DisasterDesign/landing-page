import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { bulkClientUrlsSchema } from "@/lib/validations";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = bulkClientUrlsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { updates } = parsed.data;

    const results = await prisma.$transaction(
      updates.map((u) =>
        prisma.client.update({
          where: { id: u.clientId },
          data: { websiteUrl: u.websiteUrl.trim() },
          select: { id: true },
        })
      )
    );

    return NextResponse.json({ updated: results.length });
  } catch (error) {
    console.error("Error bulk-updating client URLs:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
