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

// ---- editing a draft quote ----

import { updateOneTimeQuoteSchema } from "@/lib/validations";

test("a quote edit accepts the quote-specific fields", () => {
  const parsed = updateOneTimeQuoteSchema.parse({
    projectTitle: "עיצוב לוגו — גרסה 2",
    scopeOfWork: "שלוש גרסאות במקום שתיים",
    oneTimeFee: 4200,
    vatExempt: true,
    locale: "en",
  });
  assert.equal(parsed.projectTitle, "עיצוב לוגו — גרסה 2");
  assert.equal(parsed.oneTimeFee, 4200);
  assert.equal(parsed.vatExempt, true);
});

test("a quote edit is partial — omitted fields stay untouched", () => {
  const parsed = updateOneTimeQuoteSchema.parse({ oneTimeFee: 999 });
  assert.equal("projectTitle" in parsed, false);
  assert.equal("scopeOfWork" in parsed, false);
});

test("a quote edit can never set a monthly price, a tier or a kind", () => {
  // Editing must not be a back door into turning a quote into a subscription.
  const parsed = updateOneTimeQuoteSchema.parse({
    oneTimeFee: 100,
    monthlyPrice: 599,
    tier: "PREMIUM",
    kind: "SUBSCRIPTION",
  } as Record<string, unknown>);
  assert.equal("monthlyPrice" in parsed, false);
  assert.equal("tier" in parsed, false);
  assert.equal("kind" in parsed, false);
});

test("a blank title or scope is rejected on edit, same as on create", () => {
  assert.throws(() => updateOneTimeQuoteSchema.parse({ projectTitle: "  " }));
  assert.throws(() => updateOneTimeQuoteSchema.parse({ scopeOfWork: "" }));
  assert.throws(() => updateOneTimeQuoteSchema.parse({ oneTimeFee: 0 }));
});
