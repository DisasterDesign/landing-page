import assert from "node:assert/strict";
import test from "node:test";

import {
  promoteProspect,
  type PromotionLeadData,
  type PromotionStore,
} from "./promotion";

test("promotion is idempotent and preserves cold-lead attribution", async () => {
  const createdRecords: PromotionLeadData[] = [];
  let leadId: string | null = null;
  let promotedLeadId: string | null = null;
  const store: PromotionStore = {
    findOwnedProspect: async () => ({
      id: "prospect-1",
      placeId: "ChIJ123",
      status: "QUALIFIED",
      promotedLeadId,
      opportunitySummary: "אתר איטי עם SEO חלש",
      interactions: [
        {
          outcome: "INTERESTED",
          note: "רוצה הצעה ביום ראשון",
          createdAt: new Date("2026-07-22T10:00:00Z"),
          authorId: "seller-1",
        },
      ],
    }),
    findLeadByExternalId: async () => (leadId ? { id: leadId } : null),
    createPromotion: async (data) => {
      createdRecords.push(data);
      leadId = "lead-1";
      promotedLeadId = leadId;
      return { id: leadId };
    },
    linkExistingLead: async (_prospectId, existingLeadId) => {
      promotedLeadId = existingLeadId;
    },
  };

  const input = {
    prospectId: "prospect-1",
    sellerId: "seller-1",
    live: { displayName: "מאפיית השכונה", phone: "050-123-4567" },
  };
  assert.deepEqual(await promoteProspect(input, { store }), { leadId: "lead-1", created: true });
  assert.deepEqual(await promoteProspect(input, { store }), { leadId: "lead-1", created: false });

  const createdData = createdRecords[0];
  assert.ok(createdData);
  assert.equal(createdData.externalLeadId, "gplaces:ChIJ123");
  assert.equal(createdData.email, null);
  assert.equal(createdData.sellerId, "seller-1");
  assert.equal(createdData.acquisitionChannel, "GOOGLE_PROSPECTING");
  assert.equal(createdData.notes.length, 1);
  assert.match(createdData.notes[0].body, /רוצה הצעה ביום ראשון/);
});

test("only an interested prospect owned by the seller can be promoted", async () => {
  const store: PromotionStore = {
    findOwnedProspect: async () => ({
      id: "prospect-1",
      placeId: "place-1",
      status: "PUBLISHED",
      promotedLeadId: null,
      opportunitySummary: null,
      interactions: [],
    }),
    findLeadByExternalId: async () => null,
    createPromotion: async () => {
      throw new Error("must not create");
    },
    linkExistingLead: async () => undefined,
  };

  await assert.rejects(
    promoteProspect(
      {
        prospectId: "prospect-1",
        sellerId: "seller-1",
        live: { displayName: "עסק", phone: "0501234567" },
      },
      { store },
    ),
    /interested/i,
  );
});
