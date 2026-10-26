import assert from 'node:assert/strict';
import test from 'node:test';
import { deduplicateReceipts, normalizeCardcomTransaction, resolveTransactionBook, readAccountBookOverrides, receiptsWithinWindow, parseFinanceHistoryDate } from './transactions';
const base = { provider: 'CARDCOM', terminalId: '1', providerTransactionId: '123', kind: 'CHARGE', amountMinor: 10000, currency: 'ILS', ilsAmountMinor: 10000, occurredAt: new Date('2026-01-01'), financeBook: 'PRIVATE' } as const;
test('one provider receipt counted once across ledger agreement charges and paid quote', () => {
    assert.equal(deduplicateReceipts([base, { ...base, source: 'charge' }, { ...base, source: 'quote' }]).length, 1);
    assert.equal(deduplicateReceipts([base, { ...base, kind: 'REFUND', amountMinor: -10000, ilsAmountMinor: -10000 }]).reduce((s, r) => s + (r.ilsAmountMinor ?? 0), 0), 0);
});
test('refund polarity and missing USD valuation are preserved', () => {
    const row = normalizeCardcomTransaction({ TranzactionId: 123, Amount: 104, CreateDate: '2026-01-01', ResponseCode: 0, CoinId: 2, DealType: 'Credit' }, '1');
    assert.equal(row?.currency, 'USD');
    assert.equal(row?.amountMinor, -10400);
    assert.equal(row?.ilsAmountMinor, null);
    assert.equal(row?.kind, 'REFUND');
});
test('unknown currency is never assumed to be shekels', () => {
    assert.equal(normalizeCardcomTransaction({ TranzactionId: 1, Amount: 5, CreateDate: '2026-01-01', ResponseCode: 0 }, '1')?.ilsAmountMinor, null);
});
test('exact account plus recurring deal resolves snapshot; conflicting mapping remains unknown', () => {
    const candidates = [{ id: 'a', clientId: 'c', cardcomAccountId: 701, cardcomRecurringId: 9001, financeBook: 'PRIVATE' }];
    assert.equal(resolveTransactionBook({ accountId: 701, recurringId: 9001 }, candidates, [])?.financeBook, 'PRIVATE');
    assert.equal(resolveTransactionBook({ accountId: 701, recurringId: 9 }, candidates, []), null);
    assert.deepEqual(resolveTransactionBook({ accountId: 702 }, [], [{ id: 'first', partner: 'fuzion', cardcomAccountIds: [702] }, { id: 'second', partner: 'fuzion', cardcomAccountIds: [702] }], new Map([[702, 'SHARED']])), {financeBook:'SHARED',clientId:null,agreementId:null,clientProductId:null});
});
test('legacy account with no agreement resolves private; archival does not erase receipts', () => {
    assert.equal(resolveTransactionBook({ accountId: 703 }, [], [{ id: 'old', partner: 'personal', cardcomAccountIds: [703], archivedAt: new Date() }])?.financeBook, 'PRIVATE');
});
test('small charge and equal refund cancel fee rounding exactly', async () => {
    const { receiptTotals } = await import('./receipts');
    const rows = [{ ...base, amountMinor: 25, ilsAmountMinor: 25 }, { ...base, kind: 'REFUND', amountMinor: -25, ilsAmountMinor: -25 }];
    const totals = receiptTotals(rows);
    assert.equal(totals.fee, 0);
    assert.equal(totals.profit, 0);
});


test('inclusive provider responses are bounded to the requested half-open receipt window', () => {
    const from = new Date('2026-01-01T12:00:00Z');
    const to = new Date('2026-01-02T08:30:00Z');
    const rows = ['2026-01-01T11:59:59Z', from.toISOString(), '2026-01-02T08:29:59Z', to.toISOString(), '2026-01-02T20:00:00Z'].map((date, i) => ({ ...base, providerTransactionId: String(i), occurredAt: new Date(date) }));
    assert.deepEqual(receiptsWithinWindow(rows, from, to).map(r => r.providerTransactionId), ['1', '2']);
    assert.throws(() => receiptsWithinWindow(rows, to, from), /range/i);
    assert.throws(() => receiptsWithinWindow([{ ...base, occurredAt: new Date('bad') }], from, to), /date/i);
});

test('history arguments support current exact time and reject normalized invalid calendar dates', () => {
    const now = new Date('2026-10-26T14:23:12.123Z');
    assert.equal(parseFinanceHistoryDate('now', { allowNow: true, now }).toISOString(), now.toISOString());
    assert.equal(parseFinanceHistoryDate('2026-10-26T14:23:12.123Z').toISOString(), now.toISOString());
    assert.equal(parseFinanceHistoryDate('2026-10-26T17:23:12.123+03:00').toISOString(), now.toISOString());
    assert.equal(parseFinanceHistoryDate('2026-10-26').toISOString(), '2026-10-26T00:00:00.000Z');
    for (const invalid of ['2026-02-30', '2026-02-30T12:00:00Z', '2026-01-01T25:00:00Z', '2026-01-01T12:00:00', 'garbage', 'now']) assert.throws(() => parseFinanceHistoryDate(invalid), /date/i);
});

