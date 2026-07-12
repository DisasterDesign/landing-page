// Shared finance helpers — currency normalization + expense math.
// Rates are deliberately simple constants: USD rate is empirical from actual
// card charges incl. FX fees (Resend $20 → ₪58.57–62.08). Update here when
// the shekel moves meaningfully; the board labels amounts as approximate.
export const USD_TO_ILS = 3.1;
export const EUR_TO_ILS = 3.65;

export const VAT_RATE = 18;
export const CARDCOM_FEE_RATE = 0.02;

export function toIls(amount: number, currency: string): number {
  switch (currency) {
    case "USD":
      return amount * USD_TO_ILS;
    case "EUR":
      return amount * EUR_TO_ILS;
    default:
      return amount;
  }
}

// Normalize an expense to its monthly ILS cost. ONE_TIME expenses don't
// enter the monthly run-rate (they're listed separately on the board).
export function monthlyIls(exp: {
  amount: number;
  currency: string;
  frequency: string;
}): number {
  const ils = toIls(exp.amount, exp.currency);
  if (exp.frequency === "YEARLY") return ils / 12;
  if (exp.frequency === "ONE_TIME") return 0;
  return ils;
}

// One-off job money breakdown.
// - amount is NET (pre-VAT) by default; the client pays gross = net + 18% VAT.
// - net IS the profit basis (VAT is passed through to the government).
// - `gross` = what the client actually owes / transfers (the outstanding figure).
// - Cardcom fee applies only when the job is charged through Cardcom.
export function jobFinance(job: {
  amount: number;
  vatIncluded: boolean;
  cardcomFee: boolean;
}): { gross: number; net: number; vat: number; fee: number; profit: number } {
  const factor = 1 + VAT_RATE / 100;
  const gross = job.vatIncluded ? job.amount : job.amount * factor;
  const net = job.vatIncluded ? job.amount / factor : job.amount;
  const fee = job.cardcomFee ? gross * CARDCOM_FEE_RATE : 0;
  const profit = net - fee;
  return { gross, net, vat: gross - net, fee, profit };
}

// שוטף+N: an invoice for a job closed in month M is due N days after the END
// of month M. Returns the expected payment date.
export function expectedPaymentDate(closedAt: Date, termsDays: number): Date {
  const endOfMonth = new Date(closedAt.getFullYear(), closedAt.getMonth() + 1, 0);
  return new Date(endOfMonth.getTime() + termsDays * 24 * 60 * 60 * 1000);
}

export const CATEGORY_LABELS: Record<string, string> = {
  LLM_API: "מודלי AI (API)",
  SERVERS: "שרתים",
  HOSTING: "אחסון (Hosting)",
  DOMAINS: "דומיינים",
  SAAS: "תוכנות וכלים",
  PAYMENTS: "סליקה",
  ADVERTISING: "פרסום",
  PROFESSIONAL: "שירותים מקצועיים",
  OTHER: "אחר",
};

export const FREQUENCY_LABELS: Record<string, string> = {
  MONTHLY: "חודשי",
  YEARLY: "שנתי",
  ONE_TIME: "חד-פעמי",
};
