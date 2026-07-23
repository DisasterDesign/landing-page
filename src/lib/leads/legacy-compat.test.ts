import assert from "node:assert/strict";
import test from "node:test";
import { legacyLeadStateHash, type LegacyLeadStateInput } from "./legacy-compat";

const base: LegacyLeadStateInput = {
  status: "IN_PROGRESS",
  assigneeIds: ["seller-2", "seller-1"],
  source: "FACEBOOK",
  acquisitionChannel: "META",
  externalLeadId: "meta-1",
  externalFormId: "form-1",
  externalFormName: "Main form",
  externalCampaignId: "campaign-1",
  externalAdId: "ad-1",
  nextFollowUpAt: new Date("2026-07-24T09:00:00.000Z"),
  lastContactedAt: new Date("2026-07-23T09:00:00.000Z"),
  closedAt: null,
};

test("legacy state hash is stable across assignee ordering and equivalent dates", () => {
  const reordered = {
    ...base,
    assigneeIds: ["seller-1", "seller-2"],
    nextFollowUpAt: "2026-07-24T09:00:00.000Z",
  };
  assert.equal(legacyLeadStateHash(base), legacyLeadStateHash(reordered));
});

test("every mapped compatibility field affects the hash", () => {
  const mutations: LegacyLeadStateInput[] = [
    { ...base, status: "LOST" },
    { ...base, assigneeIds: ["seller-1"] },
    { ...base, source: "OTHER" },
    { ...base, acquisitionChannel: "WEBSITE" },
    { ...base, externalLeadId: "meta-2" },
    { ...base, externalFormId: "form-2" },
    { ...base, externalFormName: "Other form" },
    { ...base, externalCampaignId: "campaign-2" },
    { ...base, externalAdId: "ad-2" },
    { ...base, nextFollowUpAt: null },
    { ...base, lastContactedAt: null },
    { ...base, closedAt: new Date("2026-07-23T10:00:00.000Z") },
  ];
  const original = legacyLeadStateHash(base);
  for (const mutation of mutations) {
    assert.notEqual(legacyLeadStateHash(mutation), original);
  }
});

test("legacy state hash rejects PII-bearing or unknown keys", () => {
  assert.throws(
    () => legacyLeadStateHash({ ...base, phone: "0500000000" } as never),
    /unsupported legacy state key: phone/,
  );
  assert.throws(
    () => legacyLeadStateHash({ ...base, note: "private" } as never),
    /unsupported legacy state key: note/,
  );
});

test("null and invalid dates are serialized deterministically", () => {
  const nullHash = legacyLeadStateHash({ ...base, nextFollowUpAt: null });
  assert.equal(nullHash, legacyLeadStateHash({ ...base, nextFollowUpAt: null }));
  assert.throws(
    () => legacyLeadStateHash({ ...base, nextFollowUpAt: "not-a-date" }),
    /invalid legacy state date/,
  );
});
