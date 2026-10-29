import { prisma } from '@/lib/prisma';
import type { PrismaClient } from '@prisma/client';
import { listCardcomDocuments } from '@/lib/cardcom-documents';
import { cardcomCashDocumentType, type CardcomDocument } from './document-evidence';
import { getCardcomConfig, getRecurringPaymentHistory, listSuccessfulTransactions, type FailedTransaction, type RecurringHistoryRow } from '@/lib/cardcom';
import { deduplicateReceipts, normalizeCardcomTransaction, resolveTransactionBook, readAccountBookOverrides, receiptsWithinWindow } from './transactions';
/** Full covered read before persisting; any failed account/page invalidates this attempt. */
export async function syncCardcomLedger(fromDate: Date, toDate: Date, options: {persist?:boolean} = {}, db: Pick<PrismaClient, 'client' | 'agreement' | 'financeSyncState' | 'financeTransaction'> = prisma) {
    receiptsWithinWindow([], fromDate, toDate);
    const cfg = getCardcomConfig();
    if (!cfg)
        throw new Error('Cardcom not configured');
    const [transactions, clients, agreements, overrideState] = await Promise.all([
        listSuccessfulTransactions({ fromDate, toDate }),
        db.client.findMany({ select: { id: true, partner: true, cardcomAccountIds: true, archivedAt: true, products: { select: { id: true, agreementId: true, financeBook: true } } } }),
        db.agreement.findMany({ select: { id: true, clientId: true, financeBook: true, cardcomAccountId: true, cardcomRecurringId: true, cardcomVerifiedTransactionId: true, cardcomDealId: true } }),
        db.financeSyncState.findUnique({ where: { key: 'finance:account-overrides' }, select: { metadata: true } }),
    ]);
    const existingReceipts = await db.financeTransaction.findMany({ where: { provider: 'CARDCOM', terminalId: String(cfg.terminal), providerTransactionId: { in: transactions.map(row => String(row.TranzactionId)) } }, select: { providerTransactionId: true, kind: true } });
    const existing = new Set(existingReceipts.map(row => JSON.stringify([row.providerTransactionId, row.kind])));
    const newReceipts = transactions.flatMap(row => {
        const receipt = normalizeCardcomTransaction(row, String(cfg.terminal));
        return receipt && receipt.occurredAt >= fromDate && receipt.occurredAt < toDate && !existing.has(JSON.stringify([receipt.providerTransactionId, receipt.kind])) ? [receipt] : [];
    });
    const coinIds = newReceipts.map(receipt => ({ ILS: 1, USD: 2, EUR: 978 }[receipt.currency] ?? 0));
    const documents = newReceipts.length ? await listCardcomDocuments({ fromDate, toDate, coinIds }) : [];
    const overrides = readAccountBookOverrides(overrideState?.metadata);
    const accountIds = new Set([...clients.flatMap(c => c.cardcomAccountIds), ...agreements.flatMap(a => a.cardcomAccountId ? [a.cardcomAccountId] : []), ...overrides.keys()]);
    const histories = new Map<number, RecurringHistoryRow[]>();
    for (const accountId of accountIds) {
        const history = await getRecurringPaymentHistory({ accountId, fromDate, toDate });
        histories.set(accountId, history);
    }
    const prepared = prepareCardcomLedgerReceipts({ transactions, documents, existingReceipts, terminalId: String(cfg.terminal), histories, agreements, clients, overrides, fromDate, toDate });
    let unknown = 0;
    for (const r of prepared) {
        if (r.financeBook === 'UNASSIGNED')
            unknown++;
        // Do not rewrite historical attribution, original amount, date or currency on repeated pulls.
        if(options.persist!==false) await db.financeTransaction.upsert({ where: { provider_terminalId_providerTransactionId_kind: { provider: r.provider, terminalId: r.terminalId, providerTransactionId: r.providerTransactionId, kind: r.kind } }, create: { ...r, financeBook: r.financeBook as 'PRIVATE' | 'SHARED' | 'UNASSIGNED' }, update: {} });
    }
    return { transactions: prepared.length, unknown, histories, receipts:prepared };
}

