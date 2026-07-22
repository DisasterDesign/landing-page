import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireProspectingAdmin } from "@/lib/prospecting/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(
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
      proposals: { orderBy: { createdAt: "desc" } },
      prospects: {
        orderBy: [{ qualityScore: "asc" }, { auditConfidence: "desc" }, { createdAt: "asc" }],
        include: { audits: { orderBy: { auditedAt: "desc" }, take: 1 } },
      },
      batch: true,
    },
  });
  if (!cycle) return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
  return NextResponse.json({ cycle });
}
