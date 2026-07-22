import assert from "node:assert/strict";
import test from "node:test";

import fixture from "./__fixtures__/pagespeed.json";
import { parsePageSpeedResponse, runPageSpeed } from "./pagespeed";

test("PageSpeed parser extracts lab scores, key timings, SEO evidence and screenshot", () => {
  assert.deepEqual(parsePageSpeedResponse(fixture), {
    performanceScore: 62,
    seoScore: 91,
    accessibilityScore: 83,
    bestPracticesScore: 74,
    largestContentfulPaintMs: 3200,
    cumulativeLayoutShift: 0.18,
    totalBlockingTimeMs: 410,
    seoAudits: {
      documentTitle: true,
      metaDescription: false,
      crawlable: true,
    },
    finalScreenshotDataUrl: "data:image/jpeg;base64,ZmFrZQ==",
  });
});

test("absent CrUX field data does not fail a lab audit", async () => {
  const result = await runPageSpeed("https://example.com", {
    apiKey: "speed-key",
    fetchImpl: async () => Response.json(fixture),
  });
  assert.equal(result.performanceScore, 62);
});
