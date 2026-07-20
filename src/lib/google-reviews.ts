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
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
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

export async function getGoogleReviews(): Promise<GoogleReviewsData | null> {
  // Cache-first, key-second. A warm cache is served BEFORE we look at the API
  // key, so the section keeps rendering even if the key is momentarily absent
  // (env var not yet propagated, a bad rotation). The key is only needed to
  // REFRESH once the cache goes stale.
  const cached = await prisma.keyValue.findUnique({ where: { key: REVIEWS_CACHE_KEY } });
  if (cached) {
    const data = cached.value as unknown as GoogleReviewsData;
    if (Date.now() - new Date(data.fetchedAt).getTime() < CACHE_TTL_MS) return data;
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  // No key to refresh with — serve stale cache if we have any, else nothing.
  if (!apiKey) return staleOrNull(cached);

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
