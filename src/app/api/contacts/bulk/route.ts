export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

const schema = z.object({
  ids: z.array(z.string().min(1)).min(1),
  action: z.enum(["markRead", "markUnread", "delete", "setStatus"]),
  status: z.enum(["NEW", "IN_PROGRESS", "CLOSED", "SPAM"]).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { ids, action, status } = parsed.data;
    const where = { id: { in: ids } };

    let result;
    if (action === "markRead") {
      result = await prisma.contactSubmission.updateMany({ where, data: { isRead: true } });
    } else if (action === "markUnread") {
      result = await prisma.contactSubmission.updateMany({ where, data: { isRead: false } });
    } else if (action === "setStatus") {
      if (!status) {
        return NextResponse.json({ error: "status required" }, { status: 400 });
      }
      const isReadUpdate = status !== "NEW" ? { isRead: true } : {};
      result = await prisma.contactSubmission.updateMany({
        where,
        data: { status, ...isReadUpdate },
      });
    } else {
      result = await prisma.contactSubmission.deleteMany({ where });
    }

    return NextResponse.json({ ok: true, count: result.count });
  } catch (error) {
    console.error("Bulk contact action error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
