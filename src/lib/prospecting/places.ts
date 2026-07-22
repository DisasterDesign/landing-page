import { z } from "zod";

import type {
  DiscoveredPlace,
  LivePlaceDetails,
  PlacesProspectingProvider,
  TerritorySearchInput,
} from "./types";

const SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const DETAILS_URL = "https://places.googleapis.com/v1/places";
const MAX_RESULTS_PER_QUERY = 60;

export const PLACES_SEARCH_FIELD_MASK = "places.id,nextPageToken";
export const PLACES_DETAILS_FIELD_MASK =
  "id,displayName,nationalPhoneNumber,formattedAddress,websiteUri,businessStatus";

export const PROSPECTING_CATEGORY_QUERIES = Object.freeze([
  "חנויות",
  "מסעדות ובתי קפה",
  "בעלי מקצוע",
  "קליניקות וטיפוח",
  "משרדים ושירותים עסקיים",
]);

const searchResponseSchema = z.object({
  places: z.array(z.object({ id: z.string().min(1) }).passthrough()).optional().default([]),
  nextPageToken: z.string().min(1).optional(),
});

const detailsResponseSchema = z.object({
  id: z.string().min(1),
  displayName: z.union([z.string(), z.object({ text: z.string() })]).optional(),
  nationalPhoneNumber: z.string().optional(),
  formattedAddress: z.string().optional(),
  websiteUri: z.string().optional(),
  businessStatus: z.string().optional(),
});

export function parsePlacesSearchResponse(value: unknown): {
  placeIds: string[];
  nextPageToken?: string;
} {
  const parsed = searchResponseSchema.parse(value);
  const placeIds = Array.from(new Set(parsed.places.map(({ id }) => id)));
  return parsed.nextPageToken ? { placeIds, nextPageToken: parsed.nextPageToken } : { placeIds };
}

interface PlacesProviderOptions {
  apiKey: string;
  maxDiscoveredPerCycle: number;
  maxPlacesCallsPerCycle: number;
  fetchImpl?: typeof fetch;
}

export class GooglePlacesProspectingProvider implements PlacesProspectingProvider {
  private readonly fetchImpl: typeof fetch;
  private readonly discovered = new Set<string>();
  private calls = 0;

  constructor(private readonly options: PlacesProviderOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  getCallCount(): number {
    return this.calls;
  }

  async discover(input: TerritorySearchInput): Promise<DiscoveredPlace[]> {
    const queryResults: DiscoveredPlace[] = [];
    let pageToken = input.pageToken;

    while (
      queryResults.length < MAX_RESULTS_PER_QUERY &&
      this.discovered.size < this.options.maxDiscoveredPerCycle &&
      this.calls < this.options.maxPlacesCallsPerCycle
    ) {
      this.calls += 1;
      const response = await this.fetchImpl(SEARCH_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "X-Goog-Api-Key": this.options.apiKey,
          "X-Goog-FieldMask": PLACES_SEARCH_FIELD_MASK,
        },
        body: JSON.stringify({
          textQuery: input.query,
          pageSize: 20,
          languageCode: "he",
          regionCode: "IL",
          ...(pageToken ? { pageToken } : {}),
        }),
      });
      if (!response.ok) throw new Error(`Places search failed with HTTP ${response.status}`);

      const page = parsePlacesSearchResponse(await response.json());
      for (const placeId of page.placeIds) {
        if (this.discovered.has(placeId)) continue;
        this.discovered.add(placeId);
        queryResults.push({ placeId });
        if (
          queryResults.length === MAX_RESULTS_PER_QUERY ||
          this.discovered.size === this.options.maxDiscoveredPerCycle
        ) {
          break;
        }
      }

      if (!page.nextPageToken) break;
      pageToken = page.nextPageToken;
    }

    return queryResults;
  }

  async getLiveDetails(placeIds: string[]): Promise<Map<string, LivePlaceDetails>> {
    const details = new Map<string, LivePlaceDetails>();
    for (const placeId of placeIds) {
      if (this.calls >= this.options.maxPlacesCallsPerCycle) break;
      this.calls += 1;
      const response = await this.fetchImpl(`${DETAILS_URL}/${encodeURIComponent(placeId)}`, {
        headers: {
          "X-Goog-Api-Key": this.options.apiKey,
          "X-Goog-FieldMask": PLACES_DETAILS_FIELD_MASK,
        },
      });
      if (!response.ok) continue;
      const parsed = detailsResponseSchema.parse(await response.json());
      details.set(placeId, {
        placeId: parsed.id,
        displayName:
          typeof parsed.displayName === "string"
            ? parsed.displayName
            : (parsed.displayName?.text ?? ""),
        nationalPhoneNumber: parsed.nationalPhoneNumber ?? null,
        formattedAddress: parsed.formattedAddress ?? null,
        websiteUri: parsed.websiteUri ?? null,
        businessStatus: parsed.businessStatus ?? null,
      });
    }
    return details;
  }
}
