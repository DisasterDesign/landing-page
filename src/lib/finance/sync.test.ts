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
