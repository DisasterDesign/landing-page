import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { applyAgreementEvent } from "@/lib/leads/agreement-lifecycle";
import { leadDomainErrorResponse } from "@/lib/leads/http";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });
    if (user?.role !== "SELLER" && user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await params;
    const result = await applyAgreementEvent({
      agreementId: id,
      type: "SENT",
      actor: { userId: session.user.id, role: user.role },
    });
    return NextResponse.json(result);
  } catch (error) {
    return leadDomainErrorResponse(error);
  }
}
