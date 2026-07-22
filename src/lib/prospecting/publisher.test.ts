import assert from "node:assert/strict";
import test from "node:test";

import { selectPublishableProspects } from "./publisher";

function prospect(
  id: string,
  overrides: Partial<Parameters<typeof selectPublishableProspects>[0][number]> = {},
) {
  return {
    id,
    status: "READY" as const,
    qualityScore: 2,
    auditConfidence: 0.8,
    commercialFit: 5,
    auditedDomain: `${id}.example`,
    hasLivePhone: true,
    discoveredAt: new Date("2026-07-01T00:00:00Z"),
    ...overrides,
  };
}

test("publication excludes score five, suppressed and existing-client domains", () => {
  const selected = selectPublishableProspects(
    [
      prospect("good-target", { qualityScore: 4 }),
      prospect("too-good", { qualityScore: 5 }),
      prospect("suppressed", { status: "SUPPRESSED" }),
      prospect("existing", { auditedDomain: "client.example" }),
    ],
    { existingDomains: new Set(["client.example"]) },
  );

  assert.deepEqual(selected.map(({ id }) => id), ["good-target"]);
});

test("missing phones are skipped and later candidates backfill the batch", () => {
  const candidates = [
    prospect("no-phone", { qualityScore: 0, hasLivePhone: false }),
    ...Array.from({ length: 55 }, (_, index) => prospect(`lead-${index}`)),
  ];
  const selected = selectPublishableProspects(candidates);

  assert.equal(selected.length, 50);
  assert.equal(selected.some(({ id }) => id === "no-phone"), false);
  assert.equal(candidates.length, 56);
  assert.equal(candidates.filter(({ id }) => !selected.some((item) => item.id === id)).length, 6);
});

test("publication order is bad score first, then confidence, commercial fit and age", () => {
  const selected = selectPublishableProspects([
    prospect("new", { qualityScore: 2, auditConfidence: 0.9, discoveredAt: new Date("2026-07-02") }),
    prospect("commercial", { qualityScore: 2, auditConfidence: 0.9, commercialFit: 9 }),
    prospect("confident", { qualityScore: 2, auditConfidence: 0.95 }),
    prospect("worst", { qualityScore: 0 }),
  ]);

  assert.deepEqual(selected.map(({ id }) => id), ["worst", "confident", "commercial", "new"]);
});
