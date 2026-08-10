import assert from "node:assert/strict";
import test from "node:test";

import { renderAgreement } from "@/lib/agreement-templates";
import { quoteBodyHtml } from "./one-time";

/**
 * The sign page renders `agreement.content`. renderAgreement runs again at
 * signing, but the DRAFT is what the customer opens from the link — so a quote
 * created with an empty content field showed a blank white document. These
 * tests pin the document that gets stored at creation.
 */
function renderQuote(scope: string, fee = 1) {
  return renderAgreement(null, {
    customerName: "בדיקה",
    businessName: undefined,
    idNumber: undefined,
    phone: "0501234567",
    email: "t@example.com",
    monthlyPrice: 0,
    oneTimeFee: fee,
    tier: null,
    additionalServices: [],
    date: "10.8.2026",
    locale: "he",
    vatExempt: false,
    customBodyHtml: quoteBodyHtml({ scope, oneTimeFee: fee, vatExempt: false, locale: "he" }),
  });
}

test("the stored document is not empty and carries the scope of work", () => {
  const html = renderQuote("עיצוב לוגו בשלוש גרסאות");
  assert.ok(html.length > 200, "document should not be a blank shell");
  assert.ok(html.includes("עיצוב לוגו בשלוש גרסאות"));
});

test("the customer's name and the fee appear in the document", () => {
  const html = renderQuote("עבודה", 3500);
  assert.ok(html.includes("בדיקה"));
  assert.ok(/3[,.]?500/.test(html), "the fee must be visible to the signer");
});

test("the document says in words that there is no recurring charge", () => {
  const html = renderQuote("עבודה חד-פעמית");
  // The signer's real question. It must be answered on the page, not implied
  // by the absence of a monthly figure.
  assert.ok(html.includes("אין מנוי חודשי ואין חיוב חוזר"));
  // And it must not carry the subscription template's monthly payment line.
  assert.equal(/תשלום חודשי/.test(html), false);
});

test("markup in the scope stays inert in the rendered document", () => {
  const html = renderQuote("<img src=x onerror=alert(1)>");
  // The document legitimately contains <img> for the logo and the signature,
  // and the word "onerror" survives as inert text — that is fine. What must
  // not survive is the payload as an actual tag.
  assert.equal(html.includes("<img src=x"), false);
  assert.ok(html.includes("&lt;img src=x onerror=alert(1)&gt;"));
});

test("the document states the total the customer will actually be charged", () => {
  // ₪3,500 net at 18% VAT = ₪4,130 gross. A signer must see what leaves their
  // card, not only the pre-VAT figure the studio quotes internally.
  const html = renderQuote("עבודה", 3500);
  assert.ok(/4[,.]?130/.test(html), "gross total must appear");
});

test("a VAT-exempt quote shows no VAT line", () => {
  const html = renderAgreement(null, {
    customerName: "Foreign Ltd", businessName: undefined, idNumber: undefined,
    phone: "0501234567", email: "t@example.com",
    monthlyPrice: 0, oneTimeFee: 1000, tier: null, additionalServices: [],
    date: "10.8.2026", locale: "en", vatExempt: true,
    customBodyHtml: quoteBodyHtml({ scope: "work", oneTimeFee: 1000, vatExempt: true, locale: "en" }),
  });
  // "VAT" also appears as the "Company / VAT No." row label in the parties
  // table, so assert on the price line specifically.
  assert.equal(html.includes("VAT 18%"), false);
  assert.ok(html.includes("Total due"));
});
