export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner, viewerErrorResponse } from "@/lib/auth/viewer";

export async function POST() {
  try {
    const { userId } = await requireOwner();

    await prisma.googleIntegration.deleteMany({
      where: { userId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const authResponse = viewerErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Error disconnecting Google:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
