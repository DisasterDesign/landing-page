import assert from "node:assert/strict";
import test from "node:test";

import { resolveEligibleSellerId, type SellerAssignmentStore } from "./assignment";

function fakeStore(
  settings: Record<string, unknown>,
  validSellerIds: string[],
): SellerAssignmentStore {
  return {
    keyValue: {
      async findUnique({ where }) {
        return where.key in settings
          ? { value: settings[where.key] }
          : null;
      },
    },
    user: {
      async findFirst({ where }) {
        return validSellerIds.includes(where.id) ? { id: where.id } : null;
      },
    },
  };
}

test("sales default seller takes precedence over prospecting fallback", async () => {
  const store = fakeStore(
    {
      "sales:defaultSellerId": "seller-sales",
      "prospecting:defaultSellerId": "seller-prospecting",
    },
    ["seller-sales", "seller-prospecting"],
  );
  assert.equal(await resolveEligibleSellerId(store), "seller-sales");
});

test("invalid sales setting falls back to a valid prospecting seller", async () => {
  const store = fakeStore(
    {
      "sales:defaultSellerId": "deleted-user",
      "prospecting:defaultSellerId": "seller-1",
    },
    ["seller-1"],
  );
  assert.equal(await resolveEligibleSellerId(store), "seller-1");
});

test("missing or invalid assignment returns null without inventing an open pool", async () => {
  assert.equal(await resolveEligibleSellerId(fakeStore({}, [])), null);
});
