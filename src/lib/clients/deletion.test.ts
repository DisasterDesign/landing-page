import assert from "node:assert/strict";
import test from "node:test";

import { decideClientDeletion } from "./deletion";

/**
 * Written after סולל בונה: four clients with ₪0 monthly and no status looked
 * like empty rows and were hard-deleted from /admin/clients. onDelete: Cascade
 * took three ClientJobs — ₪4,000 of one-off work — with them, and Neon's 6-hour
 * history window had long closed. This decides what "delete" is allowed to mean.
 */

const bare = { jobs: 0, agreements: 0, charges: 0, products: 0, expenses: 0 };

test("a client with financial history is archived, never deleted", () => {
  for (const field of ["jobs", "agreements", "charges"] as const) {
    const d = decideClientDeletion({ ...bare, [field]: 1 });
    assert.equal(d.action, "archive", `${field} must force archive`);
    assert.ok(d.reason.length > 0);
  }
});

test("a client with products is archived — the product rows carry MRR history", () => {
  assert.equal(decideClientDeletion({ ...bare, products: 2 }).action, "archive");
});

test("a client with linked expenses is archived — deleting would orphan the expense", () => {
  assert.equal(decideClientDeletion({ ...bare, expenses: 1 }).action, "archive");
});

test("only a client with no history at all may be hard-deleted", () => {
  const d = decideClientDeletion(bare);
  assert.equal(d.action, "delete");
});

test("the reason names what was found, so the UI can say why", () => {
  const d = decideClientDeletion({ ...bare, jobs: 3, agreements: 1 });
  assert.equal(d.action, "archive");
  assert.ok(d.reason.includes("3"));
  assert.ok(/עבודות/.test(d.reason));
});
