import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { z } from "zod";
import type { Prisma } from "@prisma/client";

// A seller may only add/remove THEMSELVES (claim/release) — never set an
// arbitrary assignee list — and move the status. This avoids the last-write
// clobber and arbitrary-id assignment a full `set` would allow.
const patchSchema = z.object({
  action: z.enum(["claim", "release"]).optional(),
  status: z.enum(["NEW", "IN_PROGRESS", "CLOSED", "LOST", "SPAM"]).optional(),
});

// PATCH - a seller claims a lead (assigneeIds) and/or moves its status.
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
    const body = await request.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const before = await prisma.contactSubmission.findUnique({
      where: { id },
      select: { status: true, closedAt: true },
    });
    if (!before) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const data: Prisma.ContactSubmissionUpdateInput = {};

    if (parsed.data.status !== undefined) {
      data.status = parsed.data.status;
      if (parsed.data.status !== "NEW") data.isRead = true;
      // Stamp closedAt on first transition into CLOSED.
      if (
        parsed.data.status === "CLOSED" &&
        before.status !== "CLOSED" &&
        !before.closedAt
      ) {
        data.closedAt = new Date();
      }
    }

    // Additive/idempotent: connect or disconnect only the caller — concurrent
    // claims by other sellers are never clobbered.
    if (parsed.data.action === "claim") {
      data.assignees = { connect: { id: session.user.id } };
    } else if (parsed.data.action === "release") {
      data.assignees = { disconnect: { id: session.user.id } };
    }

    const updated = await prisma.contactSubmission.update({
      where: { id },
      data,
      select: {
        id: true,
        status: true,
        assignees: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating seller lead:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
