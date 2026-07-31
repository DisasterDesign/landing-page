import { NextRequest, NextResponse } from "next/server";
import { requireOwner, viewerErrorResponse } from "@/lib/auth/viewer";
import { z } from "zod";
import { getFeaturedReviews, setFeaturedReviews } from "@/lib/google-reviews";

// Admin: manage the curated featured reviews shown on the homepage.

export async function GET() {
  try {
    await requireOwner();
    return NextResponse.json({ reviews: await getFeaturedReviews() });
  } catch (error) {
    const authResponse = viewerErrorResponse(error);
    if (authResponse) return authResponse;
    throw error;
  }
}

const schema = z.object({
  reviews: z
    .array(
      z.object({
        author: z.string().trim().min(1).max(80),
        rating: z.number().int().min(1).max(5),
        text: z.string().trim().min(1).max(1000),
        relativeTime: z.string().trim().max(60).default(""),
      })
    )
    .max(12),
});

export async function PUT(req: NextRequest) {
  try {
    await requireOwner();
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    await setFeaturedReviews(parsed.data.reviews);
    return NextResponse.json({ ok: true, count: parsed.data.reviews.length });
  } catch (error) {
    const authResponse = viewerErrorResponse(error);
    if (authResponse) return authResponse;
    throw error;
  }
}
