import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { leadDomainErrorResponse } from "@/lib/leads/http";
import { markLeadRead } from "@/lib/leads/lifecycle";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const patchSchema = z.object({ isRead: z.boolean() }).strict();

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const persisted = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    if (persisted?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      await markLeadRead({
        leadId: id,
        isRead: parsed.data.isRead,
        actor: { userId: session.user.id, role: "ADMIN" },
      }),
    );
  } catch (error) {
    return leadDomainErrorResponse(error);
  }
}

export function DELETE() {
  return NextResponse.json(
    { error: "Leads are permanent CRM history" },
    { status: 405 },
  );
}
