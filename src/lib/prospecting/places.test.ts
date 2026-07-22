import assert from "node:assert/strict";
import test from "node:test";

import fixture from "./__fixtures__/places-search.json";
import {
  GooglePlacesProspectingProvider,
  PLACES_SEARCH_FIELD_MASK,
  parsePlacesSearchResponse,
} from "./places";

test("Places parser exposes only durable place IDs and a page token", () => {
  assert.deepEqual(parsePlacesSearchResponse(fixture), {
    placeIds: ["place-1", "place-2"],
    nextPageToken: "page-2",
  });
});

test("Places discovery paginates, deduplicates and sends an IDs-only field mask", async () => {
  const requests: Array<{ headers: Headers; body: Record<string, unknown> }> = [];
  const pages = [
    { places: [{ id: "a" }, { id: "b" }], nextPageToken: "next" },
    { places: [{ id: "b" }, { id: "c" }] },
  ];
  const provider = new GooglePlacesProspectingProvider({
    apiKey: "places-key",
    maxDiscoveredPerCycle: 250,
    maxPlacesCallsPerCycle: 400,
    fetchImpl: async (_input, init) => {
      requests.push({
        headers: new Headers(init?.headers),
        body: JSON.parse(String(init?.body)),
      });
      return Response.json(pages[requests.length - 1]);
    },
  });

  const places = await provider.discover({ query: "עסקים ברחוב דיזנגוף תל אביב" });

  assert.deepEqual(places, [{ placeId: "a" }, { placeId: "b" }, { placeId: "c" }]);
  assert.equal(requests[0].headers.get("X-Goog-FieldMask"), PLACES_SEARCH_FIELD_MASK);
  assert.equal(requests[1].body.pageToken, "next");
});

test("a text query stops at Google's 60-result limit", async () => {
  let calls = 0;
  const provider = new GooglePlacesProspectingProvider({
    apiKey: "places-key",
    maxDiscoveredPerCycle: 250,
    maxPlacesCallsPerCycle: 400,
    fetchImpl: async () => {
      calls += 1;
      return Response.json({
        places: Array.from({ length: 20 }, (_, index) => ({ id: `p-${calls}-${index}` })),
        nextPageToken: `page-${calls + 1}`,
      });
    },
  });

  const places = await provider.discover({ query: "חנויות בירושלים" });
  assert.equal(places.length, 60);
  assert.equal(calls, 3);
});

test("the configured global discovery cap is stricter than provider pagination", async () => {
  let calls = 0;
  const provider = new GooglePlacesProspectingProvider({
    apiKey: "places-key",
    maxDiscoveredPerCycle: 25,
    maxPlacesCallsPerCycle: 400,
    fetchImpl: async () => {
      calls += 1;
      return Response.json({
        places: Array.from({ length: 20 }, (_, index) => ({ id: `p-${calls}-${index}` })),
        nextPageToken: `page-${calls + 1}`,
      });
    },
  });

  assert.equal((await provider.discover({ query: "עסקים בחיפה" })).length, 25);
  assert.equal(calls, 2);
});
