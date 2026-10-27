import assert from 'node:assert/strict';
import test from 'node:test';
import * as subject from './sync';
import type { RecurringHistoryRow } from '@/lib/cardcom';

const from = new Date('2026-04-01T00:00:00Z');
const to = new Date('2026-05-01T00:00:00Z');
const transaction = { TranzactionId: 800001, AccountId: 801, RecurringId: 8101, Amount: 90, CoinId: 1, CreateDate: '2026-04-02T09:00:00Z', ResponseCode: 0 };
const agreement = { id: 'unrelated-agreement', clientId: 'shared-client', cardcomAccountId: 801, cardcomRecurringId: 8199, financeBook: 'SHARED' };
const client = { id: 'shared-client', partner: 'fuzion', cardcomAccountIds: [801], products: [{ id: 'shared-product', agreementId: 'unrelated-agreement', financeBook: 'SHARED' }] };
const input = {
    transactions: [transaction, { ...transaction }], terminalId: 'synthetic-terminal', fromDate: from, toDate: to,
    histories: new Map<number, RecurringHistoryRow[]>([[801, [
        { Status: 'SUCCESSFUL', TranzactionId: 800001, RecurringId: 8101, SumToBill: 60 },
        { Status: 'SUCCESSFUL', TranzactionId: 800001, RecurringId: 8102, SumToBill: 30 },
        { Status: 'SUCCESSFUL', TranzactionId: 800001, RecurringId: 8101, SumToBill: 60 },
    ]]]),
    agreements: [agreement], clients: [client], overrides: new Map(),
};

test('consolidated recurring lines remain one unassigned receipt without choosing an unrelated agreement', () => {
    assert.equal(typeof subject.prepareCardcomLedgerReceipts, 'function');
    const receipts = subject.prepareCardcomLedgerReceipts(input);
    assert.equal(receipts.length, 1);
    assert.deepEqual({
        amountMinor: receipts[0].amountMinor, ilsAmountMinor: receipts[0].ilsAmountMinor,
        accountId: receipts[0].accountId, recurringId: receipts[0].recurringId,
        financeBook: receipts[0].financeBook, clientId: receipts[0].clientId,
        agreementId: receipts[0].agreementId, clientProductId: receipts[0].clientProductId,
    }, { amountMinor: 9000, ilsAmountMinor: 9000, accountId: 801, recurringId: null,
        financeBook: 'UNASSIGNED', clientId: null, agreementId: null, clientProductId: null });
});

test('a provider transaction found under two accounts still aborts the covered sync', () => {
    assert.equal(typeof subject.prepareCardcomLedgerReceipts, 'function');
    const histories = new Map(input.histories);
    histories.set(802, [{ Status: 'SUCCESSFUL', TranzactionId: 800001, RecurringId: 8201 }]);
    assert.throws(() => subject.prepareCardcomLedgerReceipts({ ...input, histories }), /Conflicting exact provider transaction mapping/);
});

test('duplicate history rows for one recurring order preserve its exact attribution', () => {
    assert.equal(typeof subject.prepareCardcomLedgerReceipts, 'function');
    const row = { Status: 'SUCCESSFUL', TranzactionId: 800001, RecurringId: 8199 };
    const receipts = subject.prepareCardcomLedgerReceipts({ ...input, histories: new Map<number, RecurringHistoryRow[]>([[801, [row, { ...row }]]]) });
    assert.equal(receipts.length, 1);
    assert.equal(receipts[0].financeBook, 'SHARED');
    assert.equal(receipts[0].agreementId, 'unrelated-agreement');
    assert.equal(receipts[0].clientProductId, 'shared-product');
    assert.equal(receipts[0].recurringId, 8199);
});

const consolidatedAgreements = [
    { id: 'first-order', clientId: 'shared-client', cardcomAccountId: 801, cardcomRecurringId: 8101, financeBook: 'SHARED' },
    { id: 'second-order', clientId: 'shared-client', cardcomAccountId: 801, cardcomRecurringId: 8102, financeBook: 'SHARED' },
];
const consolidatedClient = { ...client, products: [
    { id: 'first-product', agreementId: 'first-order', financeBook: 'SHARED' },
    { id: 'second-product', agreementId: 'second-order', financeBook: 'SHARED' },
] };

test('consolidated exact orders in the same book keep the full receipt and only common links', () => {
    const receipts = subject.prepareCardcomLedgerReceipts({ ...input, agreements: [...consolidatedAgreements, agreement], clients: [consolidatedClient] });
    assert.equal(receipts.length, 1);
    assert.deepEqual({
        amountMinor: receipts[0].amountMinor, ilsAmountMinor: receipts[0].ilsAmountMinor,
        accountId: receipts[0].accountId, recurringId: receipts[0].recurringId,
        financeBook: receipts[0].financeBook, clientId: receipts[0].clientId,
        agreementId: receipts[0].agreementId, clientProductId: receipts[0].clientProductId,
    }, { amountMinor: 9000, ilsAmountMinor: 9000, accountId: 801, recurringId: null,
        financeBook: 'SHARED', clientId: 'shared-client', agreementId: null, clientProductId: null });
});

