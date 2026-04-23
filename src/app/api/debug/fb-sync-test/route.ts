export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";

export async function GET() {
  const steps: Record<string, unknown> = {};

  try {
    // Step 1: find integration
    const integ = await prisma.facebookIntegration.findFirst({
      orderBy: { createdAt: "desc" },
    });
    steps.integration = integ
      ? { id: integ.id, pageId: integ.pageId, pageName: integ.pageName }
      : null;

    if (!integ) {
      return NextResponse.json({ steps, error: "No integration found" });
    }

    // Step 2: decrypt token
    let token: string;
    try {
      token = decrypt(integ.pageAccessToken);
      steps.decryptOk = true;
      steps.tokenPrefix = token.slice(0, 10) + "...";
    } catch (e) {
      steps.decryptOk = false;
      steps.decryptError = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ steps });
    }

    // Step 3: call Meta form leads endpoint
    const formId = process.env.FACEBOOK_LEAD_FORM_ID || "1505628047948105";
    const url = `https://graph.facebook.com/v19.0/${formId}/leads?fields=id,created_time&limit=5&access_token=${encodeURIComponent(token)}`;
    steps.metaUrl = url.replace(token, "TOKEN_REDACTED");

    const metaRes = await fetch(url);
    const metaBody = await metaRes.text();
    steps.metaStatus = metaRes.status;
    steps.metaBody = metaBody.slice(0, 500);

    return NextResponse.json({ steps });
  } catch (e) {
    steps.fatalError = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ steps }, { status: 500 });
  }
}
