export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildConsentUrl, getGoogleConfig } from "@/lib/google-oauth";
import { randomBytes } from "crypto";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!getGoogleConfig()) {
      return NextResponse.json(
        {
          error:
            "Google OAuth is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI in env.",
        },
        { status: 503 }
      );
    }

    // Bind state to the user id so the callback can verify ownership.
    const nonce = randomBytes(16).toString("hex");
    const state = `${session.user.id}.${nonce}`;
    const url = buildConsentUrl(state);

    const res = NextResponse.redirect(url);
    res.cookies.set("seo_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    });
    return res;
  } catch (error) {
    console.error("Error starting OAuth:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
