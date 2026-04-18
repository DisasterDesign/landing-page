import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getFreshAccessToken } from "@/lib/google-oauth";
import { listSites } from "@/lib/search-console";
import { listGA4Properties } from "@/lib/analytics";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const accessToken = await getFreshAccessToken(session.user.id);
    if (!accessToken) {
      return NextResponse.json({ error: "לא מחובר ל-Google" }, { status: 400 });
    }

    const [gscSites, ga4Properties] = await Promise.all([
      listSites(accessToken).catch((e) => {
        console.error("listSites failed:", e);
        return [];
      }),
      listGA4Properties(accessToken).catch((e) => {
        console.error("listGA4Properties failed:", e);
        return [];
      }),
    ]);

    return NextResponse.json({ gscSites, ga4Properties });
  } catch (error) {
    console.error("Error listing sites:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
