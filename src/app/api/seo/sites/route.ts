export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireOwner, viewerErrorResponse } from "@/lib/auth/viewer";
import { getFreshAccessToken, fetchUserEmail } from "@/lib/google-oauth";
import { listSites } from "@/lib/search-console";
import { listGA4Properties } from "@/lib/analytics";

export async function GET() {
  try {
    const { userId } = await requireOwner();

    const accessToken = await getFreshAccessToken(userId);
    if (!accessToken) {
      return NextResponse.json({ error: "לא מחובר ל-Google" }, { status: 400 });
    }

    const errors: string[] = [];
    const [gscSites, ga4Properties, connectedEmail] = await Promise.all([
      listSites(accessToken).catch((e) => {
        console.error("listSites failed:", e);
        errors.push(`GSC: ${e instanceof Error ? e.message : String(e)}`);
        return [];
      }),
      listGA4Properties(accessToken).catch((e) => {
        console.error("listGA4Properties failed:", e);
        errors.push(`GA4: ${e instanceof Error ? e.message : String(e)}`);
        return [];
      }),
      fetchUserEmail(accessToken).catch(() => null),
    ]);

    return NextResponse.json({
      gscSites,
      ga4Properties,
      connectedEmail,
      ...(errors.length > 0 && { errors }),
    });
  } catch (error) {
    const authResponse = viewerErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Error listing sites:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