/** Prepare a fully covered provider read before any ledger writes. */
export function prepareCardcomLedgerReceipts(input: {
    transactions: FailedTransaction[];
    documents?: readonly CardcomDocument[];
    existingReceipts?: readonly { providerTransactionId: string; kind: string }[];
    terminalId: string;
    histories: ReadonlyMap<number, readonly RecurringHistoryRow[]>;
    agreements: Parameters<typeof resolveTransactionBook>[1];
    clients: Parameters<typeof resolveTransactionBook>[2];
    overrides: Parameters<typeof resolveTransactionBook>[3];
    fromDate: Date;
    toDate: Date;
}) {
    const identities = new Map<string, { accountId: number; recurringIds: Set<number> }>();
    for (const [accountId, history] of input.histories) {
        for (const h of history) {
            if (h.Status !== 'SUCCESSFUL' || !h.TranzactionId)
                continue;
            const key = String(h.TranzactionId);
            const old = identities.get(key);
            if (old && old.accountId !== accountId)
                throw new Error('Conflicting exact provider transaction mapping');
            if (old) old.recurringIds.add(h.RecurringId);
            else identities.set(key, { accountId, recurringIds: new Set([h.RecurringId]) });
        }
    }
    const existing = new Set(input.existingReceipts?.map(row => JSON.stringify([row.providerTransactionId, row.kind])));
    const documentClaims = new Map<string, string>();
    const transactionDocuments = new Map<string, string>();
    const normalized = input.transactions.map(t => {
        const receipt = normalizeCardcomTransaction(t, input.terminalId);
        if (!receipt || receipt.occurredAt < input.fromDate || receipt.occurredAt >= input.toDate) return null;
        if (input.documents !== undefined) {
            const documentKey = JSON.stringify([receipt.terminalId, receipt.invoiceNumber, cardcomCashDocumentType(t.DocumentType)]);
            const receiptKey = JSON.stringify([receipt.providerTransactionId, receipt.kind]);
            const priorDocument = transactionDocuments.get(receiptKey);
            if (priorDocument && priorDocument !== documentKey) throw new Error('Conflicting original Cardcom document links; sync incomplete');
            transactionDocuments.set(receiptKey, documentKey);
            const previous = documentClaims.get(documentKey);
            if (receipt.invoiceNumber && previous && previous !== receipt.providerTransactionId) throw new Error('Original Cardcom document reused for multiple transactions; sync incomplete');
            documentClaims.set(documentKey, receipt.providerTransactionId);
            if (!existing.has(JSON.stringify([receipt.providerTransactionId, receipt.kind]))) return normalizeCardcomTransaction(t, input.terminalId, input.documents);
        }
        return receipt;
    }).filter(t => t !== null);
    return deduplicateReceipts(receiptsWithinWindow(normalized, input.fromDate, input.toDate)).map(receipt => {
        const identity = identities.get(receipt.providerTransactionId);
        if (identity) {
            receipt.accountId = identity.accountId;
            receipt.recurringId = identity.recurringIds.size === 1 ? [...identity.recurringIds][0] : null;
        }
        // Every constituent order needs exact evidence, verified settlement evidence,
        // or an explicit owner account override before resolving a unanimous book.
        if (identity && identity.recurringIds.size > 1) {
            const verifiedSettlement = input.agreements.some(agreement => agreement.cardcomVerifiedTransactionId === receipt.providerTransactionId || agreement.cardcomDealId === receipt.providerTransactionId);
            const ownerAccountOverride = input.overrides?.has(identity.accountId) ?? false;
            const resolutions = [...identity.recurringIds].map(recurringId => {
                const exactOrder = input.agreements.some(agreement => agreement.cardcomAccountId === identity.accountId && agreement.cardcomRecurringId === recurringId);
                if (!exactOrder && !verifiedSettlement && !ownerAccountOverride) return null;
                return resolveTransactionBook({ ...receipt, recurringId }, input.agreements, input.clients, input.overrides);
            });
            const first = resolutions[0];
            if (!first || first.financeBook === 'UNASSIGNED' || resolutions.some(row => !row || row.financeBook !== first.financeBook)) {
                return { ...receipt, financeBook: 'UNASSIGNED', clientId: null, agreementId: null, clientProductId: null };
            }
            const commonLink = (key: 'clientId' | 'agreementId' | 'clientProductId') => resolutions.every(row => row?.[key] === first[key]) ? first[key] : null;
            return { ...receipt, financeBook: first.financeBook, clientId: commonLink('clientId'), agreementId: commonLink('agreementId'), clientProductId: commonLink('clientProductId') };
        }
        return { ...receipt, ...resolveTransactionBook(receipt, input.agreements, input.clients, input.overrides) };
    });
}
