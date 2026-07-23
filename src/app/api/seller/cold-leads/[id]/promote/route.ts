import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { leadDomainErrorResponse } from "@/lib/leads/http";
import { getLeadIntentForSeller } from "@/lib/leads/projection";
import { getPublishedLeadForProspect } from "@/lib/prospecting/promotion";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const sellerId = session.user.id;
  const { id } = await params;
  try {
    const published = await getPublishedLeadForProspect(id, sellerId);
    const intent = await getLeadIntentForSeller(published.leadId, sellerId);
    if (intent !== "OUTBOUND") {
      return NextResponse.json(
        { error: "Published lead not found" },
        { status: 404 },
      );
    }
    return NextResponse.json(
      published,
      { status: 200 },
    );
  } catch (error) {
    return leadDomainErrorResponse(error);
  }
}
