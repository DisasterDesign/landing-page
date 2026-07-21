import { prisma } from "@/lib/prisma";

/**
 * Live Google Business Profile reviews for the homepage social-proof section.
 *
 * Data flows from the Places API (New) and is cached in KeyValue for 6 hours
 * — reviews change slowly and the quota costs real money, so the homepage
 * must never hit Google per visitor. The place id itself is resolved ONCE by
 * text search and remembered forever.
 *
 * Env-gated: without GOOGLE_PLACES_API_KEY everything returns null and the
 * section renders nothing (same pattern as the tracking pixels).
 */

const PLACE_ID_KEY = "google_place_id";
const REVIEWS_CACHE_KEY = "google_reviews_cache";
// 1h — and this number is a BUDGET, not a preference.
//
// Asking for `rating`/`userRatingCount` puts the call in Google's Place Details
// ENTERPRISE SKU: 1,000 free calls per month, then $20 per 1,000 (verified on
// Google's official pricing page, July 2026). One refresh per hour is ~720/mo,
// which fits. Ten minutes would be ~4,300/mo — about $66/month for a number
// that changes a few times a week. So the lag is bought deliberately; when the
// count must be current NOW, use forceRefreshGoogleReviews() from the admin
// screen instead of shortening this.
const CACHE_TTL_MS = 60 * 60 * 1000;
// The GBP identity — matches the listing linked from the site's JSON-LD.
const PLACE_QUERY = "Fuzion Webz ראשון לציון";
// The listing is a service-area business with no pinned address, which
// Places text search does NOT index (verified live: every query variant
// returned empty). This id was derived from the listing's feature id
// (0x4d753b9e88019b75:0xc4d2729172d4f218 = CID 14182524145565495832) and
// verified against Place Details: "Fuzion Webz", rating 5. Search stays as
// a self-heal path in case the listing ever gains a pinned address.
const KNOWN_PLACE_ID = "ChIJdZsBiJ47dU0RGPLUcpFy0sQ";

export interface GoogleReview {
  author: string;
  authorPhoto: string | null;
  rating: number;
  text: string;
  relativeTime: string;
  publishTime: string;
}

export interface GoogleReviewsData {
  rating: number;
  count: number;
  reviews: GoogleReview[];
  writeReviewUrl: string;
  allReviewsUrl: string;
  fetchedAt: string;
}

async function resolvePlaceId(apiKey: string): Promise<string | null> {
  const cached = await prisma.keyValue.findUnique({ where: { key: PLACE_ID_KEY } });
  if (cached) return (cached.value as { id: string }).id;

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName",
    },
    body: JSON.stringify({ textQuery: PLACE_QUERY, languageCode: "he" }),
    cache: "no-store",
  });
  if (!res.ok) {
    console.error("[google-reviews] searchText failed:", res.status, await res.text());
    return KNOWN_PLACE_ID;
  }
  const json = (await res.json()) as { places?: { id: string }[] };
  const id = json.places?.[0]?.id ?? KNOWN_PLACE_ID;

  await prisma.keyValue.upsert({
    where: { key: PLACE_ID_KEY },
    create: { key: PLACE_ID_KEY, value: { id } },
    update: { value: { id } },
  });
  return id;
}

interface PlaceDetails {
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  reviews?: {
    rating?: number;
    text?: { text?: string };
    authorAttribution?: { displayName?: string; photoUri?: string };
    relativePublishTimeDescription?: string;
    publishTime?: string;
  }[];
}

/**
 * Single-flight guard.
 *
 * Every homepage visitor calls /api/reviews, so at the moment the cache
 * expires N concurrent visitors would each fire their own paid Google lookup.
 * At 720 refreshes/month against a 1,000-call free cap there is no room for
 * that multiplier. This claims the refresh with one conditional UPDATE: the
 * `fetchedAt` in the WHERE clause means only the request that actually moves
 * the row wins, and the losers serve the stale copy for the few hundred ms
 * until the winner writes.
 */
async function claimRefresh(cachedFetchedAt: string | null): Promise<boolean> {
  if (!cachedFetchedAt) return true; // nothing cached — nothing to race over
  const claimedAt = new Date().toISOString();
  const won = await prisma.$executeRaw`
    UPDATE "KeyValue"
       SET "value" = jsonb_set("value", '{fetchedAt}', ${JSON.stringify(claimedAt)}::jsonb)
     WHERE "key" = ${REVIEWS_CACHE_KEY}
       AND "value"->>'fetchedAt' = ${cachedFetchedAt}
  `;
  return won === 1;
}

