import assert from "node:assert/strict";
import test from "node:test";

import fixture from "./__fixtures__/places-search.json";
import {
  GooglePlacesProspectingProvider,
  PLACES_DETAILS_FIELD_MASK,
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

test("one malformed Place response does not erase other live details", async () => {
  const responses = new Map<string, Response>([
    [
      "one",
      Response.json({
        id: "one",
        displayName: { text: "עסק אחד" },
        nationalPhoneNumber: "03-1111111",
        formattedAddress: "רחוב אחד 1",
        websiteUri: "https://one.example",
        businessStatus: "OPERATIONAL",
        primaryTypeDisplayName: { text: "מספרה" },
        rating: 4.4,
        userRatingCount: 27,
        regularOpeningHours: { weekdayDescriptions: ["יום ראשון: 09:00–18:00"] },
      }),
    ],
    ["two", Response.json({ id: 42 })],
    [
      "three",
      Response.json({
        id: "three",
        displayName: { text: "עסק שלוש" },
        nationalPhoneNumber: "08-3333333",
      }),
    ],
  ]);
  const requestedMasks: string[] = [];
  const provider = new GooglePlacesProspectingProvider({
    apiKey: "places-key",
    maxDiscoveredPerCycle: 250,
    maxPlacesCallsPerCycle: 400,
    onDetailError: () => undefined,
    fetchImpl: async (input, init) => {
      requestedMasks.push(new Headers(init?.headers).get("X-Goog-FieldMask") ?? "");
      const placeId = decodeURIComponent(String(input).split("/").at(-1) ?? "");
      return responses.get(placeId) ?? Response.json({}, { status: 404 });
    },
  });

  const details = await provider.getLiveDetails(["one", "two", "three"]);

  assert.deepEqual([...details.keys()].sort(), ["one", "three"]);
  assert.deepEqual(details.get("one"), {
    placeId: "one",
    displayName: "עסק אחד",
    nationalPhoneNumber: "03-1111111",
    formattedAddress: "רחוב אחד 1",
    websiteUri: "https://one.example",
    businessStatus: "OPERATIONAL",
    category: "מספרה",
    rating: 4.4,
    reviewCount: 27,
    weekdayDescriptions: ["יום ראשון: 09:00–18:00"],
  });
  assert.equal(requestedMasks.every((mask) => mask === PLACES_DETAILS_FIELD_MASK), true);
  for (const field of [
    "primaryTypeDisplayName",
    "rating",
    "userRatingCount",
    "regularOpeningHours",
  ]) {
    assert.match(PLACES_DETAILS_FIELD_MASK, new RegExp(field));
  }
});
