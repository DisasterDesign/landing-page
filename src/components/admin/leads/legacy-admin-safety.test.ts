import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("./LegacyAdminLeadsPage.tsx", import.meta.url),
  "utf8",
);
const listRoute = readFileSync(
  new URL("../../../app/api/leads/route.ts", import.meta.url),
  "utf8",
);

test("legacy admin keeps permanent history and uses reasoned domain actions", () => {
  assert.doesNotMatch(source, /method:\s*"DELETE"/);
  assert.doesNotMatch(source, /JSON\.stringify\(\{\s*status\s*\}\)/);
  assert.doesNotMatch(source, /action:\s*take\s*\?\s*"claim"\s*:\s*"release"/);
  assert.match(source, /LeadOwnershipControls/);
  assert.match(source, /\/stage/);
});

test("legacy admin deep links request and report the exact lead", () => {
  assert.match(source, /params\.set\("focus"/);
  assert.match(source, /focusState/);
  assert.match(listRoute, /focusState/);
});

test("legacy admin can resolve migration-review rows before unified UI is enabled", () => {
  assert.match(source, /LeadMigrationReviewControls/);
  assert.match(
    source,
    /if\s*\(detail\.canonical\.migrationReviewRequired\)[\s\S]{0,200}<LeadMigrationReviewControls/,
  );
});