export async function getGoogleReviews(): Promise<GoogleReviewsData | null> {
  // Cache-first, key-second. A warm cache is served BEFORE we look at the API
  // key, so the section keeps rendering even if the key is momentarily absent
  // (env var not yet propagated, a bad rotation). The key is only needed to
  // REFRESH once the cache goes stale.
  const cached = await prisma.keyValue.findUnique({ where: { key: REVIEWS_CACHE_KEY } });
  let cachedFetchedAt: string | null = null;
  if (cached) {
    const data = cached.value as unknown as GoogleReviewsData;
    cachedFetchedAt = data.fetchedAt ?? null;
    if (Date.now() - new Date(data.fetchedAt).getTime() < CACHE_TTL_MS) return data;
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  // No key to refresh with — serve stale cache if we have any, else nothing.
  if (!apiKey) return staleOrNull(cached);

  // Lost the race — another request is already paying for this refresh.
  if (!(await claimRefresh(cachedFetchedAt))) return staleOrNull(cached);

  try {
    const placeId = await resolvePlaceId(apiKey);
    if (!placeId) return staleOrNull(cached);

    const res = await fetch(
      `https://places.googleapis.com/v1/places/${placeId}?languageCode=he`,
      {
        headers: {
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "rating,userRatingCount,reviews,googleMapsUri",
        },
        cache: "no-store",
      }
    );
    if (!res.ok) {
      console.error("[google-reviews] place details failed:", res.status, await res.text());
      return staleOrNull(cached);
    }
    const place = (await res.json()) as PlaceDetails;

    const data: GoogleReviewsData = {
      rating: place.rating ?? 0,
      count: place.userRatingCount ?? 0,
      // Google returns up to 5 "most relevant". Keep only the flattering ones
      // — this is a marketing section, the full picture is one click away.
      reviews: (place.reviews ?? [])
        .filter((r) => (r.rating ?? 0) >= 4 && r.text?.text)
        .map((r) => ({
          author: r.authorAttribution?.displayName ?? "לקוח",
          authorPhoto: r.authorAttribution?.photoUri ?? null,
          rating: r.rating ?? 5,
          text: r.text!.text!,
          relativeTime: r.relativePublishTimeDescription ?? "",
          publishTime: r.publishTime ?? "",
        })),
      writeReviewUrl: `https://search.google.com/local/writereview?placeid=${placeId}`,
      allReviewsUrl: place.googleMapsUri ?? `https://maps.google.com/?cid=14182524145565495832`,
      fetchedAt: new Date().toISOString(),
    };

    await prisma.keyValue.upsert({
      where: { key: REVIEWS_CACHE_KEY },
      create: { key: REVIEWS_CACHE_KEY, value: data as unknown as object },
      update: { value: data as unknown as object },
    });
    return data;
  } catch (e) {
    console.error("[google-reviews] fetch error:", e);
    return staleOrNull(cached);
  }
}

/** A stale cache beats an empty section when Google hiccups. */
function staleOrNull(cached: { value: unknown } | null): GoogleReviewsData | null {
  return cached ? (cached.value as unknown as GoogleReviewsData) : null;
}

/**
 * Admin-triggered refresh: drop the cache and pull from Google right now.
 *
 * This is the answer to "I just got a review and the site still shows the old
 * number". Polling faster would cost real money (see CACHE_TTL_MS); refreshing
 * on the one event that matters costs a single call, and Elad is the only
 * person who knows when that event happened.
 */
export async function forceRefreshGoogleReviews(): Promise<GoogleReviewsData | null> {
  await prisma.keyValue.deleteMany({ where: { key: REVIEWS_CACHE_KEY } });
  return getGoogleReviews();
}

// ---------------------------------------------------------------------------
// Admin-curated featured reviews.
//
// The Places API (New) does NOT return review TEXTS for this listing (a
// service-area business with no pinned address) — only the aggregate rating
// and count, verified live. So the review CARDS on the homepage come from a
// small owner-curated list: real reviews from the Google listing, transcribed
// and hand-picked by Elad. The rating/count stay live from Google; only the
// quotes are manual. This is also editorially better than whatever five the
// algorithm would surface.
// ---------------------------------------------------------------------------

const FEATURED_KEY = "homepage_featured_reviews";

export interface FeaturedReview {
  author: string;
  rating: number;
  text: string;
  relativeTime: string;
}

export async function getFeaturedReviews(): Promise<FeaturedReview[]> {
  const row = await prisma.keyValue.findUnique({ where: { key: FEATURED_KEY } });
  const list = (row?.value as { reviews?: FeaturedReview[] } | null)?.reviews;
  return Array.isArray(list) ? list : [];
}

export async function setFeaturedReviews(reviews: FeaturedReview[]): Promise<void> {
  await prisma.keyValue.upsert({
    where: { key: FEATURED_KEY },
    create: { key: FEATURED_KEY, value: { reviews } as object },
    update: { value: { reviews } as object },
  });
}
