import assert from "node:assert/strict";
import test from "node:test";

import { calculateWebsiteScore } from "./score";
import type { WebsiteScoreDimensions } from "./types";

const dimensionKeys = [
  ["availabilityScore", 20],
  ["performanceScore", 20],
  ["seoScore", 20],
  ["maintenanceScore", 15],
  ["visualScore", 15],
  ["commercialScore", 10],
] as const;

function dimensionsFor(rawScore: number): WebsiteScoreDimensions {
  let remaining = rawScore;
  const result = {} as WebsiteScoreDimensions;

  for (const [key, maximum] of dimensionKeys) {
    result[key] = Math.min(remaining, maximum);
    remaining -= result[key];
  }

  return result;
}

for (const [rawScore, qualityScore] of [
  [19, 0],
  [20, 1],
  [39, 1],
  [40, 2],
  [54, 2],
  [55, 3],
  [69, 3],
  [70, 4],
  [84, 4],
  [85, 5],
] as const) {
  test(`raw score ${rawScore} maps to quality ${qualityScore}`, () => {
    const result = calculateWebsiteScore({
      websiteStatus: "ACTIVE",
      dimensions: dimensionsFor(rawScore),
    });

    assert.equal(result.rawScore, rawScore);
    assert.equal(result.qualityScore, qualityScore);
    assert.equal(result.scoringVersion, 1);
    assert.equal(Object.isFrozen(result), true);
  });
}

test("hard website failures always score zero", () => {
  for (const websiteStatus of [
    "NO_WEBSITE",
    "SOCIAL_ONLY",
    "PARKED",
    "UNREACHABLE",
  ] as const) {
    const result = calculateWebsiteScore({ websiteStatus });
    assert.equal(result.rawScore, 0);
    assert.equal(result.qualityScore, 0);
  }
});

test("blocked and unknown sites require review instead of a guessed score", () => {
  assert.throws(() => calculateWebsiteScore({ websiteStatus: "BLOCKED" }), /cannot be scored/i);
  assert.throws(() => calculateWebsiteScore({ websiteStatus: "UNKNOWN" }), /cannot be scored/i);
});

test("dimension ranges are enforced", () => {
  assert.throws(
    () =>
      calculateWebsiteScore({
        websiteStatus: "ACTIVE",
        dimensions: { ...dimensionsFor(100), visualScore: 16 },
      }),
    /visualScore/,
  );
});
