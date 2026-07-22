import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireProspectingAdmin } from "@/lib/prospecting/admin-auth";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await requireProspectingAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await params;
  const result = await prisma.prospectingCycle.updateMany({
    where: { id, status: { notIn: ["PUBLISHED", "CANCELLED"] } },
    data: { status: "CANCELLED", lockedAt: null, lockToken: null },
  });
  if (result.count !== 1) {
    return NextResponse.json({ error: "Cycle cannot be cancelled" }, { status: 409 });
  }
  await prisma.prospect.updateMany({
    where: { cycleId: id, status: { in: ["DISCOVERED", "AUDIT_PENDING", "AUDITING", "READY"] } },
    data: { status: "INVALID" },
  });
  return NextResponse.json({ ok: true });
}
