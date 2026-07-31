export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireOwner, viewerErrorResponse } from "@/lib/auth/viewer";
import { forceRefreshGoogleReviews } from "@/lib/google-reviews";

/**
 * Admin-only: pull the rating/count from Google immediately, ignoring the 1h
 * cache. Costs one Place Details Enterprise call per press (1,000/month free),
 * which is why it is behind a session and a button rather than being the
 * default read path.
 */
export async function POST() {
  try {
    await requireOwner();

    const data = await forceRefreshGoogleReviews();
    if (!data) {
      return NextResponse.json(
        { error: "Google did not return data — check GOOGLE_PLACES_API_KEY" },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { rating: data.rating, count: data.count, fetchedAt: data.fetchedAt },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    const authResponse = viewerErrorResponse(e);
    if (authResponse) return authResponse;
    console.error("[reviews] force refresh failed:", e);
    return NextResponse.json({ error: "Refresh failed" }, { status: 500 });
  }
}
