import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  renderAgreement,
  DEFAULT_OWNERSHIP_MONTHS,
  type AgreementData,
} from "@/lib/agreement-templates";
import { createAgreementSchema } from "@/lib/validations";

/**
 * The ownership-transfer horizon ("after N consecutive months of active
 * subscription the website becomes the client's") was a literal 12 baked into
 * the Hebrew and English clauses. The business term is 18, and some deals
 * want another number — so it is a per-agreement field with an 18 default,
 * rendered into sections 4 and 5 of both languages.
 */

const base: AgreementData = {
  customerName: "דנה כהן",
  phone: "0501234567",
  email: "d@x.com",
  date: "17.9.2026",
  monthlyPrice: 599,
  tier: "BASIC",
};

test("the default ownership horizon is 18 months", () => {
  assert.equal(DEFAULT_OWNERSHIP_MONTHS, 18);
});

test("a Hebrew agreement renders 18 months in both the term and the ownership clause", () => {
  const html = renderAgreement("BASIC", base);
  const hits = html.match(/18 חודשים רצופים/g) ?? [];
  // Section 4 mentions it once, section 5 twice.
  assert.ok(hits.length >= 3, `expected the 18-month wording in sections 4 and 5, got ${hits.length}`);
  assert.equal(/12 חודשים/.test(html), false, "the old 12-month wording must be gone");
});

test("an English agreement renders 18 consecutive months", () => {
  const html = renderAgreement("BASIC", { ...base, locale: "en", vatExempt: true });
  assert.ok((html.match(/18 consecutive months/g) ?? []).length >= 3);
  assert.equal(/12 consecutive months/.test(html), false);
});

test("a per-agreement horizon overrides the default in both languages", () => {
  const he = renderAgreement("BASIC", { ...base, ownershipMonths: 24 });
  assert.ok((he.match(/24 חודשים רצופים/g) ?? []).length >= 3);
  assert.equal(/18 חודשים/.test(he), false);

  const en = renderAgreement("BASIC", { ...base, locale: "en", ownershipMonths: 24 });
  assert.ok((en.match(/24 consecutive months/g) ?? []).length >= 3);
  assert.equal(/18 consecutive months/.test(en), false);
});

test("GUARD: no hardcoded ownership horizon survives in the template source", () => {
  const src = readFileSync(join(process.cwd(), "src/lib/agreement-templates.ts"), "utf8");
  assert.equal(/1[28] חודשים רצופים/.test(src), false, "Hebrew clause hardcodes the month count");
  assert.equal(/1[28] consecutive months/.test(src), false, "English clause hardcodes the month count");
});

// ---- creation input ----

const valid = {
  tier: "BASIC",
  monthlyPrice: 599,
  customerName: "דנה כהן",
  phone: "0501234567",
  email: "d@x.com",
};

test("creation defaults the horizon to 18 when the form does not send one", () => {
  assert.equal(createAgreementSchema.parse(valid).ownershipMonths, 18);
});

test("creation accepts another whole number of months", () => {
  assert.equal(createAgreementSchema.parse({ ...valid, ownershipMonths: 24 }).ownershipMonths, 24);
  assert.equal(createAgreementSchema.parse({ ...valid, ownershipMonths: 6 }).ownershipMonths, 6);
});

test("creation rejects a horizon that cannot appear in a contract", () => {
  for (const bad of [0, -3, 2.5, 61, "18"]) {
    assert.throws(
      () => createAgreementSchema.parse({ ...valid, ownershipMonths: bad }),
      `ownershipMonths=${JSON.stringify(bad)} should be rejected`,
    );
  }
});
