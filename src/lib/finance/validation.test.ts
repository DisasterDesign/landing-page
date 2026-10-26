import assert from "node:assert/strict";
import test from "node:test";
import { createOneTimeQuoteSchema, updateOneTimeQuoteSchema, createExpenseSchema, updateExpenseSchema, createAgreementSchema, createJobSchema } from "@/lib/validations";
const quote = { projectTitle: "Brand", scopeOfWork: "Design", oneTimeFee: 100, customerName: "A", phone: "0501234567", email: "a@example.com" };
const expense = { name: "Hosting", vendor: "Cloudflare", amount: 100 };
test("quote inputs retain an explicit private or shared book and reject unassigned", () => {
  for (const financeBook of ["PRIVATE", "SHARED"]) assert.equal(createOneTimeQuoteSchema.parse({ ...quote, financeBook }).financeBook, financeBook);
  assert.equal(createOneTimeQuoteSchema.safeParse({ ...quote, financeBook: "UNASSIGNED" }).success, false);
});
test("omitted book on edits cannot reset historical attribution", () => {
  assert.equal("financeBook" in updateOneTimeQuoteSchema.parse({ oneTimeFee: 200 }), false);
  assert.equal("financeBook" in updateExpenseSchema.parse({ amount: 200 }), false);
  assert.equal(updateOneTimeQuoteSchema.parse({ financeBook: "SHARED" }).financeBook, "SHARED");
});
test("expense allocation accepts integer basis points including endpoints and rejects invalid allocation", () => {
  for (const sharedBasisPoints of [0, 4000, 10000]) assert.equal(createExpenseSchema.parse({ ...expense, sharedBasisPoints }).sharedBasisPoints, sharedBasisPoints);
  for (const sharedBasisPoints of [-1, 10001, 40.5]) assert.equal(createExpenseSchema.safeParse({ ...expense, sharedBasisPoints }).success, false);
  assert.equal(createExpenseSchema.parse({ ...expense, financeBook: "PRIVATE", clientProductId: "product" }).clientProductId, "product");
});
test("agreement and job book selection stays optional for server resolved defaults", () => {
  assert.equal(createAgreementSchema.parse({ ...quote, monthlyPrice: 99, financeBook: "SHARED" }).financeBook, "SHARED");
  assert.equal(createJobSchema.parse({ title: "Build", amount: 100, clientId: "client", closedAt: "2026-10-26", financeBook: "PRIVATE" }).financeBook, "PRIVATE");
  assert.equal("financeBook" in createOneTimeQuoteSchema.parse(quote), false);
});
