import assert from "node:assert/strict";
import test from "node:test";

import { isLeadChangedEventFor } from "./ui-events";

test("matches only lead change events for the current lead", () => {
  assert.equal(
    isLeadChangedEventFor({ detail: { id: "lead-1" } }, "lead-1"),
    true,
  );
  assert.equal(
    isLeadChangedEventFor({ detail: { id: "lead-2" } }, "lead-1"),
    false,
  );
  assert.equal(isLeadChangedEventFor({ detail: {} }, "lead-1"), false);
  assert.equal(isLeadChangedEventFor(null, "lead-1"), false);
});
