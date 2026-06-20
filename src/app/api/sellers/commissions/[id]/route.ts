import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";

const patchSchema = z.object({ status: z.enum(["PENDING", "PAID"]) });

// PATCH - Admin: mark a commission paid / unpaid.
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
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    }

    const updated = await prisma.sellerCommission.update({
      where: { id },
      data: {
        status: parsed.data.status,
        paidAt: parsed.data.status === "PAID" ? new Date() : null,
      },
      select: { id: true, status: true, paidAt: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating commission:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
