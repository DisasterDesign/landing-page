export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";
import { unsubscribePage } from "@/lib/facebook";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const pageId: string | undefined = body.pageId;

    const where = pageId
      ? { pageId, userId: session.user.id }
      : { userId: session.user.id };

    const integrations = await prisma.facebookIntegration.findMany({ where });
    for (const integ of integrations) {
      try {
        const token = decrypt(integ.pageAccessToken);
        await unsubscribePage(integ.pageId, token);
      } catch (err) {
        console.warn("Unsubscribe call failed (proceeding with delete):", err);
      }
    }

    await prisma.facebookIntegration.deleteMany({ where });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Facebook disconnect error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
