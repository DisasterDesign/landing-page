import assert from "node:assert/strict";
import test from "node:test";

import { processProspectingWorkBatch, type WorkerResult } from "./worker";

test("worker batch processes two bounded units in one invocation", async () => {
  const results: WorkerResult[] = [
    { enabled: true, action: "discovered", cycleId: "cycle-1", count: 28 },
    { enabled: true, action: "audited", cycleId: "cycle-1" },
  ];
  let calls = 0;

  const result = await processProspectingWorkBatch({
    maxUnits: 2,
    processUnit: async () => results[calls++],
  });

  assert.equal(calls, 2);
  assert.equal(result.action, "audited");
  assert.equal(result.unitsProcessed, 2);
  assert.equal(result.discoveredCount, 28);
});

test("worker batch stops immediately on waiting or failure states", async () => {
  let calls = 0;

  const result = await processProspectingWorkBatch({
    maxUnits: 2,
    processUnit: async () => {
      calls += 1;
      return { enabled: true, action: "waiting", cycleId: "cycle-1" };
    },
  });

  assert.equal(calls, 1);
  assert.equal(result.action, "waiting");
  assert.equal(result.unitsProcessed, 1);
});

test("worker batch can publish immediately after a cycle becomes ready", async () => {
  const results: WorkerResult[] = [
    { enabled: true, action: "ready", cycleId: "cycle-1" },
    { enabled: true, action: "published", cycleId: "cycle-1", count: 50 },
  ];
  let calls = 0;

  const result = await processProspectingWorkBatch({
    maxUnits: 2,
    processUnit: async () => results[calls++],
  });

  assert.equal(calls, 2);
  assert.equal(result.action, "published");
  assert.equal(result.count, 50);
});
