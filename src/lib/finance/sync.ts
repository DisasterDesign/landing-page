import { prisma } from '@/lib/prisma';
import { getCardcomConfig, getRecurringPaymentHistory, listSuccessfulTransactions, type RecurringHistoryRow } from '@/lib/cardcom';
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
    const identities = new Map<string, {
        accountId: number;
        recurringId: number;
    }>();
    const histories = new Map<number, RecurringHistoryRow[]>();
    for (const accountId of accountIds) {
        const history = await getRecurringPaymentHistory({ accountId, fromDate, toDate });
        histories.set(accountId, history);
        for (const h of history) {
            if (h.Status !== 'SUCCESSFUL' || !h.TranzactionId)
                continue;
            const key = String(h.TranzactionId);
            const old = identities.get(key);
            if (old && (old.accountId !== accountId || old.recurringId !== h.RecurringId))
                throw new Error('Conflicting exact provider transaction mapping');
            identities.set(key, { accountId, recurringId: h.RecurringId });
        }
    }
    const normalized = transactions.map(t => normalizeCardcomTransaction(t, String(cfg.terminal))).filter(t => t !== null);
    const prepared = deduplicateReceipts(receiptsWithinWindow(normalized, fromDate, toDate)).map(receipt => {
        const identity = identities.get(receipt.providerTransactionId);
        if (identity) {
            receipt.accountId = identity.accountId;
            receipt.recurringId = identity.recurringId;
        }
        return { ...receipt, ...resolveTransactionBook(receipt, agreements, clients, overrides) };
    });
    let unknown = 0;
    for (const r of prepared) {
        if (r.financeBook === 'UNASSIGNED')
            unknown++;
        // Do not rewrite historical attribution, original amount, date or currency on repeated pulls.
        if(options.persist!==false) await prisma.financeTransaction.upsert({ where: { provider_terminalId_providerTransactionId_kind: { provider: r.provider, terminalId: r.terminalId, providerTransactionId: r.providerTransactionId, kind: r.kind } }, create: { ...r, financeBook: r.financeBook as 'PRIVATE' | 'SHARED' | 'UNASSIGNED' }, update: {} });
    }
    return { transactions: prepared.length, unknown, histories, receipts:prepared };
}
