import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The Graph API version must be pinned, current, and declared in one place.
 *
 * facebook.ts sat on v19.0 (released Jan 2024) past its 21.5.2026 expiry.
 * Meta does not fail those calls — it silently routes them to "the next
 * oldest usable version", so the integration was running on a version that
 * could shift under it with no error and no log line. That is the worst
 * possible state to debug a lead-flow outage from.
 *
 * Bumping GRAPH_VERSION is a deliberate act: check Meta's changelog for the
 * new expiry date, then widen SUPPORTED here in the same commit.
 */
const SOURCE = readFileSync(join(process.cwd(), "src/lib/facebook.ts"), "utf8");

// v25.0 is what Meta itself reports for our existing leadgen webhook
// subscription, so it is the aligned choice; v26.0 is the newer sibling.
const SUPPORTED = ["v25.0", "v26.0"];

test("GRAPH_VERSION is pinned to a version Meta still serves", () => {
  const declared = SOURCE.match(/const GRAPH_VERSION = "(v\d+\.\d+)"/);
  assert.ok(declared, "GRAPH_VERSION must be declared as a literal constant");
  assert.ok(
    SUPPORTED.includes(declared[1]),
    `${declared[1]} is not in ${SUPPORTED.join("/")} — an expired version does not error, it silently falls back`,
  );
});

test("no Meta URL hardcodes a version instead of using the constant", () => {
  // One bump must move every endpoint. A stray literal is how GRAPH and OAUTH
  // drift apart and how an expiry goes unnoticed for months.
  const inline = [...SOURCE.matchAll(/facebook\.com\/v\d+\.\d+/g)].map((m) => m[0]);
  assert.deepEqual(inline, [], `build these from GRAPH_VERSION: ${inline.join(", ")}`);
});

test("both the Graph host and the OAuth dialog are built from the constant", () => {
  assert.match(SOURCE, /const GRAPH = `https:\/\/graph\.facebook\.com\/\$\{GRAPH_VERSION\}`/);
  assert.match(SOURCE, /const OAUTH = `https:\/\/www\.facebook\.com\/\$\{GRAPH_VERSION\}\/dialog\/oauth`/);
});
