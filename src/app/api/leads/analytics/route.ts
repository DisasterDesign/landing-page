export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { getLeadMetrics } from "@/lib/leads/analytics";
import { parseAdminLeadFilters } from "@/lib/leads/admin-query";
import { requirePersistedLeadReadRole } from "@/lib/leads/authorization";
import { leadDomainErrorResponse } from "@/lib/leads/http";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await requirePersistedLeadReadRole(session.user.id, ["ADMIN"]);
    const filters = parseAdminLeadFilters(new URL(request.url).searchParams);
    const metrics = await getLeadMetrics(filters);
    return NextResponse.json({ metrics });
  } catch (error) {
    console.error("Lead analytics error:", error);
    return leadDomainErrorResponse(error);
  }
}
