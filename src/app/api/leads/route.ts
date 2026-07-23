export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import {
  type AdminLeadFilters,
  getAdminLeadList,
  parseAdminLeadFilters,
} from "@/lib/leads/admin-query";
import { requirePersistedLeadReadRole } from "@/lib/leads/authorization";
import { getLeadLifecycleConfig } from "@/lib/leads/config";
import { leadDomainErrorResponse } from "@/lib/leads/http";
import { getAdminLeadDetail, type LeadDetail } from "@/lib/leads/projection";
import { legacyStatusForStage } from "@/lib/leads/stage-machine";

async function loadLegacyAdminPages(filters: AdminLeadFilters) {
  const first = await getAdminLeadList({
    ...filters,
    cursor: undefined,
    limit: 100,
  });
  const items = [...first.items];
  let cursor = first.nextCursor;
  while (cursor && items.length < 200) {
    const page = await getAdminLeadList({
      ...filters,
      cursor,
      limit: 100,
    });
    items.push(...page.items);
    cursor = page.nextCursor;
  }
  return {
    items: items.slice(0, 200),
    nextCursor: null,
    stats: first.stats,
  };
}

function legacyLead(lead: LeadDetail) {
  return {
    id: lead.id,
    name: lead.name ?? lead.company ?? "ליד ללא שם",
    email: lead.email ?? "",
    phone: lead.phone,
    company: lead.company,
    message: lead.message ?? "",
    service: lead.service,
    isRead: lead.isRead,
    status: lead.stage
      ? legacyStatusForStage(lead.stage)
      : lead.legacyStatus,
    source: lead.sourceKey,
    nextFollowUpAt: lead.nextFollowUpAt,
    lastContactedAt: lead.lastContactedAt,
    closedAt: lead.closedAt,
    createdAt: lead.createdAt,
    _count: { notes: lead.noteCount },
    assignees: lead.owner ? [lead.owner] : [],
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await requirePersistedLeadReadRole(session.user.id, ["ADMIN"]);
    const url = new URL(request.url);
    const filters = parseAdminLeadFilters(url.searchParams);
    const unified = getLeadLifecycleConfig().enabled;
    const effectiveFilters = {
      ...filters,
      openOnly: !unified && url.searchParams.get("all") !== "true",
    };
    const page = unified
      ? await getAdminLeadList(effectiveFilters)
      : await loadLegacyAdminPages(effectiveFilters);

    let leads = page.items;
    const focus = url.searchParams.get("focus");
    let focusState: "none" | "found" | "not_found" = focus
      ? "not_found"
      : "none";
    if (focus && leads.some((lead) => lead.id === focus)) {
      focusState = "found";
    }
    if (focus && !leads.some((lead) => lead.id === focus)) {
      try {
        const focused = await getAdminLeadDetail(focus);
        leads = [focused, ...leads];
        focusState = "found";
      } catch {
        // A stale notification should not make the entire list unavailable.
        focusState = "not_found";
      }
    }

    return NextResponse.json({
      leads: unified ? leads : leads.map(legacyLead),
      nextCursor: page.nextCursor,
      stats: page.stats,
      focusState,
    });
  } catch (error) {
    console.error("Leads list error:", error);
    return leadDomainErrorResponse(error);
  }
}