test('consolidated private orders for different clients retain the private book without choosing a client', () => {
    const agreements = consolidatedAgreements.map((row, index) => ({ ...row, financeBook: 'PRIVATE', clientId: `private-client-${index}` }));
    const receipts = subject.prepareCardcomLedgerReceipts({ ...input, agreements, clients: [] });
    assert.equal(receipts[0].financeBook, 'PRIVATE');
    assert.equal(receipts[0].clientId, null);
    assert.equal(receipts[0].agreementId, null);
    assert.equal(receipts[0].clientProductId, null);
});

test('consolidated mixed, unassigned or missing exact order mappings remain unassigned', () => {
    for (const agreements of [
        [consolidatedAgreements[0], { ...consolidatedAgreements[1], financeBook: 'PRIVATE' }],
        [consolidatedAgreements[0], { ...consolidatedAgreements[1], financeBook: 'UNASSIGNED' }],
        [consolidatedAgreements[0], agreement],
    ]) {
        const receipt = subject.prepareCardcomLedgerReceipts({ ...input, agreements, clients: [consolidatedClient] })[0];
        assert.deepEqual({ financeBook: receipt.financeBook, clientId: receipt.clientId, agreementId: receipt.agreementId, clientProductId: receipt.clientProductId },
            { financeBook: 'UNASSIGNED', clientId: null, agreementId: null, clientProductId: null });
    }
});

test('consolidation keeps verified-transaction conflicts unassigned', () => {
    const agreements = consolidatedAgreements.map((row, index) => index === 0 ? { ...row, cardcomVerifiedTransactionId: '800001' } : row);
    const receipt = subject.prepareCardcomLedgerReceipts({ ...input, agreements, clients: [consolidatedClient] })[0];
    assert.equal(receipt.financeBook, 'UNASSIGNED');
    assert.equal(receipt.agreementId, null);
});

test('consolidation preserves foreign keys when every exact resolution has the same links', () => {
    const verifiedAgreement = { ...agreement, cardcomRecurringId: null, cardcomVerifiedTransactionId: '800001' };
    const receipt = subject.prepareCardcomLedgerReceipts({ ...input, agreements: [verifiedAgreement], clients: [client] })[0];
    assert.deepEqual({ financeBook: receipt.financeBook, clientId: receipt.clientId, agreementId: receipt.agreementId, clientProductId: receipt.clientProductId },
        { financeBook: 'SHARED', clientId: 'shared-client', agreementId: 'unrelated-agreement', clientProductId: 'shared-product' });
    assert.equal(receipt.recurringId, null);
});

test('consolidated unmodeled orders never inherit a singleton shared client book', () => {
    const receipt = subject.prepareCardcomLedgerReceipts({ ...input, agreements: [], clients: [client] })[0];
    assert.deepEqual({ financeBook: receipt.financeBook, clientId: receipt.clientId, agreementId: receipt.agreementId, clientProductId: receipt.clientProductId },
        { financeBook: 'UNASSIGNED', clientId: null, agreementId: null, clientProductId: null });
});

test('an explicit whole-account owner override can classify consolidated orders without inferred client links', () => {
    const receipt = subject.prepareCardcomLedgerReceipts({ ...input, agreements: [], clients: [], overrides: new Map([[801, 'SHARED' as const]]) })[0];
    assert.deepEqual({ financeBook: receipt.financeBook, clientId: receipt.clientId, agreementId: receipt.agreementId, clientProductId: receipt.clientProductId },
        { financeBook: 'SHARED', clientId: null, agreementId: null, clientProductId: null });
    assert.equal(receipt.recurringId, null);
});

test('covered preparation requires original document VAT only for new receipts', () => {
    const transactions = [{ ...transaction, DocumentNumber: 710001, DocumentType: 'TaxInvoiceAndReceipt' }];
    const documents = [{ Terminal_Number: 1000, Invoice_Number: 710001, InvoiceType: 1, CoinID: 1, TotalIncludeVAT: 90, TotalIncludeVATNIS: 90, VATOnlyNIS: 0, IsNegetive: false }];
    const withDocuments = { ...input, terminalId: '1000', transactions, documents };
    assert.equal(subject.prepareCardcomLedgerReceipts(withDocuments)[0].vatIlsMinor, 0);
    assert.throws(() => subject.prepareCardcomLedgerReceipts({ ...withDocuments, documents: [] }), /document.*incomplete/i);
    const historical = subject.prepareCardcomLedgerReceipts({ ...withDocuments, documents: [], existingReceipts: [{ providerTransactionId: '800001', kind: 'CHARGE' }] });
    assert.equal(historical.length, 1);
    assert.equal(historical[0].vatIlsMinor, undefined);
});

