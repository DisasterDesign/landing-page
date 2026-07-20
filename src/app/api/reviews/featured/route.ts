import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import { getFeaturedReviews, setFeaturedReviews } from "@/lib/google-reviews";

// Admin: manage the curated featured reviews shown on the homepage.

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ reviews: await getFeaturedReviews() });
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
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  await setFeaturedReviews(parsed.data.reviews);
  return NextResponse.json({ ok: true, count: parsed.data.reviews.length });
}
