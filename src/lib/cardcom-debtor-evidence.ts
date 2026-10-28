import type { FailedTransaction } from "./cardcom";
import type { DebtorSnapshotEntry } from "./cardcom-debtors";

export interface DebtorPaymentEvidence {
  at: string;
  amount: number;
  currency: string;
  accountId: number | null;
  recurringId: number | null;
}

export interface DebtorObligation {
  amount: number;
  currency: string;
  amountILS: number | null;
  accountId: number | null;
  recurringId: number | null;
  lastAttempt: string;
  attempts: number;
  chronologyStatus: "valid" | "ambiguous" | "invalid";
  settledAt?: string;
  settledAmount?: number;
  settlementEvidence: "verified" | "unverified";
  matchedLaterPayment?: DebtorPaymentEvidence;
}

/** Old snapshots recorded a payer-level payment, which is not settlement proof. */
export function isVerifiedSettlement(row: Pick<DebtorSnapshotEntry, "settledAt" | "settlementEvidence">): boolean {
  return row.settlementEvidence === "verified" && validTime(row.settledAt) !== null;
}

/** Missing legacy currency or ambiguous obligations must never become ILS. */
export function debtorIlsAmount(row: DebtorSnapshotEntry): number | null {
  if (row.coverageStatus === "outside_window" || row.chronologyStatus === "ambiguous" || row.chronologyStatus === "invalid" || (row.obligations?.length ?? 0) > 1) return null;
  if (row.currency === "ILS" && Number.isFinite(row.amount) && row.amount >= 0) return row.amount;
  return typeof row.amountILS === "number" && Number.isFinite(row.amountILS) && row.amountILS >= 0 ? row.amountILS : null;
}

function validTime(value: string | undefined): number | null {
  // Validate real calendar dates. Local provider clocks are compared only
  // against other local provider clocks; UTC here is an ordering coordinate.
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/);
  if (!match) return null;
  const [, year, month, day, hour, minute, second] = match.map(Number);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day || hour > 23 || minute > 59 || second > 59) return null;
  const result = Date.parse(clockOf(value!) === "source_local" ? `${value}Z` : value!);
  return Number.isFinite(result) ? result : null;
}

function clockOf(value: string): "source_local" | "absolute" {
  return /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? "absolute" : "source_local";
}

function isLater(candidate: FailedTransaction, failure: FailedTransaction): boolean {
  const at = validTime(candidate.CreateDate);
  const after = validTime(failure.CreateDate);
  return at !== null && after !== null && clockOf(candidate.CreateDate) === clockOf(failure.CreateDate) && at > after;
}

function currencyOf(row: FailedTransaction): string {
  const codes: Record<number, string> = { 1: "ILS", 2: "USD", 376: "ILS", 840: "USD", 978: "EUR" };
  const sources = [row.Currency?.trim().toUpperCase(), row.CoinId == null ? undefined : codes[row.CoinId] ?? "UNKNOWN", row.ISOCoinId == null ? undefined : codes[row.ISOCoinId] ?? "UNKNOWN"].filter((x): x is string => !!x);
  return sources.length && sources.every((x) => x === sources[0]) ? sources[0] : "UNKNOWN";
}

function identifier(value: number | undefined): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function payerKey(row: FailedTransaction): string {
  return row.CardOwnerIdentityNumber || row.CardOwnerName || `tx-${row.TranzactionId}`;
}

function paymentEvidence(row: FailedTransaction): DebtorPaymentEvidence {
  return { at: row.CreateDate, amount: row.Amount, currency: currencyOf(row), accountId: identifier(row.AccountId), recurringId: identifier(row.RecurringId) };
}

function sameObligation(failure: FailedTransaction, payment: FailedTransaction): boolean {
  const account = identifier(failure.AccountId);
  const recurring = identifier(failure.RecurringId);
  if (account === null && recurring === null) return false;
  if (account !== null && account !== identifier(payment.AccountId)) return false;
  if (recurring !== null && recurring !== identifier(payment.RecurringId)) return false;
  return currencyOf(failure) !== "UNKNOWN" && currencyOf(failure) === currencyOf(payment)
    && Number.isFinite(failure.Amount) && failure.Amount > 0 && Math.round(failure.Amount * 100) === Math.round(payment.Amount * 100);
}

function latestFirst(a: FailedTransaction, b: FailedTransaction): number {
  return (validTime(b.CreateDate) ?? -Infinity) - (validTime(a.CreateDate) ?? -Infinity)
    || b.Amount - a.Amount || b.TranzactionId - a.TranzactionId;
}

