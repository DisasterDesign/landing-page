import assert from 'node:assert/strict';
import test from 'node:test';
import * as subject from './cardcom-documents';

const cfg = { terminal: 1000, apiName: 'synthetic-api', apiPassword: 'synthetic-password' };
const dates = { fromDate: new Date('2026-04-01T00:00:00Z'), toDate: new Date('2026-05-01T00:00:00Z'), coinIds: [1] };
const doc = (n: number) => ({ Terminal_Number: 1000, Invoice_Number: n, InvoiceType: 1, CoinID: 1, TotalIncludeVAT: 118, TotalIncludeVATNIS: 118, VATOnlyNIS: 18, IsNegetive: false });

test('document read requests every page and explicit currency and every document open state', async () => {
    assert.equal(typeof subject.listCardcomDocuments, 'function');
    const pages: number[] = [];
    const fetcher: typeof fetch = async (url, init) => {
        assert.equal(String(url), 'https://secure.cardcom.solutions/api/v11/Documents/GetReport');
        assert.equal(init?.method, 'POST');
        const body = JSON.parse(String(init?.body));
        assert.equal(body.FromDateYYYYMMDD, '20260401');
        assert.equal(body.ToDateYYYYMMDD, '20260501');
        assert.equal(body.DocType, -2);
        assert.equal(body.CoinId, 1);
        assert.equal(body.OpenClose, 0);
        assert.equal(body.ItemsPerPage, 100);
        pages.push(body.PageNumber);
        return Response.json({ ResponseCode: 0, Page: body.PageNumber, Count: 101, Documents: body.PageNumber === 1 ? Array.from({ length: 100 }, (_, i) => doc(710001 + i)) : [doc(710101)] });
    };
    const rows = await subject.listCardcomDocuments(dates, { config: cfg, fetcher });
    assert.equal(rows.length, 101);
    assert.deepEqual(pages, [1, 2]);
});

test('document read refuses malformed pagination and response errors without partial results', async () => {
    assert.equal(typeof subject.listCardcomDocuments, 'function');
    for (const response of [
        { ResponseCode: 1, Page: 1, Count: 0, Documents: [] },
        { ResponseCode: 0, Page: 2, Count: 1, Documents: [doc(710001)] },
        { ResponseCode: 0, Page: 1, Count: 2, Documents: [doc(710001)] },
        { ResponseCode: 0, Page: 1, Count: 0, Documents: null },
    ]) await assert.rejects(() => subject.listCardcomDocuments(dates, { config: cfg, fetcher: async () => Response.json(response) }), /document.*incomplete/i);
    await assert.rejects(() => subject.listCardcomDocuments(dates, { config: cfg, fetcher: async () => new Response('', { status: 500 }) }), /document.*incomplete/i);
});


test('explicit ILS and USD reports retain receipts when the provider all-currency filter returns empty', async () => {
    const requested: number[] = [];
    const rows = await subject.listCardcomDocuments({ ...dates, coinIds: [1, 2] }, { config: cfg, fetcher: async (_url, init) => {
        const { CoinId } = JSON.parse(String(init?.body));
        requested.push(CoinId);
        return Response.json({ ResponseCode: 0, Count: CoinId === 0 ? 0 : 1, Documents: CoinId === 0 ? [] : [{ ...doc(710001 + CoinId), CoinID: CoinId }] });
    } });
    assert.deepEqual(requested, [1, 2]);
    assert.equal(rows.length, 2);
    assert.deepEqual(rows.map(row => row.CoinID), [1, 2]);
});
