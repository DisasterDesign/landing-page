import assert from "node:assert/strict";
import test from "node:test";

import { createOneTimeQuoteSchema } from "@/lib/validations";

const valid = {
  projectTitle: "עיצוב לוגו ומיתוג",
  customerName: "ישראל ישראלי",
  businessName: "ישראלי בע״מ",
  phone: "0501234567",
  email: "israel@example.com",
  oneTimeFee: 3500,
  scopeOfWork: "עיצוב לוגו, מדריך מותג קצר, וקבצי מקור.",
};

test("a complete quote parses and is forced onto the one-time rails", () => {
  const parsed = createOneTimeQuoteSchema.parse(valid);
  assert.equal(parsed.projectTitle, "עיצוב לוגו ומיתוג");
  assert.equal(parsed.oneTimeFee, 3500);
  // The caller cannot choose these — a quote is a quote.
  assert.equal(parsed.kind, "ONE_TIME");
  assert.equal(parsed.monthlyPrice, 0);
  assert.equal(parsed.tier, null);
});

test("projectTitle is required — it is the row label in /admin/jobs", () => {
  const { projectTitle: _omitted, ...without } = valid;
  assert.throws(() => createOneTimeQuoteSchema.parse(without));
  assert.throws(() =>
    createOneTimeQuoteSchema.parse({ ...valid, projectTitle: "   " }),
  );
});

test("scope of work is required — it becomes the body of the signed document", () => {
  const { scopeOfWork: _omitted, ...without } = valid;
  assert.throws(() => createOneTimeQuoteSchema.parse(without));
});

test("the fee must be a positive amount", () => {
  assert.throws(() => createOneTimeQuoteSchema.parse({ ...valid, oneTimeFee: 0 }));
  assert.throws(() =>
    createOneTimeQuoteSchema.parse({ ...valid, oneTimeFee: -100 }),
  );
});

test("a quote can never smuggle in a client, a product or a monthly price", () => {
  // Passing them is not an error — they are simply not part of the output, so
  // no code path downstream can act on them.
  const parsed = createOneTimeQuoteSchema.parse({
    ...valid,
    clientId: "cl-1",
    productId: "pr-1",
    monthlyPrice: 599,
    tier: "PREMIUM",
  } as Record<string, unknown>);
  assert.equal("clientId" in parsed, false);
  assert.equal("productId" in parsed, false);
  assert.equal(parsed.monthlyPrice, 0);
  assert.equal(parsed.tier, null);
});

test("contact details are still validated like any other agreement", () => {
  assert.throws(() => createOneTimeQuoteSchema.parse({ ...valid, email: "nope" }));
  assert.throws(() => createOneTimeQuoteSchema.parse({ ...valid, phone: "123" }));
  assert.throws(() =>
    createOneTimeQuoteSchema.parse({ ...valid, customerName: "" }),
  );
});

test("business name and id number stay optional", () => {
  const parsed = createOneTimeQuoteSchema.parse({
    ...valid,
    businessName: undefined,
    idNumber: undefined,
  });
  assert.equal(parsed.customerName, "ישראל ישראלי");
});
