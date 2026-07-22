import assert from "node:assert/strict";
import test from "node:test";

import { getProspectingConfig } from "./config";

test("prospecting is disabled unless explicitly true", () => {
  const config = getProspectingConfig({});

  assert.equal(config.enabled, false);
  assert.equal(config.weeklyTarget, 50);
  assert.equal(config.maxDiscoveredPerCycle, 250);
});

test("enabled prospecting requires every external service credential", () => {
  assert.throws(
    () => getProspectingConfig({ PROSPECTING_ENABLED: "true" }),
    /PROSPECTING_AI_API_KEY.*PROSPECTING_GOOGLE_PLACES_API_KEY.*PROSPECTING_PAGESPEED_API_KEY.*PROSPECTING_HASH_SECRET/,
  );
});

test("weekly target can be lowered but never raised above fifty", () => {
  assert.equal(
    getProspectingConfig({ PROSPECTING_WEEKLY_TARGET: "17" }).weeklyTarget,
    17,
  );
  assert.equal(
    getProspectingConfig({ PROSPECTING_WEEKLY_TARGET: "500" }).weeklyTarget,
    50,
  );
});

test("invalid numeric limits fall back to safe defaults", () => {
  const config = getProspectingConfig({
    PROSPECTING_MAX_DISCOVERED_PER_CYCLE: "-1",
    PROSPECTING_MAX_ESTIMATED_COST_USD: "not-a-number",
  });

  assert.equal(config.maxDiscoveredPerCycle, 250);
  assert.equal(config.maxEstimatedCostUsd, 25);
});
