import assert from "node:assert/strict";
import test from "node:test";

import {
  getPublishedLeadForProspect,
  type PublishedLeadLookupStore,
} from "./promotion";

test("legacy promotion endpoint resolves the lead created at publication time", async () => {
  const store: PublishedLeadLookupStore = {
    async findPublishedLead(prospectId, sellerId) {
      assert.equal(prospectId, "prospect-1");
      assert.equal(sellerId, "seller-1");
      return { promotedLeadId: "lead-1" };
    },
  };
  assert.deepEqual(
    await getPublishedLeadForProspect("prospect-1", "seller-1", { store }),
    { leadId: "lead-1" },
  );
});

test("compatibility adapter never creates a late lead or persists Google phone", async () => {
  let lookups = 0;
  const store: PublishedLeadLookupStore = {
    async findPublishedLead() {
      lookups += 1;
      return { promotedLeadId: null };
    },
  };
  await assert.rejects(
    getPublishedLeadForProspect("prospect-1", "seller-1", { store }),
    /published lead/i,
  );
  assert.equal(lookups, 1);
  assert.equal("createPromotion" in store, false);
});
