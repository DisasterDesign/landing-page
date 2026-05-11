export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * DELETE /api/tasks/completed
 * Bulk-remove every task that's been marked DONE.
 * Admin-only — matches the destructive-cleanup pattern for shared boards.
 */
export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = (session.user as unknown as { role?: string }).role;
    if (role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { count } = await prisma.task.deleteMany({
      where: { status: "DONE" },
    });

    return NextResponse.json({ success: true, deleted: count });
  } catch (error) {
    console.error("Error clearing completed tasks:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