test('one original document cannot supply VAT to multiple provider receipts', () => {
    const documents = [{ Terminal_Number: 1000, Invoice_Number: 710001, InvoiceType: 1, CoinID: 1, TotalIncludeVAT: 90, TotalIncludeVATNIS: 90, VATOnlyNIS: 0, IsNegetive: false }];
    assert.throws(() => subject.prepareCardcomLedgerReceipts({ ...input, terminalId: '1000', transactions: [transaction, { ...transaction, TranzactionId: 800002 }].map(row => ({ ...row, DocumentNumber: 710001, DocumentType: 'TaxInvoiceAndReceipt' })), documents }), /document.*incomplete/i);
});

test('sync creates only fully evidenced receipts and never rewrites historical VAT FX links or amounts', async (t) => {
    const cfg = ['CARDCOM_TERMINAL', 'CARDCOM_API_NAME', 'CARDCOM_API_PASSWORD'] as const;
    const previous = cfg.map(key => process.env[key]);
    cfg.forEach((key, i) => { process.env[key] = ['1000', 'synthetic-api', 'synthetic-password'][i]; });
    const old = { providerTransactionId: '800001', kind: 'CHARGE', vatIlsMinor: 913, ilsAmountMinor: 9000, clientId: 'historic-client', amountMinor: 3000, currency: 'USD' };
    let saved: Record<string, unknown>[] = [];
    const db = {
        client: { findMany: async () => [] },
        agreement: { findMany: async () => [] },
        financeSyncState: { findUnique: async () => null },
        financeTransaction: {
            findMany: async () => [old],
            upsert: async (args: { create: Record<string, unknown>; update: Record<string, unknown> }) => {
                if (args.create.providerTransactionId === old.providerTransactionId) Object.assign(old, args.update);
                saved.push(args);
                return {};
            },
        },
    };
    let documents: unknown[] = [{ Terminal_Number: 1000, Invoice_Number: 710002, InvoiceType: 1, CoinID: 1, TotalIncludeVAT: 90, TotalIncludeVATNIS: 90, VATOnlyNIS: 0, IsNegetive: false }];
    t.mock.method(globalThis, 'fetch', async (url: string) => {
        if (url.endsWith('/Transactions/ListTransactions')) return Response.json({ ResponseCode: 0, Tranzactions: [{ ...transaction, DocumentNumber: 710001 }, { ...transaction, TranzactionId: 800002, DocumentNumber: 710002, DocumentType: 'TaxInvoiceAndReceipt' }] });
        if (url.endsWith('/Documents/GetReport')) return Response.json({ ResponseCode: 0, Documents: documents, Page: 1, Count: documents.length });
        throw new Error('Unexpected external boundary');
    });
    try {
        const result = await subject.syncCardcomLedger(from, to, {}, db as never);
        assert.equal(result.transactions, 2);
        const creates = saved.map(row => row.create as Record<string, unknown>);
        assert.equal(creates.find(row => row.providerTransactionId === '800002')?.vatIlsMinor, 0);
        assert.deepEqual(old, { providerTransactionId: '800001', kind: 'CHARGE', vatIlsMinor: 913, ilsAmountMinor: 9000, clientId: 'historic-client', amountMinor: 3000, currency: 'USD' });
        for (const row of saved) assert.deepEqual(row.update, {});
        saved = [];
        documents = [];
        await assert.rejects(() => subject.syncCardcomLedger(from, to, {}, db as never), /document.*incomplete/i);
        assert.equal(saved.length, 0);
    } finally {
        cfg.forEach((key, i) => { if (previous[i] == null) delete process.env[key]; else process.env[key] = previous[i]; });
    }
});


test('conflicting document links for one provider transaction never choose the first VAT snapshot', () => {
    const documents = [710001, 710002].map(Invoice_Number => ({ Terminal_Number: 1000, Invoice_Number, InvoiceType: 1, CoinID: 1, TotalIncludeVAT: 90, TotalIncludeVATNIS: 90, VATOnlyNIS: 0, IsNegetive: false }));
    assert.throws(() => subject.prepareCardcomLedgerReceipts({ ...input, terminalId: '1000', transactions: [710001, 710002].map(DocumentNumber => ({ ...transaction, DocumentNumber, DocumentType: 'TaxInvoiceAndReceipt' })), documents }), /document.*incomplete/i);
});
