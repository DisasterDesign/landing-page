/**
 * Israeli VAT helpers. The studio enters all prices NET in the system
 * (matches the way contracts are written: "X ₪ + מע״מ כחוק"); whenever
 * an amount leaves the system to a payment provider we send the GROSS
 * value computed from this helper. Bump VAT_RATE here and every call site
 * picks up the new value on the next request.
 */
export const VAT_RATE = 18;
export const VAT_MULTIPLIER = 1 + VAT_RATE / 100;

export function withVat(net: number): number {
  return Math.round(net * VAT_MULTIPLIER * 100) / 100;
}
