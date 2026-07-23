import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const routes = [
  "src/app/api/cron/facebook-sync/route.ts",
  "src/app/api/integrations/facebook/sync/route.ts",
];

test("Meta sync accounting resolves existing leads by source and external ID", () => {
  for (const route of routes) {
    const source = fs.readFileSync(path.join(process.cwd(), route), "utf8");
    assert.match(
      source,
      /contactSubmission\.findUnique\(\{[\s\S]*?sourceKey_externalLeadId:[\s\S]*?sourceKey:\s*"meta_lead_ads"[\s\S]*?externalLeadId:\s*lead\.id/,
      route,
    );
    assert.match(
      source,
      /contactSubmission\.findFirst\(\{[\s\S]*?externalLeadId:\s*lead\.id[\s\S]*?sourceKey:\s*null/,
      route,
    );
  }
});
