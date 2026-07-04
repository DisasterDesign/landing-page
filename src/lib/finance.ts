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
