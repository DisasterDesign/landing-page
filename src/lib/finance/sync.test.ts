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
