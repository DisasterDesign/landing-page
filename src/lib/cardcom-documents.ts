import { getCardcomConfig } from './cardcom';
import type { CardcomDocument } from './finance/document-evidence';

const PAGE_SIZE = 100;
const MAX_PAGES = 20;
const incomplete = (): never => { throw new Error('Cardcom document report incomplete; sync incomplete'); };

/** Read-only v11 document report. Explicit currency queries avoid the unreliable all-currency filter;
 * all document/open-state filters retain receipt-only and refund evidence.
 * Contract: https://secure.cardcom.solutions/swagger/v11/swagger.json
 */
export async function listCardcomDocuments(input: { fromDate: Date; toDate: Date; coinIds: readonly number[] }, dependencies: {
    config?: ReturnType<typeof getCardcomConfig>;
    fetcher?: typeof fetch;
} = {}): Promise<CardcomDocument[]> {
    if (!Number.isFinite(input.fromDate.getTime()) || !Number.isFinite(input.toDate.getTime()) || input.fromDate >= input.toDate) return incomplete();
    const cfg = dependencies.config === undefined ? getCardcomConfig() : dependencies.config;
    if (!cfg) return incomplete();
    const fetcher = dependencies.fetcher ?? fetch;
    const all: CardcomDocument[] = [];
    if (!input.coinIds.length || input.coinIds.some(coin => ![1, 2, 978].includes(coin))) return incomplete();
    for (const coinId of new Set(input.coinIds)) {
        let total: number | undefined;
        let covered = 0;
        const seenDocuments = new Set<string>();
        for (let page = 1; page <= MAX_PAGES; page++) {
            const response = await fetcher('https://secure.cardcom.solutions/api/v11/Documents/GetReport', {
                method: 'POST', signal: AbortSignal.timeout(15_000), headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ApiName: cfg.apiName, ApiPassword: cfg.apiPassword,
                    FromDateYYYYMMDD: input.fromDate.toISOString().slice(0, 10).replaceAll('-', ''),
                    ToDateYYYYMMDD: input.toDate.toISOString().slice(0, 10).replaceAll('-', ''),
                    DocType: -2, CoinId: coinId, OpenClose: 0, PageNumber: page, ItemsPerPage: PAGE_SIZE }),
            });
            if (!response.ok) return incomplete();
            const json = await response.json();
            if (json?.ResponseCode !== 0 || (json.Page != null && json.Page !== page) || !Number.isSafeInteger(json.Count) || json.Count < 0 || !Array.isArray(json.Documents) || json.Documents.length > PAGE_SIZE || json.Documents.some((doc: unknown) => !doc || typeof doc !== 'object')) return incomplete();
            if (total !== undefined && total !== json.Count) return incomplete();
            total = json.Count;
            for (const doc of json.Documents) {
                const key = JSON.stringify([doc.Terminal_Number, doc.Invoice_Number, doc.InvoiceType]);
                if (seenDocuments.has(key) || doc.CoinID !== coinId || String(doc.Terminal_Number) !== String(cfg.terminal)) return incomplete();
                seenDocuments.add(key);
            }
            all.push(...json.Documents);
            covered += json.Documents.length;
            if (covered > total!) return incomplete();
            if (covered === total) break;
            if (json.Documents.length < PAGE_SIZE) return incomplete();
        }
        if (covered !== total) return incomplete();
    }
    return all;
}
