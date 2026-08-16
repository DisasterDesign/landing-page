import assert from "node:assert/strict";
import test from "node:test";

import {
  isOneTime,
  shouldProvisionClient,
  shouldCreateRecurringOrder,
  quoteJobInput,
  scopeToHtml,
} from "./one-time";

const subscription = {
  kind: "SUBSCRIPTION" as const,
  monthlyPrice: 599,
  cardcomRecurringId: null,
};
const quote = {
  kind: "ONE_TIME" as const,
  monthlyPrice: 0,
  cardcomRecurringId: null,
};

test("a one-time agreement is recognised by kind, not by price", () => {
  assert.equal(isOneTime(quote), true);
  assert.equal(isOneTime(subscription), false);
  // A subscription that happens to be free is still a subscription — kind is
  // the only discriminator, so a future ₪0 promo month cannot silently turn
  // a real client into a one-off.
  assert.equal(isOneTime({ kind: "SUBSCRIPTION" }), false);
});

test("GUARD: signing a one-time quote must never provision a Client", () => {
  assert.equal(shouldProvisionClient(quote), false);
  assert.equal(shouldProvisionClient(subscription), true);
});

test("GUARD: a one-time quote must never create a recurring order", () => {
  // This is the dangerous one. If it ever returns true, a customer who bought
  // a logo once gets billed every month.
  assert.equal(
    shouldCreateRecurringOrder({ ...quote, lowProfileId: "lp-1" }),
    false,
  );
  // Even if someone sets a monthly price on a ONE_TIME row by mistake.
  assert.equal(
    shouldCreateRecurringOrder({
      ...quote,
      monthlyPrice: 599,
      lowProfileId: "lp-1",
    }),
    false,
  );
});

test("a subscription still creates its recurring order under the existing conditions", () => {
  assert.equal(
    shouldCreateRecurringOrder({ ...subscription, lowProfileId: "lp-1" }),
    true,
  );
  // No LowProfile GUID — nothing to register against.
  assert.equal(
    shouldCreateRecurringOrder({ ...subscription, lowProfileId: null }),
    false,
  );
  // Free tier: nothing recurring to charge.
  assert.equal(
    shouldCreateRecurringOrder({
      ...subscription,
      monthlyPrice: 0,
      lowProfileId: "lp-1",
    }),
    false,
  );
  // Already registered — must stay idempotent.
  assert.equal(
    shouldCreateRecurringOrder({
      ...subscription,
      cardcomRecurringId: 42,
      lowProfileId: "lp-1",
    }),
    false,
  );
});

test("a quote maps onto the jobs table as an immediate, Cardcom-fee row", () => {
  const signedAt = new Date("2026-08-10T09:00:00Z");
  const paidAt = new Date("2026-08-10T09:04:00Z");
  const row = quoteJobInput({
    id: "ag-1",
    projectTitle: "עיצוב לוגו ומיתוג",
    customerName: "ישראל ישראלי",
    businessName: "ישראלי בע״מ",
    oneTimeFee: 3500,
    signedAt,
    paidAt,
    createdAt: new Date("2026-08-01T00:00:00Z"),
  });

  assert.equal(row.source, "quote");
  assert.equal(row.title, "עיצוב לוגו ומיתוג");
  // Business name wins — that is what appears on the invoice.
  assert.equal(row.customer.name, "ישראלי בע״מ");
  assert.equal(row.customer.clientId, null);
  assert.equal(row.amount, 3500);
  // oneTimeFee is stored net, like every other price in the system.
  assert.equal(row.vatIncluded, false);
  // Paid through Cardcom, so the 2% comes off.
  assert.equal(row.cardcomFee, true);
  // Paid on the spot — שוטף+0, so it can never read as overdue.
  assert.equal(row.paymentTermsDays, 0);
  assert.equal(row.status, "PAID");
  assert.equal(row.closedAt.getTime(), signedAt.getTime());
});

