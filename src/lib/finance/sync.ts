import { prisma } from '@/lib/prisma';
import { getCardcomConfig, getRecurringPaymentHistory, listSuccessfulTransactions, type FailedTransaction, type RecurringHistoryRow } from '@/lib/cardcom';
import { deduplicateReceipts, normalizeCardcomTransaction, resolveTransactionBook, readAccountBookOverrides, receiptsWithinWindow } from './transactions';
/** Full covered read before persisting; any failed account/page invalidates this attempt. */
export async function syncCardcomLedger(fromDate: Date, toDate: Date, options: {persist?:boolean} = {}) {
    receiptsWithinWindow([], fromDate, toDate);
    const cfg = getCardcomConfig();
    if (!cfg)
        throw new Error('Cardcom not configured');
    const [transactions, clients, agreements, overrideState] = await Promise.all([
        listSuccessfulTransactions({ fromDate, toDate }),
        prisma.client.findMany({ select: { id: true, partner: true, cardcomAccountIds: true, archivedAt: true, products: { select: { id: true, agreementId: true, financeBook: true } } } }),
        prisma.agreement.findMany({ select: { id: true, clientId: true, financeBook: true, cardcomAccountId: true, cardcomRecurringId: true, cardcomVerifiedTransactionId: true, cardcomDealId: true } }),
        prisma.financeSyncState.findUnique({ where: { key: 'finance:account-overrides' }, select: { metadata: true } }),
    ]);
    const overrides = readAccountBookOverrides(overrideState?.metadata);
    const accountIds = new Set([...clients.flatMap(c => c.cardcomAccountIds), ...agreements.flatMap(a => a.cardcomAccountId ? [a.cardcomAccountId] : []), ...overrides.keys()]);
    const histories = new Map<number, RecurringHistoryRow[]>();
    for (const accountId of accountIds) {
        const history = await getRecurringPaymentHistory({ accountId, fromDate, toDate });
        histories.set(accountId, history);
    }
    const prepared = prepareCardcomLedgerReceipts({ transactions, terminalId: String(cfg.terminal), histories, agreements, clients, overrides, fromDate, toDate });
    let unknown = 0;
    for (const r of prepared) {
        if (r.financeBook === 'UNASSIGNED')
            unknown++;
        // Do not rewrite historical attribution, original amount, date or currency on repeated pulls.
        if(options.persist!==false) await prisma.financeTransaction.upsert({ where: { provider_terminalId_providerTransactionId_kind: { provider: r.provider, terminalId: r.terminalId, providerTransactionId: r.providerTransactionId, kind: r.kind } }, create: { ...r, financeBook: r.financeBook as 'PRIVATE' | 'SHARED' | 'UNASSIGNED' }, update: {} });
    }
    return { transactions: prepared.length, unknown, histories, receipts:prepared };
}

/** Prepare a fully covered provider read before any ledger writes. */
export function prepareCardcomLedgerReceipts(input: {
    transactions: FailedTransaction[];
    terminalId: string;
    histories: ReadonlyMap<number, readonly RecurringHistoryRow[]>;
    agreements: Parameters<typeof resolveTransactionBook>[1];
    clients: Parameters<typeof resolveTransactionBook>[2];
    overrides: Parameters<typeof resolveTransactionBook>[3];
    fromDate: Date;
    toDate: Date;
}) {
    const identities = new Map<string, { accountId: number; recurringId: number | null }>();
    for (const [accountId, history] of input.histories) {
        for (const h of history) {
            if (h.Status !== 'SUCCESSFUL' || !h.TranzactionId)
                continue;
            const key = String(h.TranzactionId);
            const old = identities.get(key);
            if (old && old.accountId !== accountId)
                throw new Error('Conflicting exact provider transaction mapping');
            identities.set(key, { accountId, recurringId: old && old.recurringId !== h.RecurringId ? null : h.RecurringId });
        }
    }
    const normalized = input.transactions.map(t => normalizeCardcomTransaction(t, input.terminalId)).filter(t => t !== null);
    return deduplicateReceipts(receiptsWithinWindow(normalized, input.fromDate, input.toDate)).map(receipt => {
        const identity = identities.get(receipt.providerTransactionId);
        if (identity) {
            receipt.accountId = identity.accountId;
            receipt.recurringId = identity.recurringId;
        }
        // One settlement can cover several orders. Its full amount cannot be
        // attributed to any one order, even if an unrelated account agreement exists.
        if (identity?.recurringId === null) {
            return { ...receipt, financeBook: 'UNASSIGNED', clientId: null, agreementId: null, clientProductId: null };
        }
        return { ...receipt, ...resolveTransactionBook(receipt, input.agreements, input.clients, input.overrides) };
    });
}
