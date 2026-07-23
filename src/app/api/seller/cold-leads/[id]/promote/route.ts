import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { leadDomainErrorResponse } from "@/lib/leads/http";
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
    return NextResponse.json(
      await getPublishedLeadForProspect(id, sellerId),
      { status: 200 },
    );
  } catch (error) {
    return leadDomainErrorResponse(error);
  }
}
