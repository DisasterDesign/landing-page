export class ProductPriceError extends Error {
  constructor(message: string, public readonly status: 400 | 403 | 404 | 409 = 400) { super(message); }
}

export interface PriceSnapshot {
  monthlyAmount: number | null;
  monthlyOriginalAmount: number | null;
  monthlyOriginalCurrency: string | null;
}

function isAmount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 &&
    Number.isSafeInteger(Math.round(value * 100)) && Math.abs(value * 100 - Math.round(value * 100)) < 1e-7;
}

export function priceText(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 1000) throw new ProductPriceError(label);
  return value.trim();
}

export function readPriceSnapshot(value: unknown): PriceSnapshot {
  if (!value || typeof value !== 'object') throw new ProductPriceError('Invalid price snapshot');
  const row = value as Record<string, unknown>;
  const { monthlyAmount, monthlyOriginalAmount, monthlyOriginalCurrency } = row;
  // Legacy editors allowed fractional cents (and negative entries). Preserve
  // their finite before-values exactly so correcting them never erases history.
  if (monthlyAmount !== null && (typeof monthlyAmount !== 'number' || !Number.isFinite(monthlyAmount))) throw new ProductPriceError('Invalid ILS valuation');
  if (monthlyOriginalAmount === null && monthlyOriginalCurrency === null) {
    return { monthlyAmount: monthlyAmount as number | null, monthlyOriginalAmount: null, monthlyOriginalCurrency: null };
  }
  if (!isAmount(monthlyOriginalAmount) || !['ILS', 'USD'].includes(String(monthlyOriginalCurrency)) ||
      (monthlyOriginalCurrency === 'USD' ? monthlyAmount !== null : monthlyAmount !== monthlyOriginalAmount)) {
    throw new ProductPriceError('Invalid original-currency price');
  }
  return { monthlyAmount: monthlyAmount as number | null, monthlyOriginalAmount, monthlyOriginalCurrency: monthlyOriginalCurrency as string };
}

export function planPriceCorrection(existing: PriceSnapshot, input: Record<string, unknown>) {
  const before = readPriceSnapshot(existing);
  const reason = priceText(input.reason, 'נדרשת סיבת תיקון');
  const source = priceText(input.source, 'נדרש מקור למחיר');
  if (!isAmount(input.amount) || (input.currency !== 'ILS' && input.currency !== 'USD')) throw new ProductPriceError('סכום או מטבע לא תקינים');
  const after: PriceSnapshot = {
    monthlyAmount: input.currency === 'ILS' ? input.amount : null,
    monthlyOriginalAmount: input.amount,
    monthlyOriginalCurrency: input.currency,
  };
  return { before, after, reason, source };
}
