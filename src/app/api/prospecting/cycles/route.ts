import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireProspectingAdmin } from "@/lib/prospecting/admin-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await requireProspectingAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cycles = await prisma.prospectingCycle.findMany({
    orderBy: { weekStart: "desc" },
    take: 20,
    include: {
      proposals: { orderBy: { createdAt: "desc" } },
      prospects: { select: { status: true, qualityScore: true } },
      batch: true,
    },
  });

  return NextResponse.json({
    cycles: cycles.map(({ prospects, ...cycle }) => ({
      ...cycle,
      prospectCounts: prospects.reduce<Record<string, number>>((counts, prospect) => {
        counts[prospect.status] = (counts[prospect.status] ?? 0) + 1;
        return counts;
      }, {}),
      scoreCounts: prospects.reduce<Record<string, number>>((counts, prospect) => {
        if (prospect.qualityScore !== null) {
          counts[prospect.qualityScore] = (counts[prospect.qualityScore] ?? 0) + 1;
        }
        return counts;
      }, {}),
    })),
  });
}
