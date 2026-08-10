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
    // Every price in the system is stored net of VAT.
    vatIncluded: false,
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
