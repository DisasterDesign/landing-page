export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getGoogleReviews, getFeaturedReviews } from "@/lib/google-reviews";

/**
 * Public: live GBP rating + count (server-cached 6h) merged with the owner's
 * curated featured reviews. Google does not serve review texts for this
 * listing, so the CARDS come from the admin-managed list while the number and
 * count stay live.
 */
export async function GET() {
  try {
    const [data, featured] = await Promise.all([getGoogleReviews(), getFeaturedReviews()]);
    if (!data) {
      return NextResponse.json({ available: false });
    }
    // Prefer Google's own reviews if it ever starts serving them; otherwise
    // fall back to the curated list (normalised to the same shape).
    const reviews =
      data.reviews.length > 0
        ? data.reviews
        : featured.map((r) => ({ ...r, authorPhoto: null, publishTime: "" }));
    // No shared HTTP cache — the expensive Places lookup is already cached in
    // KeyValue (6h), and admin edits to featured reviews must show right away.
    return NextResponse.json(
      { available: true, ...data, reviews },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return NextResponse.json({ available: false });
  }
}
