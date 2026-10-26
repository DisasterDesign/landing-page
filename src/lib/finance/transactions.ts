import type { FinanceBook } from '@prisma/client';
import type { FailedTransaction } from '@/lib/cardcom';
export interface Receipt {
    provider: string;
    terminalId: string;
    providerTransactionId: string;
    kind: string;
    amountMinor: number;
    currency: string;
    ilsAmountMinor: number | null;
    occurredAt: Date;
    financeBook: string;
    clientId?: string | null;
    clientProductId?: string | null;
    agreementId?: string | null;
    invoiceNumber?: string | null;
    accountId?: number | null;
    recurringId?: number | null;
    vatExempt?: boolean;
    feeApplies?: boolean;
    source?: string;
}
export function deduplicateReceipts<T extends Receipt>(rows: readonly T[]): T[] {
    const seen = new Set<string>();
    return rows.filter(row => { const key = JSON.stringify([row.provider, row.terminalId, row.providerTransactionId, row.kind]); if (seen.has(key))
        return false; seen.add(key); return true; });
}
export function normalizeCardcomTransaction(row: FailedTransaction, terminalId: string): Receipt | null {
    if (row.ResponseCode !== 0 || !Number.isFinite(row.Amount))
        return null;
    const id = String(row.TranzactionId ?? '').trim();
    const date = new Date(row.CreateDate);
    if (!id || !Number.isFinite(date.getTime()))
        throw new Error('Verified Cardcom transaction lacks stable identity or date');
    const refund = row.Amount < 0 || /^(credit|refund|זיכוי)$/i.test(row.DealType ?? '');
    const currency = row.Currency?.toUpperCase() ?? ({ 1: 'ILS', 2: 'USD', 978: 'EUR', 840: 'USD', 376: 'ILS' }[row.CoinId ?? row.ISOCoinId ?? 0] ?? 'UNKNOWN');
    const sign = refund ? -1 : 1;
    const amountMinor = sign * Math.round(Math.abs(row.Amount) * 100);
    const valued = row.AmountILS ?? row.AmountInILS;
    return { provider: 'CARDCOM', terminalId, providerTransactionId: id, kind: refund ? 'REFUND' : 'CHARGE', amountMinor, currency, ilsAmountMinor: currency === 'ILS' ? amountMinor : valued != null && Number.isFinite(valued) ? sign * Math.round(Math.abs(valued) * 100) : null, occurredAt: date, financeBook: 'UNASSIGNED', accountId: row.AccountId ?? null, recurringId: row.RecurringId ?? null, invoiceNumber: row.DocumentNumber == null ? null : String(row.DocumentNumber) };
}
interface AgreementLink {
    id: string;
    clientId: string | null;
    cardcomAccountId: number | null;
    cardcomRecurringId: number | null;
    financeBook: string;
    cardcomVerifiedTransactionId?: string | null;
    cardcomDealId?: string | null;
}
interface ClientLink {
    id: string;
    partner: string | null;
    cardcomAccountIds: number[];
    archivedAt?: Date | null;
    products?: {
        id: string;
        financeBook: string;
        agreementId: string | null;
    }[];
}
/** Exact identifiers only. Ambiguous identities keep null foreign keys. */
export function resolveTransactionBook(row: {
    accountId?: number | null;
    recurringId?: number | null;
    providerTransactionId?: string;
}, agreements: AgreementLink[], clients: ClientLink[], overrides: ReadonlyMap<number, FinanceBook> = new Map()): {
    financeBook: FinanceBook;
    clientId: string | null;
    agreementId: string | null;
    clientProductId: string | null;
} | null {
    const accountAgreements = agreements.filter(a => row.accountId != null && a.cardcomAccountId === row.accountId);
    const accountClients = clients.filter(c => row.accountId != null && c.cardcomAccountIds.includes(row.accountId));
    const override = row.accountId == null ? undefined : overrides.get(row.accountId);
    const clientBooks = (c: ClientLink): string[] => c.products?.length
        ? c.products.map(p => p.financeBook)
        : [c.partner === 'personal' ? 'PRIVATE' : c.partner === 'fuzion' ? 'SHARED' : 'UNASSIGNED'];
    // An explicit account instruction is not permission to rewrite contradictory records.
    if (override && [...accountAgreements.map(a => a.financeBook), ...accountClients.flatMap(clientBooks)].some(book => book !== 'UNASSIGNED' && book !== override)) return null;
    const verified = row.providerTransactionId == null ? [] : agreements.filter(a => a.cardcomVerifiedTransactionId === row.providerTransactionId || a.cardcomDealId === row.providerTransactionId);
    if (verified.length > 1) return null;
    const matches = accountAgreements.filter(a => row.recurringId == null || a.cardcomRecurringId === row.recurringId);
    if (verified.length === 1) {
        const a = verified[0];
        if ((override && a.financeBook !== override) || (row.accountId != null && a.cardcomAccountId != null && a.cardcomAccountId !== row.accountId) || (row.recurringId != null && a.cardcomRecurringId != null && a.cardcomRecurringId !== row.recurringId) || matches.some(m => m.id !== a.id)) return null;
        return { financeBook: a.financeBook as FinanceBook, clientId: a.clientId, agreementId: a.id, clientProductId: clients.flatMap(c => c.products ?? []).find(p => p.agreementId === a.id)?.id ?? null };
    }
    if (matches.length === 1) {
        const a = matches[0];
        return { financeBook: a.financeBook as FinanceBook, clientId: a.clientId, agreementId: a.id, clientProductId: clients.flatMap(c => c.products ?? []).find(p => p.agreementId === a.id)?.id ?? null };
    }
    if (accountAgreements.length > 0) return null;
    if (accountClients.length === 1) {
        const c = accountClients[0];
        const books = new Set(clientBooks(c));
        if (books.size !== 1) return null;
        const book = [...books][0];
        if (book !== 'UNASSIGNED') return { financeBook: book as FinanceBook, clientId: c.id, agreementId: null, clientProductId: c.products?.length === 1 ? c.products[0].id : null };
    }
    if (override) return { financeBook: override, clientId: null, agreementId: null, clientProductId: null };
    return null;
}

