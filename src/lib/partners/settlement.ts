/**
 * The Elad↔Roy monthly settlement, under the 12.8.2026 full-partnership model:
 *
 *   profit  = Fuzion net revenue (after VAT + Cardcom) − SHARED expenses
 *   each partner is entitled to profit / 2
 *
 * All revenue lands in Elad's account (the Cardcom terminal is his), so the
 * transfer to Roy is his half of the profit PLUS the shared expenses he paid
 * out of his own pocket — that reimbursement is what makes both sides end the
 * month holding exactly profit/2, which settlement.test.ts proves.
 *
 * Elad's personal book stays entirely out on BOTH sides: its revenue never
 * reaches `fuzionNetRevenue` (books.ts), and its expenses arrive here with
 * shared=false and are excluded — otherwise Roy would be funding the private
 * book he earns nothing from.
 */

import { USD_TO_ILS, EUR_TO_ILS } from "@/lib/finance";

export interface SettlementExpense {
  amountIls: number;
  paidBy: "owner" | "partner";
  /** false = tied to the personal book; the split never touches it. */
  shared: boolean;
}

export interface Settlement {
  sharedExpenses: number;
  personalExpenses: number;
  profit: number;
  royEntitlement: number;
  /** Negative means Roy owes money into the pot that month. */
  transferToRoy: number;
}

export function computeSettlement(input: {
  fuzionNetRevenue: number;
  expenses: SettlementExpense[];
}): Settlement {
  let shared = 0;
  let personal = 0;
  let partnerPaidShared = 0;

  for (const e of input.expenses) {
    if (e.shared) {
      shared += e.amountIls;
      if (e.paidBy === "partner") partnerPaidShared += e.amountIls;
    } else {
      // A non-shared expense the partner somehow paid is deliberately NOT
      // reimbursed here — the split must never quietly refund the private
      // book. Settle such cases by hand.
      personal += e.amountIls;
    }
  }

  const profit = input.fuzionNetRevenue - shared;
  const royEntitlement = profit / 2;

  return {
    sharedExpenses: shared,
    personalExpenses: personal,
    profit,
    royEntitlement,
    transferToRoy: royEntitlement + partnerPaidShared,
  };
}

/**
 * Normalises an Expense row to monthly shekels for the settlement.
 *
 * ONE_TIME is deliberately zero: a one-off purchase is settled by hand in the
 * month it happens — folding it into the recurring figure would re-charge it
 * every month forever.
 */
export function monthlyIlsOf(e: {
  amount: number;
  currency: string;
  frequency: string;
}): number {
  if (e.frequency === "ONE_TIME") return 0;
  const ils =
    e.currency === "USD"
      ? e.amount * USD_TO_ILS
      : e.currency === "EUR"
        ? e.amount * EUR_TO_ILS
        : e.amount;
  return e.frequency === "YEARLY" ? ils / 12 : ils;
}
