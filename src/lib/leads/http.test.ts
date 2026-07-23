import assert from "node:assert/strict";
import test from "node:test";

import { LeadDomainError } from "./errors";
import { leadDomainErrorResponse } from "./http";

test("lead domain errors map to stable HTTP statuses", async () => {
  const cases = [
    ["NOT_FOUND", 404],
    ["FORBIDDEN", 403],
    ["CONFLICT", 409],
    ["INVALID_TRANSITION", 422],
    ["VALIDATION", 400],
  ] as const;
  for (const [code, status] of cases) {
    const response = leadDomainErrorResponse(
      new LeadDomainError(code, `message-${code}`),
    );
    assert.equal(response.status, status);
    assert.deepEqual(await response.json(), {
      error: code,
      message: `message-${code}`,
    });
  }
  assert.equal(leadDomainErrorResponse(new Error("unknown")).status, 500);
});
