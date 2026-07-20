export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getGoogleReviews } from "@/lib/google-reviews";

/**
 * Public: live GBP rating + selected reviews for the homepage section.
 * Server-side cached 6h in KeyValue — visitors never trigger a Places call
 * beyond the 4-a-day refresh.
 */
export async function GET() {
  try {
    const data = await getGoogleReviews();
    if (!data) {
      return NextResponse.json({ available: false });
    }
    return NextResponse.json(
      { available: true, ...data },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } }
    );
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return NextResponse.json({ available: false });
  }
}
