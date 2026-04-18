export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  exchangeCodeForTokens,
  fetchUserEmail,
  GOOGLE_SCOPES,
} from "@/lib/google-oauth";
import { encrypt } from "@/lib/crypto";

function redirectWithError(req: NextRequest, message: string) {
  const url = new URL("/admin/seo", req.url);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return redirectWithError(req, "unauthorized");
    }

    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const oauthError = url.searchParams.get("error");

    if (oauthError) {
      return redirectWithError(req, oauthError);
    }
    if (!code || !state) {
      return redirectWithError(req, "missing_code");
    }

    const cookieState = req.cookies.get("seo_oauth_state")?.value;
    if (!cookieState || cookieState !== state) {
      return redirectWithError(req, "state_mismatch");
    }
    const [stateUserId] = state.split(".");
    if (stateUserId !== session.user.id) {
      return redirectWithError(req, "state_user_mismatch");
    }

    const tokens = await exchangeCodeForTokens(code);
    if (!tokens.refresh_token) {
      return redirectWithError(
        req,
        "no_refresh_token__revoke_app_access_in_google_account_and_retry"
      );
    }

    const email = await fetchUserEmail(tokens.access_token);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await prisma.googleIntegration.upsert({
      where: { userId: session.user.id },
      update: {
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token),
        expiresAt,
        scopes: GOOGLE_SCOPES,
        email,
      },
      create: {
        userId: session.user.id,
        accessToken: encrypt(tokens.access_token),
        refreshToken: encrypt(tokens.refresh_token),
        expiresAt,
        scopes: GOOGLE_SCOPES,
        email,
      },
    });

    const successUrl = new URL("/admin/seo", req.url);
    successUrl.searchParams.set("connected", "1");
    const res = NextResponse.redirect(successUrl);
    res.cookies.delete("seo_oauth_state");
    return res;
  } catch (error) {
    console.error("OAuth callback error:", error);
    return redirectWithError(req, "callback_failed");
  }
}
