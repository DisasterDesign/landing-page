import assert from "node:assert/strict";
import test from "node:test";

import {
  supersedePublishedCycle,
  type ProspectingReplacementStore,
  type ReplacementSource,
  type ReplacementTransactionInput,
} from "./replacement";

function publishedSource(overrides: Partial<ReplacementSource> = {}): ReplacementSource {
  return {
    id: "cycle-1",
    status: "PUBLISHED",
    weekStart: new Date("2026-07-19T00:00:00Z"),
    revision: 1,
    targetCount: 50,
    assignedSellerId: "seller-1",
    batchId: "batch-1",
    supersededAt: null,
    existingReplacement: null,
    ...overrides,
  };
}

function fakeStore(source: ReplacementSource) {
  let transactionInput: ReplacementTransactionInput | null = null;
  const store: ProspectingReplacementStore = {
    findSource: async () => source,
    supersedeAndCreate: async (input) => {
      transactionInput = input;
      return { replacementCycleId: "cycle-2", invalidatedProspects: 47 };
    },
  };
  return { store, transactionInput: () => transactionInput };
}

test("a published cycle is superseded and recreated at the next revision", async () => {
  const fake = fakeStore(publishedSource());
  const proposed: string[] = [];
  const now = new Date("2026-07-23T08:00:00Z");

  const result = await supersedePublishedCycle(
    "cycle-1",
    "Initial batch failed the independent-business sales-fit criteria",
    now,
    {
      store: fake.store,
      createProposal: async (cycleId) => {
        proposed.push(cycleId);
      },
    },
  );

  assert.deepEqual(result, { replacementCycleId: "cycle-2", invalidatedProspects: 47 });
  assert.deepEqual(fake.transactionInput(), {
    cycleId: "cycle-1",
    batchId: "batch-1",
    weekStart: new Date("2026-07-19T00:00:00Z"),
    revision: 2,
    targetCount: 50,
    assignedSellerId: "seller-1",
    reason: "Initial batch failed the independent-business sales-fit criteria",
    supersededAt: now,
    invalidateOnlyUntouched: true,
  });
  assert.deepEqual(proposed, ["cycle-2"]);
});

test("replacement is idempotent when the published cycle was already superseded", async () => {
  const fake = fakeStore(
    publishedSource({
      supersededAt: new Date("2026-07-23T08:00:00Z"),
      existingReplacement: { id: "cycle-2", hasProposal: true },
    }),
  );
  let proposalCalls = 0;

  const result = await supersedePublishedCycle("cycle-1", "same reason", new Date(), {
    store: fake.store,
    createProposal: async () => {
      proposalCalls += 1;
    },
  });

  assert.deepEqual(result, { replacementCycleId: "cycle-2", invalidatedProspects: 0 });
  assert.equal(fake.transactionInput(), null);
  assert.equal(proposalCalls, 0);
});

test("replacement refuses a non-published cycle or a cycle without a batch", async () => {
  const notPublished = fakeStore(publishedSource({ status: "AUDITING" }));
  await assert.rejects(
    supersedePublishedCycle("cycle-1", "reason", new Date(), { store: notPublished.store }),
    /published/i,
  );

  const noBatch = fakeStore(publishedSource({ batchId: null }));
  await assert.rejects(
    supersedePublishedCycle("cycle-1", "reason", new Date(), { store: noBatch.store }),
    /batch/i,
  );
});
