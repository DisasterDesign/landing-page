import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireProspectingAdmin } from "@/lib/prospecting/admin-auth";
import { createReplacementProposal } from "@/lib/prospecting/territory";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireProspectingAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const cycle = await prisma.prospectingCycle.findUnique({
    where: { id },
    include: {
      proposals: { where: { status: "APPROVED" }, take: 1 },
      _count: { select: { prospects: true } },
    },
  });
  if (!cycle || cycle.status !== "FAILED") {
    return NextResponse.json({ error: "Cycle is not retryable" }, { status: 409 });
  }

  const nextStatus =
    cycle.proposals.length === 0
      ? "PROPOSING"
      : cycle._count.prospects === 0
        ? "DISCOVERY_QUEUED"
        : "AUDITING";
  await prisma.prospectingCycle.update({
    where: { id },
    data: { status: nextStatus, lastError: null, lockedAt: null, lockToken: null },
  });
  if (nextStatus === "PROPOSING") {
    const replacement = await createReplacementProposal(id);
    return NextResponse.json({
      ok: true,
      status: "AWAITING_APPROVAL",
      replacementProposalId: replacement.proposalId,
    });
  }
  return NextResponse.json({ ok: true, status: nextStatus });
}
