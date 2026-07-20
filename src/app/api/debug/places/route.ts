export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";

/**
 * TEMPORARY diagnostic — why does the Places refresh fail in production while
 * the same key works locally? Reports the env var's shape (never the full
 * value) and Google's exact response from THIS runtime. Bearer-gated with
 * CRON_SECRET. Delete after the reviews-count investigation closes.
 */
export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const key = process.env.GOOGLE_PLACES_API_KEY;
  const shape = key
    ? { present: true, length: key.length, prefix: key.slice(0, 6), suffix: key.slice(-4), trimmedLength: key.trim().length }
    : { present: false };

  let google: unknown = null;
  if (key) {
    try {
      const res = await fetch(
        "https://places.googleapis.com/v1/places/ChIJdZsBiJ47dU0RGPLUcpFy0sQ?languageCode=he",
        {
          headers: { "X-Goog-Api-Key": key.trim(), "X-Goog-FieldMask": "rating,userRatingCount" },
          cache: "no-store",
        }
      );
      const body = await res.text();
      google = { status: res.status, body: body.slice(0, 400) };
    } catch (e) {
      google = { fetchError: String(e) };
    }
  }

  return NextResponse.json({ shape, google });
}
