/**
 * What the public /agreement/[token] page shows once the agreement is signed.
 *
 * The signed state used to be one static card ("signed, download the PDF").
 * That hid the payment step: a customer who signed and then abandoned or
 * failed the Cardcom page (7.10.2026, Cardcom 5119 "pending or not
 * completed") had no way back to it — the only route to a fresh payment link
 * is POST /api/agreements/sign/[token]/payment, and nothing on the page called
 * it. Pure so the page's branching is pinned by signed-view.test.ts.
 */
export type SignedAgreementView = "resume-payment" | "paid" | "nothing-to-pay";

export function signedAgreementView(a: {
  status: string;
  paymentStatus: string;
  monthlyPrice: number;
  oneTimeFee: number | null;
}): SignedAgreementView | null {
  if (a.status !== "SIGNED") return null;
  if (a.paymentStatus === "COMPLETED") return "paid";
  const owes = (a.monthlyPrice ?? 0) > 0 || (a.oneTimeFee ?? 0) > 0;
  return owes ? "resume-payment" : "nothing-to-pay";
}
