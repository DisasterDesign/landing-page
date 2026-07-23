export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { leadDomainErrorResponse } from "@/lib/leads/http";
import { markLeadsRead } from "@/lib/leads/lifecycle";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({
  ids: z.array(z.string().min(1)).min(1),
  action: z.enum(["markRead", "markUnread", "delete", "setStatus"]),
  status: z.enum(["NEW", "IN_PROGRESS", "CLOSED", "LOST", "SPAM"]).optional(),
}).strict();

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const persisted = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    if (persisted?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { ids, action } = parsed.data;
    if (action === "delete") {
      return NextResponse.json(
        { error: "Leads are permanent CRM history" },
        { status: 405 },
      );
    }
    if (action === "setStatus") {
      return NextResponse.json(
        { error: "Use the canonical reasoned stage endpoint" },
        { status: 409 },
      );
    }
    const result = await markLeadsRead({
      leadIds: ids,
      isRead: action === "markRead",
      actor: { userId: session.user.id, role: "ADMIN" },
    });
    return NextResponse.json({ ok: true, count: result.count });
  } catch (error) {
    return leadDomainErrorResponse(error);
  }
}