/** Owner-confirmed mappings are data, never customer-specific code. Invalid configuration aborts sync. */
export function readAccountBookOverrides(metadata: unknown): Map<number, FinanceBook> {
    const result = new Map<number, FinanceBook>();
    if (metadata == null) return result;
    if (typeof metadata !== 'object' || !('accounts' in metadata) || !Array.isArray(metadata.accounts)) throw new Error('Invalid finance account overrides');
    for (const row of metadata.accounts) {
        if (!row || typeof row !== 'object' || !Number.isSafeInteger(row.accountId) || row.accountId <= 0 || (row.financeBook !== 'PRIVATE' && row.financeBook !== 'SHARED')) throw new Error('Invalid finance account override');
        const previous = result.get(row.accountId);
        if (previous && previous !== row.financeBook) throw new Error('Conflicting finance account overrides');
        result.set(row.accountId, row.financeBook);
    }
    return result;
}

/** Cardcom date-only endpoints include both calendar days; the requested interval remains [from, to). */
export function receiptsWithinWindow<T extends { occurredAt: Date }>(rows: readonly T[], from: Date, to: Date): T[] {
    if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from >= to) throw new Error('Invalid finance history range');
    return rows.filter(row => {
        if (!Number.isFinite(row.occurredAt.getTime())) throw new Error('Invalid receipt date');
        return row.occurredAt >= from && row.occurredAt < to;
    });
}

/** Strict calendar date or full ISO timestamp with a timezone; `now` is an explicit upper bound only. */
export function parseFinanceHistoryDate(value: string | undefined, options: { allowNow?: boolean; now?: Date } = {}): Date {
    if (value === 'now' && options.allowNow) return new Date(options.now ?? new Date());
    const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2}))?$/);
    if (!match) throw new Error('Invalid history date; use YYYY-MM-DD or full ISO timestamp with timezone');
    const [, year, month, day, hour, minute, second] = match;
    const calendar = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (calendar.getUTCFullYear() !== Number(year) || calendar.getUTCMonth() + 1 !== Number(month) || calendar.getUTCDate() !== Number(day) || (hour != null && (Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59))) throw new Error('Invalid history date');
    const date = new Date(hour == null ? `${value}T00:00:00Z` : value!);
    if (!Number.isFinite(date.getTime())) throw new Error('Invalid history date');
    return date;
}
