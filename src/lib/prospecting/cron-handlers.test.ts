import assert from "node:assert/strict";
import test from "node:test";

import {
  runProspectingMaintenanceCron,
  runProspectingProposalCron,
  runProspectingWorkerCron,
} from "./cron-handlers";

test("disabled prospecting cron handlers are successful no-ops", async () => {
  let calls = 0;
  const action = async () => {
    calls += 1;
    return { action: "ran" };
  };

  assert.deepEqual(await runProspectingProposalCron({ enabled: false, action }), {
    enabled: false,
    action: "disabled",
  });
  assert.deepEqual(await runProspectingWorkerCron({ enabled: false, action }), {
    enabled: false,
    action: "disabled",
  });
  assert.deepEqual(await runProspectingMaintenanceCron({ enabled: false, action }), {
    enabled: false,
    action: "disabled",
  });
  assert.equal(calls, 0);
});

test("the admin kill switch also prevents all cron work", async () => {
  let calls = 0;
  const result = await runProspectingWorkerCron({
    enabled: true,
    adminKillSwitch: true,
    action: async () => {
      calls += 1;
      return { action: "ran" };
    },
  });
  assert.deepEqual(result, { enabled: false, action: "admin-kill-switch" });
  assert.equal(calls, 0);
});
