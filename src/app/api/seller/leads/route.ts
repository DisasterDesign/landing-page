import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { requirePersistedLeadReadRole } from "@/lib/leads/authorization";
import { getLeadLifecycleConfig } from "@/lib/leads/config";
import { legacyStatusForStage } from "@/lib/leads/stage-machine";
import {
  getSellerLeadDetail,
  getSellerLeadList,
  type SellerLeadDetail,
} from "@/lib/leads/projection";
import { leadDomainErrorResponse } from "@/lib/leads/http";

async function loadLegacySellerPages(input: {
  sellerId: string;
  search?: string;
}) {
  const leads: SellerLeadDetail[] = [];
  let cursor: string | undefined;
  do {
    const page = await getSellerLeadList({
      sellerId: input.sellerId,
      intents: ["AD_RESPONSE", "INBOUND"],
      cursor,
      limit: 100,
      search: input.search,
    });
    leads.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor && leads.length < 300);
  return leads.slice(0, 300);
}

async function includeFocusedIncomingLead(input: {
  leads: SellerLeadDetail[];
  focus: string | null;
  sellerId: string;
}) {
  if (!input.focus) {
    return { leads: input.leads, focusState: "none" as const };
  }
  if (input.leads.some((lead) => lead.id === input.focus)) {
    return { leads: input.leads, focusState: "found" as const };
  }
  try {
    const lead = await getSellerLeadDetail({
      id: input.focus,
      sellerId: input.sellerId,
    });
    return {
      leads: [lead, ...input.leads],
      focusState: "found" as const,
    };
  } catch {
    return { leads: input.leads, focusState: "not_found" as const };
  }
}

// GET - incoming/ad-response leads within the authenticated seller's
// canonical scope. Legacy mode changes only the response shape, never scope.
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await requirePersistedLeadReadRole(session.user.id, ["ADMIN", "SELLER"]);
    const sellerId = session.user.id;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const focus = searchParams.get("focus");
    const unified = getLeadLifecycleConfig().enabled;
    if (unified) {
      // ONE queue, all three temperatures (hot → medium → cold via
      // INCOMING_PRIORITY). The separate cold-leads page is gone — a seller
      // has a single list, and temperature is a visible dimension, not a
      // navigation split.
      const page = await getSellerLeadList({
        sellerId,
        intents: ["INBOUND", "AD_RESPONSE", "OUTBOUND"],
        cursor: searchParams.get("cursor") ?? undefined,
        limit: Number(searchParams.get("limit") ?? 50),
        search,
        order: "INCOMING_PRIORITY",
      });
      const focused = await includeFocusedIncomingLead({
        leads: page.items,
        focus,
        sellerId,
      });
      return NextResponse.json({
        leads: focused.leads,
        nextCursor: page.nextCursor,
        focusState: focused.focusState,
      });
    }
    const leads = await loadLegacySellerPages({
      sellerId,
      search,
    });
    const focused = await includeFocusedIncomingLead({
      leads,
      focus,
      sellerId,
    });
    return NextResponse.json({
      leads: focused.leads.map((lead) => ({
        id: lead.id,
        name: lead.name ?? lead.company ?? lead.displayName,
        email: lead.email ?? "",
        phone: lead.phone,
        company: lead.company,
        service: lead.service,
        message: lead.message ?? "",
        status: legacyStatusForStage(lead.stage),
        source: lead.sourceKey,
        createdAt: lead.createdAt,
        doNotContactAt: lead.doNotContactAt,
        capabilities: {
          canContact: lead.capabilities.canContact,
        },
        assignees: lead.owner ? [lead.owner] : [],
        myNotesCount: lead.noteCount,
      })),
      nextCursor: null,
      focusState: focused.focusState,
    });
  } catch (error) {
    console.error("Error listing seller leads:", error);
    return leadDomainErrorResponse(error);
  }
}
