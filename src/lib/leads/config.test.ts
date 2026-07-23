import assert from "node:assert/strict";
import test from "node:test";
import { getLeadLifecycleConfig } from "./config";

test("lead lifecycle flags are disabled by default", () => {
  assert.deepEqual(getLeadLifecycleConfig({}), {
    enabled: false,
    coldPreparationEnabled: false,
  });
});

test("flags require the exact string true", () => {
  assert.deepEqual(
    getLeadLifecycleConfig({
      UNIFIED_LEAD_LIFECYCLE_ENABLED: "true",
      COLD_LEAD_PREPARATION_ENABLED: "true",
    }),
    { enabled: true, coldPreparationEnabled: true },
  );
});
