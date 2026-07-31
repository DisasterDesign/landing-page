export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOwner, viewerErrorResponse } from "@/lib/auth/viewer";

/**
 * DELETE /api/tasks/completed
 * Bulk-remove every task that's been marked DONE.
 * Admin-only — matches the destructive-cleanup pattern for shared boards.
 */
export async function DELETE() {
  try {
    await requireOwner();

    const { count } = await prisma.task.deleteMany({
      where: { status: "DONE" },
    });

    return NextResponse.json({ success: true, deleted: count });
  } catch (error) {
    const authResponse = viewerErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Error clearing completed tasks:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