test("an unpaid quote is PENDING and dated by signature, falling back to creation", () => {
  const createdAt = new Date("2026-08-01T00:00:00Z");
  const unsigned = quoteJobInput({
    id: "ag-2",
    projectTitle: "בניית דף נחיתה",
    customerName: "דנה כהן",
    businessName: null,
    oneTimeFee: 1200,
    signedAt: null,
    paidAt: null,
    createdAt,
  });
  assert.equal(unsigned.status, "PENDING");
  assert.equal(unsigned.paidAt, null);
  // No business name — fall back to the person.
  assert.equal(unsigned.customer.name, "דנה כהן");
  assert.equal(unsigned.closedAt.getTime(), createdAt.getTime());
});

test("a quote with no fee recorded is treated as zero, not NaN", () => {
  const row = quoteJobInput({
    id: "ag-3",
    projectTitle: "ייעוץ",
    customerName: "א",
    businessName: null,
    oneTimeFee: null,
    signedAt: null,
    paidAt: null,
    createdAt: new Date("2026-08-01T00:00:00Z"),
  });
  assert.equal(row.amount, 0);
});

test("the scope of work is escaped before it becomes the legal document", () => {
  // This string is interpolated into the agreement HTML that the customer
  // signs and that is stored as the legal record. Markup must not survive.
  const html = scopeToHtml('<script>alert("x")</script> & <b>bold</b>');
  assert.equal(html.includes("<script>"), false);
  assert.equal(html.includes("<b>"), false);
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("&amp;"));
});

test("blank lines become paragraphs and single newlines become breaks", () => {
  const html = scopeToHtml("שלב א\nשלב ב\n\nתנאים");
  assert.equal(html, "<p>שלב א<br/>שלב ב</p>\n<p>תנאים</p>");
});

test("a one-line scope is still a paragraph", () => {
  assert.equal(scopeToHtml("עיצוב לוגו"), "<p>עיצוב לוגו</p>");
});

// ---- Foreign one-time quote: the same guards must hold with vatExempt + en ----

test("GUARD: a foreign (en, VAT-exempt) quote still never provisions a Client", () => {
  assert.equal(shouldProvisionClient({ kind: "ONE_TIME" }), false);
});

test("GUARD: a foreign quote paid through Cardcom never creates a recurring order", () => {
  // The recurring gate keys on kind + monthlyPrice; locale and VAT status
  // must not be able to reopen it.
  assert.equal(
    shouldCreateRecurringOrder({
      kind: "ONE_TIME",
      monthlyPrice: 0,
      cardcomRecurringId: null,
      lowProfileId: "lp-foreign",
    }),
    false,
  );
});

test("a VAT-exempt quote reports its fee as the gross — no 18% is added on top", () => {
  // jobFinance grosses up any row with vatIncluded=false. A foreign quote is
  // charged exactly its fee, so it must present as VAT-inclusive-at-zero or
  // the jobs table shows ₪2,360 for a ₪2,000 job and the settlement over-counts.
  const row = quoteJobInput({
    id: "ag-f",
    projectTitle: "Landing page",
    customerName: "Acme Ltd",
    businessName: null,
    oneTimeFee: 2000,
    signedAt: null,
    paidAt: null,
    createdAt: new Date("2026-08-16T00:00:00Z"),
    vatExempt: true,
  });
  assert.equal(row.vatIncluded, true);
  assert.equal(row.amount, 2000);
});

test("a domestic quote still grosses up — vatIncluded stays false", () => {
  const row = quoteJobInput({
    id: "ag-d",
    projectTitle: "לוגו",
    customerName: "א",
    businessName: null,
    oneTimeFee: 2000,
    signedAt: null,
    paidAt: null,
    createdAt: new Date("2026-08-16T00:00:00Z"),
    vatExempt: false,
  });
  assert.equal(row.vatIncluded, false);
});