function describeObligation(rows: FailedTransaction[], payments: FailedTransaction[]): DebtorObligation {
  const ordered = [...rows].sort(latestFirst);
  const latest = ordered[0];
  const time = validTime(latest.CreateDate);
  const status = rows.some((x) => validTime(x.CreateDate) === null) ? "invalid"
    : rows.some((x) => clockOf(x.CreateDate) !== clockOf(latest.CreateDate)) ? "ambiguous"
    : rows.some((x) => validTime(x.CreateDate) === time && x.Amount !== latest.Amount) ? "ambiguous" : "valid";
  const currency = currencyOf(latest);
  const valuation = currency === "ILS" ? latest.Amount : latest.AmountILS ?? latest.AmountInILS;
  const matched = status === "valid" && latest.CardOwnerIdentityNumber ? payments.find((x) => isLater(x, latest) && sameObligation(latest, x)) : undefined;
  return {
    amount: latest.Amount, currency,
    amountILS: status === "valid" && typeof valuation === "number" && Number.isFinite(valuation) && valuation >= 0 ? valuation : null,
    accountId: identifier(latest.AccountId), recurringId: identifier(latest.RecurringId),
    lastAttempt: latest.CreateDate, attempts: rows.length, chronologyStatus: status,
    // A matching recurring payment may be the following billing period.
    settlementEvidence: "unverified",
    ...(matched ? { matchedLaterPayment: paymentEvidence(matched) } : {}),
  };
}

/** Pure evidence reduction; payer keys remain stable for historical dismissals. */
export function buildDebtorSnapshot(failures: FailedTransaction[], successes: FailedTransaction[], previous: Record<string, DebtorSnapshotEntry>): Record<string, DebtorSnapshotEntry> {
  const byPayer = new Map<string, FailedTransaction[]>();
  for (const row of failures) {
    if (row.DealType && row.DealType !== "Debit") continue;
    const key = payerKey(row);
    byPayer.set(key, [...(byPayer.get(key) ?? []), row]);
  }
  const snapshot: Record<string, DebtorSnapshotEntry> = {};
  for (const [key, rows] of byPayer) {
    const latest = [...rows].sort(latestFirst)[0];
    const payments = successes.filter((x) => payerKey(x) === key && (!x.DealType || x.DealType === "Debit") && x.ResponseCode === 0).sort(latestFirst);
    const groups = new Map<string, FailedTransaction[]>();
    for (const row of rows) {
      const identity = JSON.stringify([identifier(row.AccountId), identifier(row.RecurringId), currencyOf(row)]);
      groups.set(identity, [...(groups.get(identity) ?? []), row]);
    }
    const obligations = [...groups.values()].map((group) => describeObligation(group, payments));
    const representative = obligations.find((x) => x.lastAttempt === latest.CreateDate && x.amount === latest.Amount
      && x.accountId === identifier(latest.AccountId) && x.recurringId === identifier(latest.RecurringId) && x.currency === currencyOf(latest))!;
    const tiedObligations = rows.some((x) => validTime(x.CreateDate) === validTime(latest.CreateDate)
      && (x.Amount !== latest.Amount || identifier(x.AccountId) !== identifier(latest.AccountId)
        || identifier(x.RecurringId) !== identifier(latest.RecurringId) || currencyOf(x) !== currencyOf(latest)));
    const chronologyStatus = obligations.some((x) => x.chronologyStatus === "invalid") ? "invalid"
      : tiedObligations || rows.some((x) => clockOf(x.CreateDate) !== clockOf(latest.CreateDate))
        || obligations.some((x) => x.chronologyStatus === "ambiguous") ? "ambiguous" : "valid";
    const later = payments.find((x) => isLater(x, latest));
    const matched = obligations.length === 1 ? representative.matchedLaterPayment : undefined;
    snapshot[key] = {
      name: latest.CardOwnerName || key, idNumber: latest.CardOwnerIdentityNumber ?? null,
      amount: representative.amount, attempts: rows.length, lastAttempt: latest.CreateDate,
      responseCode: latest.ResponseCode, reason: latest.IssuerAuthCodeDescription || latest.Description || "",
      currency: representative.currency, amountILS: obligations.length === 1 ? representative.amountILS : null,
      accountId: representative.accountId, recurringId: representative.recurringId,
      obligations, chronologyStatus, coverageStatus: "in_window", settlementEvidence: "unverified",
      ...(later ? { laterPayment: paymentEvidence(later) } : {}),
      ...(matched ? { matchedLaterPayment: matched } : {}),
    };
  }
  for (const [key, row] of Object.entries(previous)) {
    if (Object.hasOwn(snapshot, key)) continue;
    snapshot[key] = { ...row, currency: row.currency ?? "UNKNOWN", amountILS: null, coverageStatus: "outside_window", settlementEvidence: isVerifiedSettlement(row) ? "verified" : "unverified" };
  }
  return snapshot;
}
