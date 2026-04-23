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

    // Step 3: list all lead forms for this page
    const formsUrl = `https://graph.facebook.com/v19.0/${integ.pageId}/leadgen_forms?fields=id,name,status&access_token=${encodeURIComponent(token)}`;
    const formsRes = await fetch(formsUrl);
    const formsBody = await formsRes.text();
    steps.formsStatus = formsRes.status;
    steps.formsBody = formsBody.slice(0, 1000);

    // If forms found, try to pull leads from first active form
    if (formsRes.ok) {
      try {
        const formsData = JSON.parse(formsBody);
        const forms = formsData.data ?? [];
        steps.formCount = forms.length;
        steps.forms = forms.map((f: { id: string; name: string; status: string }) => ({
          id: f.id,
          name: f.name,
          status: f.status,
        }));

        if (forms.length > 0) {
          const firstFormId = forms[0].id;
          const leadsUrl = `https://graph.facebook.com/v19.0/${firstFormId}/leads?fields=id,created_time&limit=3&access_token=${encodeURIComponent(token)}`;
          const leadsRes = await fetch(leadsUrl);
          steps.leadsStatus = leadsRes.status;
          steps.leadsBody = (await leadsRes.text()).slice(0, 500);
        }
      } catch {
        steps.parseError = "Failed to parse forms response";
      }
    }

    return NextResponse.json({ steps });
  } catch (e) {
    steps.fatalError = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ steps }, { status: 500 });
  }
}
