export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireAdmin, viewerErrorResponse } from "@/lib/auth/viewer";
import { decrypt } from "@/lib/crypto";
import { subscribePageToLeadgen } from "@/lib/facebook";

const schema = z.object({
  pageId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const { userId } = await requireAdmin();

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Pull the page entry (with encrypted token) from the OAuth cookie
    const cookieStore = await cookies();
    const raw = cookieStore.get("fb_pages")?.value;
    if (!raw) {
      return NextResponse.json(
        { error: "סשן ה-OAuth פג. חזור על תהליך החיבור." },
        { status: 400 }
      );
    }
    let pages: Array<{ id: string; name: string; access_token: string }>;
    try {
      pages = JSON.parse(raw).pages;
    } catch {
      return NextResponse.json({ error: "Invalid OAuth state" }, { status: 400 });
    }
    const target = pages.find((p) => p.id === parsed.data.pageId);
    if (!target) {
      return NextResponse.json({ error: "Page לא נמצא ברשימת ההרשאות" }, { status: 400 });
    }

    // Decrypt the page token, subscribe to leadgen, then persist (re-encrypted)
    const pageToken = decrypt(target.access_token);
    await subscribePageToLeadgen(target.id, pageToken);

    await prisma.facebookIntegration.upsert({
      where: { pageId: target.id },
      update: {
        userId,
        pageName: target.name,
        pageAccessToken: target.access_token, // already encrypted
        subscribedAt: new Date(),
      },
      create: {
        userId,
        pageId: target.id,
        pageName: target.name,
        pageAccessToken: target.access_token,
        subscribedAt: new Date(),
      },
    });

    const res = NextResponse.json({ ok: true });
    res.cookies.delete("fb_pages");
    return res;
  } catch (error) {
    const authResponse = viewerErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Page subscribe error:", error);
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
