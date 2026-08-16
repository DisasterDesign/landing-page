/**
 * One-time project quotes.
 *
 * A quote is an Agreement with `kind = ONE_TIME`: it is signed and paid
 * through exactly the same Cardcom machinery as a subscription, but it never
 * provisions a Client, never registers a BillGold recurring order, and never
 * reaches MRR or the partner report.
 *
 * The predicates live here as pure functions rather than inline conditions in
 * the sign route and the payment webhook, because both of them sit on the
 * money path and neither was testable in place. Spec:
 * docs/superpowers/specs/2026-08-10-one-time-project-quotes-design.md
 */

export type AgreementKind = "SUBSCRIPTION" | "ONE_TIME";

/**
 * Kind is the ONLY discriminator. Deliberately not derived from a zero
 * monthly price: a free or promotional month on a real subscription must not
 * make it look like a one-off and skip client provisioning.
 */
export function isOneTime(a: { kind: AgreementKind }): boolean {
  return a.kind === "ONE_TIME";
}

/** Signing provisions a Client for subscriptions only. */
export function shouldProvisionClient(a: { kind: AgreementKind }): boolean {
  return !isOneTime(a);
}

/**
 * The BillGold gate, lifted out of the payment webhook.
 *
 * The pre-existing conditions (a LowProfile GUID to register against, a
 * non-zero monthly price, and no recurring order yet) already made a
 * `monthlyPrice = 0` quote safe. The explicit `kind` check is belt-and-braces
 * on the one failure that would actually cost a customer money: being charged
 * every month for something they bought once.
 */
export function shouldCreateRecurringOrder(a: {
  kind: AgreementKind;
  monthlyPrice: number;
  cardcomRecurringId: number | null;
  lowProfileId: string | null;
}): boolean {
  if (isOneTime(a)) return false;
  return Boolean(a.lowProfileId) && a.monthlyPrice > 0 && !a.cardcomRecurringId;
}

/**
 * Projects a quote onto the shape `/admin/jobs` renders, so paid one-offs and
 * `ClientJob` rows for existing clients can share one table and one money
 * calculation (`jobFinance`).
 */
export function quoteJobInput(a: {
  id: string;
  projectTitle: string | null;
  customerName: string;
  businessName: string | null;
  oneTimeFee: number | null;
  signedAt: Date | null;
  paidAt: Date | null;
  createdAt: Date;
  /** Foreign client, zero-rated VAT — the fee IS the gross. */
  vatExempt?: boolean;
}): {
  source: "quote";
  id: string;
  title: string;
  customer: { name: string; clientId: null; number: null };
  amount: number;
  vatIncluded: boolean;
  cardcomFee: boolean;
  paymentTermsDays: number;
  status: "PENDING" | "PAID";
  closedAt: Date;
  paidAt: Date | null;
} {
  return {
    source: "quote",
    id: a.id,
    title: a.projectTitle ?? "פרויקט חד-פעמי",
    customer: {
      // The business name is what appears on the invoice; fall back to the
      // person when the customer is not a registered business.
      name: a.businessName || a.customerName,
      clientId: null,
      number: null,
    },
    amount: a.oneTimeFee ?? 0,
    // Every price in the system is stored net of VAT, so jobFinance grosses
    // up by 18% — except a zero-rated foreign quote, where the fee is exactly
    // what the customer pays. Presenting it as "VAT included at zero" is what
    // stops the jobs table showing ₪2,360 for a ₪2,000 job.
    vatIncluded: a.vatExempt === true,
    // Always collected through Cardcom, so the ~2% always applies — unlike a
    // ClientJob, which may be settled by bank transfer.
    cardcomFee: true,
    // Paid on signature, so there are no payment terms and the row can never
    // be computed as overdue.
    paymentTermsDays: 0,
    status: a.paidAt ? "PAID" : "PENDING",
    // Signature is the billing event. Before signature the quote is still
    // outstanding, so it sorts by when it was drawn up.
    closedAt: a.signedAt ?? a.createdAt,
    paidAt: a.paidAt,
  };
}

/**
 * Turns the plain-text scope of work the owner typed into the paragraphs the
 * signed document renders.
 *
 * Escaped first, and that is the point: this string is interpolated into the
 * agreement HTML that the customer is shown and that is stored as the legal
 * record, so a stray `<` must never become markup.
 */
export function scopeToHtml(scope: string): string {
  const escaped = scope
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .split(/\n{2,}/)
    .map((para) => `<p>${para.replace(/\n/g, "<br/>")}</p>`)
    .join("\n");
}

/**
 * The legal body of a quote: the scope of work followed by a price box.
 *
 * The price box is not decoration. renderCustomAgreement renders the parties,
 * the supplied body and the signature block — it never renders an amount. The
 * Ormat proposal got away with that because its price was hand-written into
 * its body; a quote's body is free text the owner types, so without this the
 * customer could sign a document that never states what they are paying.
 *
 * Shows the gross total too: the studio quotes ex-VAT, but the signer needs to
 * see what actually leaves their card.
 */
export type QuoteLocale = "he" | "en";

export function quoteBodyHtml(input: {
  scope: string;
  oneTimeFee: number;
  vatExempt: boolean;
  locale: QuoteLocale;
}): string {
  const he = input.locale !== "en";
  const money = (n: number) =>
    `₪${n.toLocaleString(he ? "he-IL" : "en-GB", { maximumFractionDigits: 2 })}`;
  const vat = input.vatExempt ? 0 : input.oneTimeFee * 0.18;
  const gross = input.oneTimeFee + vat;

  const rows = [
    `<tr><th>${he ? "סכום העבודה" : "Project fee"}</th><td>${money(input.oneTimeFee)}</td></tr>`,
    input.vatExempt
      ? ""
      : `<tr><th>${he ? 'מע"מ 18%' : "VAT 18%"}</th><td>${money(vat)}</td></tr>`,
    `<tr><th>${he ? "סה״כ לתשלום" : "Total due"}</th><td><strong>${money(gross)}</strong></td></tr>`,
  ]
    .filter(Boolean)
    .join("\n  ");

  const terms = he
    ? "התשלום הוא חד-פעמי. אין מנוי חודשי ואין חיוב חוזר."
    : "This is a one-off payment. No subscription and no recurring charge.";

  return `${scopeToHtml(input.scope)}

<h2>${he ? "התמורה" : "Payment"}</h2>
<table class="parties">
  ${rows}
</table>
<p>${terms}</p>`;
}

/**
 * The inverse of scopeToHtml, for the edit form.
 *
 * The scope of work is stored only inside customBodyHtml, followed by the price
 * table quoteBodyHtml appends. Editing must show exactly what was typed, so
 * this cuts the body at the price heading, turns paragraphs back into blank
 * lines and <br/> back into newlines, and unescapes what scopeToHtml escaped.
 * Round-tripped by test against quoteBodyHtml.
 */
export function scopeFromBodyHtml(body: string | null | undefined): string {
  if (!body) return "";
  // Everything from the price heading onward is generated, not typed.
  const cut = body.search(/\n?<h2>(?:התמורה|Payment)<\/h2>/);
  const scopePart = cut >= 0 ? body.slice(0, cut) : body;

  const paragraphs = [...scopePart.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => m[1]);
  const text = (paragraphs.length ? paragraphs : [scopePart])
    .map((p) => p.replace(/<br\s*\/?>/g, "\n"))
    .join("\n\n");

  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}
