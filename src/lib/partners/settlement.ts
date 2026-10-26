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

import { roundMinor } from '@/lib/finance/report';
import { USD_TO_ILS, EUR_TO_ILS } from "@/lib/finance";

export interface SettlementExpense {
  amountIls: number;
  paidBy: "owner" | "partner";
  /** false = tied to the personal book; the split never touches it. */
  shared: boolean;
  sharedBasisPoints?: number | null;
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
    const total=Math.round(e.amountIls*100);
    const bps=e.sharedBasisPoints??(e.shared?10000:0);
    if(!Number.isInteger(bps)||bps<0||bps>10000)throw new Error('Invalid shared allocation');
    const allocated=roundMinor(total*bps/10000);
    shared+=allocated; personal+=total-allocated;
    if(e.paidBy==='partner')partnerPaidShared+=allocated;
  }
  shared/=100;personal/=100;partnerPaidShared/=100;

  const profit = Math.round(input.fuzionNetRevenue*100 - shared*100)/100;
  const royEntitlement = Math.trunc(profit*100/2)/100;

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
