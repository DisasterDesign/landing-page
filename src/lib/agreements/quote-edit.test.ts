import assert from "node:assert/strict";
import test from "node:test";

import { planQuoteEdit } from "./quote-edit";
import { quoteBodyHtml, scopeFromBodyHtml } from "./one-time";

const draft = {
  kind: "ONE_TIME" as const,
  status: "DRAFT" as const,
  projectTitle: "לוגו",
  customerName: "דנה",
  businessName: null,
  idNumber: null,
  phone: "0501234567",
  email: "d@x.com",
  oneTimeFee: 2000,
  locale: "he",
  vatExempt: false,
  customBodyHtml: quoteBodyHtml({ scope: "עיצוב לוגו\n\nשלוש סבבים", oneTimeFee: 2000, vatExempt: false, locale: "he" }),
};

test("a missing agreement is refused with 404", () => {
  const plan = planQuoteEdit(null, { oneTimeFee: 1 });
  assert.equal(plan.kind, "refuse");
  if (plan.kind === "refuse") assert.equal(plan.status, 404);
});

test("GUARD: a subscription agreement cannot be edited through the quote route", () => {
  const plan = planQuoteEdit({ ...draft, kind: "SUBSCRIPTION" }, { oneTimeFee: 1 });
  assert.equal(plan.kind, "refuse");
  if (plan.kind === "refuse") assert.equal(plan.status, 400);
});

test("GUARD: a signed or cancelled quote is a closed record — 409, never silently applied", () => {
  for (const status of ["SIGNED", "CANCELLED"] as const) {
    const plan = planQuoteEdit({ ...draft, status }, { oneTimeFee: 1 });
    assert.equal(plan.kind, "refuse", status);
    if (plan.kind === "refuse") assert.equal(plan.status, 409);
  }
});

test("a fee-only edit rebuilds the price table from the recovered scope — no scope resend required", () => {
  const plan = planQuoteEdit(draft, { oneTimeFee: 2500 });
  assert.equal(plan.kind, "apply");
  if (plan.kind !== "apply") return;
  assert.equal(plan.data.oneTimeFee, 2500);
  // The customer must see the new number in the document, not the old one.
  assert.ok(plan.data.customBodyHtml.includes("2,500"));
  assert.equal(plan.data.customBodyHtml.includes("2,000"), false);
  // And the typed scope survived the round trip untouched.
  assert.equal(scopeFromBodyHtml(plan.data.customBodyHtml), "עיצוב לוגו\n\nשלוש סבבים");
});

test("switching to foreign (en + no VAT) re-renders the body in English without VAT", () => {
  const plan = planQuoteEdit(draft, { locale: "en", vatExempt: true });
  assert.equal(plan.kind, "apply");
  if (plan.kind !== "apply") return;
  assert.equal(plan.data.locale, "en");
  assert.equal(plan.data.vatExempt, true);
  assert.ok(plan.data.customBodyHtml.includes("Payment"));
  assert.equal(plan.data.customBodyHtml.includes("התמורה"), false);
  assert.equal(plan.data.customBodyHtml.includes("18%"), false);
});

test("a title-only edit leaves the body byte-identical", () => {
  const plan = planQuoteEdit(draft, { projectTitle: "לוגו — גרסה 2" });
  assert.equal(plan.kind, "apply");
  if (plan.kind !== "apply") return;
  assert.equal(plan.data.projectTitle, "לוגו — גרסה 2");
  assert.equal(plan.data.customBodyHtml, draft.customBodyHtml);
});

test("an untouched field is not written back — a partial patch stays partial", () => {
  const plan = planQuoteEdit(draft, { customerName: "דנה כהן" });
  assert.equal(plan.kind, "apply");
  if (plan.kind !== "apply") return;
  assert.equal(plan.data.customerName, "דנה כהן");
  assert.equal("oneTimeFee" in plan.data, false);
  assert.equal("email" in plan.data, false);
  // Rendering inputs still merge from the existing row.
  assert.equal(plan.render.email, "d@x.com");
  assert.equal(plan.render.oneTimeFee, 2000);
});

test("business name and id number can be cleared with null, not just replaced", () => {
  const plan = planQuoteEdit({ ...draft, businessName: "דנה בע״מ" }, { businessName: null });
  assert.equal(plan.kind, "apply");
  if (plan.kind !== "apply") return;
  assert.equal(plan.data.businessName, null);
  assert.equal(plan.render.businessName, undefined);
});
