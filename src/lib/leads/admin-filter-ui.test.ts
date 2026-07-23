import assert from "node:assert/strict";
import test from "node:test";

import { adminDateInputValue } from "./admin-filter-ui";

test("admin date filters round-trip ISO query values into date inputs", () => {
  assert.equal(
    adminDateInputValue("2026-07-01T00:00:00.000Z"),
    "2026-07-01",
  );
  assert.equal(adminDateInputValue("2026-07-31"), "2026-07-31");
  assert.equal(adminDateInputValue("not-a-date"), "");
  assert.equal(adminDateInputValue(null), "");
});
