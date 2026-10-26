import assert from 'node:assert/strict';
import test from 'node:test';
import { receiptTotals } from './receipts';

const receipt = {
    provider: 'CARDCOM', terminalId: 'synthetic-terminal', providerTransactionId: 'synthetic-receipt',
    kind: 'CHARGE', amountMinor: 3000, currency: 'USD', ilsAmountMinor: 11800,
    occurredAt: new Date('2026-01-01T00:00:00Z'), financeBook: 'PRIVATE', vatExempt: true,
};

test('document VAT in ILS overrides the current client VAT exemption for historical foreign receipts', () => {
    const totals = receiptTotals([{ ...receipt, vatIlsMinor: 1800 }]);
    assert.equal(totals.gross, 118);
    assert.equal(totals.vat, 18);
    assert.equal(totals.net, 100);
    assert.equal(totals.fee, 2.36);
    assert.equal(totals.feeEstimated, true);
    assert.equal(totals.profit, 97.64);
});

test('signed refund VAT reverses the recorded tax and zero document VAT remains authoritative', () => {
    const refund = { ...receipt, kind: 'REFUND', amountMinor: -3000, ilsAmountMinor: -11800, vatIlsMinor: -1800 };
    assert.equal(receiptTotals([refund]).vat, -18);
    const cancelled = receiptTotals([{ ...receipt, vatIlsMinor: 1800 }, refund]);
    assert.equal(cancelled.vat, 0);
    assert.equal(cancelled.profit, 0);
    assert.equal(receiptTotals([{ ...receipt, vatExempt: false, vatIlsMinor: 0 }]).vat, 0);
});

test('missing or null receipt VAT preserves the prior client default fallback', () => {
    assert.equal(receiptTotals([{ ...receipt, vatExempt: false }]).vat, 18);
    assert.equal(receiptTotals([{ ...receipt, vatExempt: false, vatIlsMinor: null }]).vat, 18);
    assert.equal(receiptTotals([{ ...receipt, vatIlsMinor: null }]).vat, 0);
    assert.equal(receiptTotals([{ ...receipt }]).vat, 0);
});
