import assert from 'node:assert/strict';
import test from 'node:test';
import type { CardcomDocument } from './document-evidence';
import { normalizeCardcomTransaction } from './transactions';

const transaction = { TranzactionId: 910001, Amount: 118, CreateDate: '2026-04-02T09:00:00Z', ResponseCode: 0, CoinId: 1, DocumentNumber: 710001, DocumentType: 'TaxInvoiceAndReceipt' };
const document = { Terminal_Number: 1000, Invoice_Number: 710001, InvoiceType: 1, CoinID: 1, TotalIncludeVAT: 118, TotalIncludeVATNIS: 118, VATOnlyNIS: 18, IsNegetive: false };

test('new ILS receipts preserve original document VAT including explicit zero', () => {
    assert.equal(normalizeCardcomTransaction(transaction, '1000', [document])?.vatIlsMinor, 1800);
    assert.equal(normalizeCardcomTransaction(transaction, '1000', [{ ...document, VATOnlyNIS: 0 }])?.vatIlsMinor, 0);
});

test('foreign document valuation supplies original ILS gross and VAT without an inferred rate', () => {
    const receipt = normalizeCardcomTransaction({ ...transaction, Amount: 30, CoinId: 2 }, '1000', [{ ...document, CoinID: 2, TotalIncludeVAT: 30 }]);
    assert.equal(receipt?.amountMinor, 3000);
    assert.equal(receipt?.currency, 'USD');
    assert.equal(receipt?.ilsAmountMinor, 11800);
    assert.equal(receipt?.vatIlsMinor, 1800);
});

test('refund documents reverse gross and VAT once for positive or signed provider values', () => {
    for (const amount of [30, -30]) {
        const receipt = normalizeCardcomTransaction({ ...transaction, Amount: amount, CoinId: 2, DocumentType: 'TaxInvoiceAndReceiptRefund', IsRefund: true }, '1000', [{ ...document, InvoiceType: 2, CoinID: 2, TotalIncludeVAT: amount, IsNegetive: true, VATOnlyNIS: amount < 0 ? -18 : 18, TotalIncludeVATNIS: amount < 0 ? -118 : 118 }]);
        assert.equal(receipt?.kind, 'REFUND');
        assert.equal(receipt?.amountMinor, -3000);
        assert.equal(receipt?.ilsAmountMinor, -11800);
        assert.equal(receipt?.vatIlsMinor, -1800);
    }
});

test('source evidence refuses missing or ambiguous documents', () => {
    assert.throws(() => normalizeCardcomTransaction(transaction, '1000', []), /document.*incomplete/i);
    assert.throws(() => normalizeCardcomTransaction(transaction, '1000', [document, { ...document }]), /document.*incomplete/i);
});

test('source evidence refuses mismatched terminal document currency amount type and sign', () => {
    for (const change of [
        { Terminal_Number: 1001 }, { Invoice_Number: 710002 }, { CoinID: 2 }, { TotalIncludeVAT: 119 },
        { TotalIncludeVATNIS: 119 }, { VATOnlyNIS: undefined }, { VATOnlyNIS: NaN }, { VATOnlyNIS: 119 },
        { IsNegetive: true }, { InvoiceType: 3 }, { VATOnlyNIS: -18 },
    ]) assert.throws(() => normalizeCardcomTransaction(transaction, '1000', [{ ...document, ...change } as unknown as CardcomDocument]), /document.*incomplete/i);
    for (const change of [{ DocumentNumber: undefined }, { DocumentType: undefined }, { DocumentType: 'TaxInvoice' }, { Currency: 'USD' }, { TranzactionId: Number.MAX_SAFE_INTEGER + 1 }]) {
        assert.throws(() => normalizeCardcomTransaction({ ...transaction, ...change }, '1000', [document]), /document.*incomplete/i);
    }
});

test('receipt-only source documents preserve authoritative zero VAT', () => {
    assert.equal(normalizeCardcomTransaction({ ...transaction, DocumentType: 'Receipt' }, '1000', [{ ...document, InvoiceType: 3, VATOnlyNIS: 0 }])?.vatIlsMinor, 0);
});
