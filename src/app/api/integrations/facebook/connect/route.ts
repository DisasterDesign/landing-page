export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireAdmin, viewerErrorResponse } from "@/lib/auth/viewer";
import { buildAuthUrl, getMetaConfig } from "@/lib/facebook";
import { randomBytes } from "crypto";

export async function GET() {
  try {
    // ADMIN, not owner: the connection is made by whichever admin has a
    // Facebook profile with access to the Page. Since 16.8.2026 that is Roy —
    // Elad's profile is gone. Pinned by src/lib/integrations/facebook-gate.test.ts.
    const { userId } = await requireAdmin();

    if (!getMetaConfig()) {
      return NextResponse.json(
        {
          error:
            "Meta OAuth is not configured. Set META_APP_ID, META_APP_SECRET, META_REDIRECT_URI, META_WEBHOOK_VERIFY_TOKEN.",
        },
        { status: 503 }
      );
    }

    const nonce = randomBytes(16).toString("hex");
    const state = `${userId}.${nonce}`;
    const url = buildAuthUrl(state);

    const res = NextResponse.redirect(url);
    res.cookies.set("fb_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    });
    return res;
  } catch (error) {
    const authResponse = viewerErrorResponse(error);
    if (authResponse) return authResponse;
    console.error("Error starting Meta OAuth:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
