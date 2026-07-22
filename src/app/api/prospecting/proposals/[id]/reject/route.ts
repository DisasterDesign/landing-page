import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireProspectingAdmin } from "@/lib/prospecting/admin-auth";
import { createReplacementProposal } from "@/lib/prospecting/territory";
import { territoryRejectionSchema } from "@/lib/validations";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = await requireProspectingAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  const parsed = territoryRejectionSchema.safeParse({
    proposalId: id,
    ...((await request.json().catch(() => null)) ?? {}),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }
  const proposal = await prisma.territoryProposal.findUnique({ where: { id } });
  if (!proposal || proposal.status !== "PROPOSED") {
    return NextResponse.json({ error: "Proposal was already decided" }, { status: 409 });
  }

  const updated = await prisma.territoryProposal.updateMany({
    where: { id, status: "PROPOSED" },
    data: { status: "REJECTED", rejectionReason: parsed.data.reason },
  });
  if (updated.count !== 1) {
    return NextResponse.json({ error: "Proposal was already decided" }, { status: 409 });
  }
  await prisma.prospectingCycle.update({
    where: { id: proposal.cycleId },
    data: { status: "PROPOSING", lastError: null },
  });

  try {
    const replacement = await createReplacementProposal(proposal.cycleId);
    return NextResponse.json({ ok: true, replacementProposalId: replacement.proposalId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Replacement proposal failed";
    await prisma.prospectingCycle.update({
      where: { id: proposal.cycleId },
      data: { status: "FAILED", lastError: message },
    });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
