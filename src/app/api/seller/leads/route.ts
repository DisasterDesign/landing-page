import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getLeadLifecycleConfig } from "@/lib/leads/config";
import { legacyStatusForStage } from "@/lib/leads/stage-machine";
import {
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

// GET - incoming/ad-response leads within the authenticated seller's
// canonical scope. Legacy mode changes only the response shape, never scope.
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const sellerId = session.user.id;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim();
    const unified = getLeadLifecycleConfig().enabled;
    if (unified) {
      const page = await getSellerLeadList({
        sellerId,
        intents: ["AD_RESPONSE", "INBOUND"],
        cursor: searchParams.get("cursor") ?? undefined,
        limit: Number(searchParams.get("limit") ?? 50),
        search,
      });
      return NextResponse.json({
        leads: page.items,
        nextCursor: page.nextCursor,
      });
    }
    const leads = await loadLegacySellerPages({
      sellerId,
      search,
    });
    return NextResponse.json({
      leads: leads.map((lead) => ({
        id: lead.id,
        name: lead.name ?? lead.company ?? "ליד ללא שם",
        email: lead.email ?? "",
        phone: lead.phone,
        company: lead.company,
        service: lead.service,
        message: lead.message ?? "",
        status: legacyStatusForStage(lead.stage),
        source: lead.sourceKey,
        createdAt: lead.createdAt,
        assignees: lead.owner ? [lead.owner] : [],
        myNotesCount: lead.notes.filter(
          (note) => note.author.id === sellerId,
        ).length,
      })),
      nextCursor: null,
    });
  } catch (error) {
    console.error("Error listing seller leads:", error);
    return leadDomainErrorResponse(error);
  }
}
