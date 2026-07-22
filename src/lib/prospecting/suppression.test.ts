import assert from "node:assert/strict";
import test from "node:test";

import { hashSuppressionValue, normalizeDomain, normalizePhone } from "./suppression";

test("suppression hashes are normalized, deterministic and secret-bound", () => {
  assert.equal(normalizePhone("+972 50-123-4567"), "972501234567");
  assert.equal(normalizeDomain("HTTPS://WWW.Example.COM/path"), "example.com");
  assert.equal(
    hashSuppressionValue(" +972 50-123-4567 ", "secret-a"),
    hashSuppressionValue("+972501234567", "secret-a"),
  );
  assert.notEqual(
    hashSuppressionValue("+972501234567", "secret-a"),
    hashSuppressionValue("+972501234567", "secret-b"),
  );
});
