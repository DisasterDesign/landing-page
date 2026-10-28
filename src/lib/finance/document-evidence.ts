import type { FailedTransaction } from '@/lib/cardcom';
import type { Receipt } from './transactions';

/** Minimal accounting fields from v11 Documents/GetReport (InvHeadLineDto). */
export interface CardcomDocument {
    Terminal_Number: number;
    Invoice_Number: number;
    InvoiceType: number;
    CoinID: number;
    TotalIncludeVAT: number;
    TotalIncludeVATNIS: number;
    VATOnlyNIS: number;
    IsNegetive: boolean;
}

const cashDocumentTypes: Readonly<Record<string, number>> = {
    TaxInvoiceAndReceipt: 1, TaxInvoiceAndReceiptRefund: 2, Receipt: 3, ReceiptRefund: 4,
};
export function cardcomCashDocumentType(value: FailedTransaction['DocumentType']): number | null {
    if (typeof value === 'number') return [1, 2, 3, 4].includes(value) ? value : null;
    return value ? cashDocumentTypes[value] ?? null : null;
}
export function cardcomCurrency(coin: number | undefined): string | null {
    return ({ 1: 'ILS', 376: 'ILS', 2: 'USD', 840: 'USD', 978: 'EUR' } as Record<number, string>)[coin ?? 0] ?? null;
}
const incomplete = (): never => { throw new Error('Original Cardcom document evidence incomplete or conflicting; sync incomplete'); };
function monetaryMinor(value: unknown): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) return incomplete();
    const result = Math.round(Math.abs(value) * 100);
    if (!Number.isSafeInteger(result) || result > 2147483647) return incomplete();
    return result;
}

/** A successful provider transaction is the exact link to its numbered, typed document.
 * Never match by payer, account name, date proximity or a shared amount alone.
 * Type IDs: https://support.cardcom.solutions/hc/he/articles/360020548619
 * IDs 1–4 are documented cash receipts; other invoices/orders are not cash evidence.
 */
export function originalCardcomDocumentAmounts(row: FailedTransaction, receipt: Receipt, documents: readonly CardcomDocument[]) {
    const type = cardcomCashDocumentType(row.DocumentType);
    if (!Number.isSafeInteger(row.TranzactionId) || row.TranzactionId <= 0 || !type || !Number.isSafeInteger(Number(row.DocumentNumber)) || Number(row.DocumentNumber) <= 0) return incomplete();
    const currencies = [row.Currency?.trim().toUpperCase(), row.CoinId == null ? null : cardcomCurrency(row.CoinId), row.ISOCoinId == null ? null : cardcomCurrency(row.ISOCoinId)].filter(value => value != null);
    if (!currencies.length || currencies.some(currency => currency !== receipt.currency) || receipt.currency === 'UNKNOWN') return incomplete();
    if ((row.CoinId != null && !cardcomCurrency(row.CoinId)) || (row.ISOCoinId != null && !cardcomCurrency(row.ISOCoinId))) return incomplete();
    const candidates = documents.filter(doc => String(doc.Terminal_Number) === receipt.terminalId && String(doc.Invoice_Number) === receipt.invoiceNumber && doc.InvoiceType === type);
    if (candidates.length !== 1) return incomplete();
    const doc = candidates[0];
    const refund = receipt.kind === 'REFUND';
    if (cardcomCurrency(doc.CoinID) !== receipt.currency || typeof doc.IsNegetive !== 'boolean' || doc.IsNegetive !== refund || [2, 4].includes(type) !== refund) return incomplete();
    const gross = monetaryMinor(doc.TotalIncludeVAT);
    const ils = monetaryMinor(doc.TotalIncludeVATNIS);
    const vat = monetaryMinor(doc.VATOnlyNIS);
    if (gross !== Math.abs(receipt.amountMinor) || (receipt.ilsAmountMinor != null && ils !== Math.abs(receipt.ilsAmountMinor)) || vat > ils) return incomplete();
    if (!refund && (doc.TotalIncludeVAT < 0 || doc.TotalIncludeVATNIS < 0 || doc.VATOnlyNIS < 0)) return incomplete();
    const sign = refund ? -1 : 1;
    return { ilsAmountMinor: sign * ils, vatIlsMinor: vat === 0 ? 0 : sign * vat };
}
