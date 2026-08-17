export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, ViewerAuthorizationError } from "@/lib/auth/viewer";
import {
  exchangeCodeForUserToken,
  exchangeForLongLivedUserToken,
  listManagedPages,
} from "@/lib/facebook";
import { encrypt } from "@/lib/crypto";
import { cookies } from "next/headers";

function redirectWithError(req: NextRequest, message: string) {
  const url = new URL("/admin/integrations/facebook", req.url);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  try {
    // OAuth callback must always answer with a redirect, never JSON — so the
    // auth gate translates to the error-redirect instead of viewerErrorResponse.
    let userId: string;
    try {
      ({ userId } = await requireAdmin());
    } catch (error) {
      if (error instanceof ViewerAuthorizationError) {
        return redirectWithError(req, "unauthorized");
      }
      throw error;
    }

    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const oauthError = url.searchParams.get("error");
    if (oauthError) return redirectWithError(req, oauthError);
    if (!code || !state) return redirectWithError(req, "missing_code");

    const cookieStore = await cookies();
    const cookieState = cookieStore.get("fb_oauth_state")?.value;
    if (!cookieState || cookieState !== state) {
      return redirectWithError(req, "state_mismatch");
    }
    const [stateUserId] = state.split(".");
    if (stateUserId !== userId) {
      return redirectWithError(req, "state_user_mismatch");
    }

    const shortToken = await exchangeCodeForUserToken(code);
    const longLived = await exchangeForLongLivedUserToken(shortToken);
    const pages = await listManagedPages(longLived);

    // Stash the long-lived user token + pages list in a short-lived cookie so the
    // page-picker UI can render them client-side. The actual page tokens are
    // never persisted to localStorage — they're encrypted at rest only after the
    // user picks a page.
    const payload = {
      pages: pages.map((p) => ({
        id: p.id,
        name: p.name,
        access_token: encrypt(p.access_token),
      })),
    };

    const successUrl = new URL("/admin/integrations/facebook", req.url);
    successUrl.searchParams.set("step", "pick-page");
    const res = NextResponse.redirect(successUrl);
    res.cookies.set("fb_pages", JSON.stringify(payload), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 30,
    });
    res.cookies.delete("fb_oauth_state");
    return res;
  } catch (error) {
    console.error("Meta OAuth callback error:", error);
    return redirectWithError(req, "callback_failed");
  }
}
