import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireProspectingAdmin } from "@/lib/prospecting/admin-auth";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireProspectingAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const proposal = await prisma.territoryProposal.findUnique({ where: { id } });
  if (!proposal || proposal.status !== "PROPOSED") {
    return NextResponse.json({ error: "Proposal was already decided" }, { status: 409 });
  }

  const approvedAt = new Date();
  try {
    await prisma.$transaction(async (transaction) => {
      const updated = await transaction.territoryProposal.updateMany({
        where: { id, status: "PROPOSED" },
        data: { status: "APPROVED", approvedById: admin.id, approvedAt },
      });
      if (updated.count !== 1) throw new Error("PROPOSAL_CONFLICT");
      await transaction.prospectingCycle.update({
        where: { id: proposal.cycleId },
        data: { status: "DISCOVERY_QUEUED", approvedAt, lastError: null },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "PROPOSAL_CONFLICT") {
      return NextResponse.json({ error: "Proposal was already decided" }, { status: 409 });
    }
    throw error;
  }
  return NextResponse.json({ ok: true, cycleId: proposal.cycleId });
}
