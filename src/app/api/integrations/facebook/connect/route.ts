export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildAuthUrl, getMetaConfig } from "@/lib/facebook";
import { randomBytes } from "crypto";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    const state = `${session.user.id}.${nonce}`;
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
    console.error("Error starting Meta OAuth:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