test('owner-confirmed override attributes an orphan account without inventing a client', () => {
    const overrides = readAccountBookOverrides({ accounts: [{ accountId: 704, financeBook: 'PRIVATE' }] });
    assert.deepEqual(resolveTransactionBook({ accountId: 704 }, [], [], overrides), { financeBook: 'PRIVATE', clientId: null, agreementId: null, clientProductId: null });
    assert.equal(resolveTransactionBook({ accountId: 705 }, [], [], overrides), null);
    assert.equal(resolveTransactionBook({ accountId: 702 }, [], []), null);
});

test('book overrides cannot hide contradictory client or agreement attribution', () => {
    const overrides = new Map([[704, 'PRIVATE' as const]]);
    const clients = [{ id: 'shared', partner: 'fuzion', cardcomAccountIds: [704] }];
    assert.equal(resolveTransactionBook({ accountId: 704 }, [], clients, overrides), null);
    assert.equal(resolveTransactionBook({ accountId: 704, recurringId: 9002 }, [{ id: 'agreement', clientId: null, cardcomAccountId: 704, cardcomRecurringId: 9002, financeBook: 'SHARED' }], [], overrides), null);
    assert.equal(resolveTransactionBook({ accountId: 704 }, [], [...clients, { id: 'personal', partner: 'personal', cardcomAccountIds: [704] }], overrides), null);
});

test('owner override metadata fails closed on invalid or conflicting entries', () => {
    assert.equal(readAccountBookOverrides(null).size, 0);
    assert.throws(() => readAccountBookOverrides({ accounts: [{ accountId: 704, financeBook: 'PRIVATE' }, { accountId: 704, financeBook: 'SHARED' }] }), /override/i);
    assert.throws(() => readAccountBookOverrides({ accounts: [{ accountId: 704, financeBook: 'UNASSIGNED' }] }), /override/i);
    assert.throws(() => readAccountBookOverrides({ accounts: [{ accountId: '704', financeBook: 'PRIVATE' }] }), /override/i);
});


test('verified provider transaction does not bypass conflicting exact account or duplicate agreements', () => {
    const agreement = { id: 'verified', clientId: 'client', cardcomAccountId: 706, cardcomRecurringId: 9003, financeBook: 'PRIVATE', cardcomVerifiedTransactionId: 'provider-receipt' };
    assert.equal(resolveTransactionBook({ providerTransactionId: 'provider-receipt' }, [agreement], [])?.agreementId, 'verified');
    assert.equal(resolveTransactionBook({ providerTransactionId: 'provider-receipt', accountId: 707 }, [agreement], []), null);
    assert.equal(resolveTransactionBook({ providerTransactionId: 'provider-receipt', accountId: 706, recurringId: 9004 }, [agreement], []), null);
    assert.equal(resolveTransactionBook({ providerTransactionId: 'provider-receipt' }, [agreement, { ...agreement, id: 'duplicate' }], []), null);
    assert.equal(resolveTransactionBook({ providerTransactionId: 'provider-receipt', accountId: 706 }, [agreement], [], new Map([[706, 'SHARED']])), null);
});

test('an inclusive provider receipt on a monthly boundary belongs to exactly one window', () => {
    const boundary = { ...base, occurredAt: new Date('2026-02-01T00:00:00Z') };
    const jan = receiptsWithinWindow([boundary], new Date('2026-01-01T00:00:00Z'), new Date('2026-02-01T00:00:00Z'));
    const feb = receiptsWithinWindow([boundary, { ...boundary }], new Date('2026-02-01T00:00:00Z'), new Date('2026-03-01T00:00:00Z'));
    assert.equal(jan.length, 0);
    assert.equal(deduplicateReceipts([...jan, ...feb]).length, 1);
});


test('nonpositive provider identity sentinels do not contradict a verified transaction match', () => {
    const candidates = [{ id: 'verified-order', clientId: 'verified-client', cardcomAccountId: 804, cardcomRecurringId: 8401, financeBook: 'SHARED', cardcomVerifiedTransactionId: '800004' }];
    const source = { TranzactionId: 800004, Amount: 45, CreateDate: '2026-04-02T09:00:00Z', ResponseCode: 0, CoinId: 1 };
    const receipt = normalizeCardcomTransaction({ ...source, AccountId: 0, RecurringId: 0 }, 'synthetic-terminal');
    assert.equal(receipt?.accountId, null);
    assert.equal(receipt?.recurringId, null);
    assert.equal(resolveTransactionBook(receipt!, candidates, [])?.agreementId, 'verified-order');
    const contradictory = normalizeCardcomTransaction({ ...source, AccountId: 805, RecurringId: 8501 }, 'synthetic-terminal');
    assert.equal(resolveTransactionBook(contradictory!, candidates, []), null);
});

test('provider identity fields retain only positive safe integer identifiers', () => {
    const source = { TranzactionId: 800005, Amount: 45, CreateDate: '2026-04-02T09:00:00Z', ResponseCode: 0, CoinId: 1 };
    for (const invalid of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, NaN]) {
        const receipt = normalizeCardcomTransaction({ ...source, AccountId: invalid, RecurringId: invalid }, 'synthetic-terminal');
        assert.equal(receipt?.accountId, null);
        assert.equal(receipt?.recurringId, null);
    }
    const valid = normalizeCardcomTransaction({ ...source, AccountId: 806, RecurringId: 8601 }, 'synthetic-terminal');
    assert.equal(valid?.accountId, 806);
    assert.equal(valid?.recurringId, 8601);
});
