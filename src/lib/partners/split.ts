import type { Book } from '@/lib/clients/books';
export const ROY_SHARE_PCT = 50;
export type SplitOwner = {
    id: string;
    isOwner: boolean;
    revenueSharePct: number | null;
} | null;
export type SplitRule = {
    status: 'settled';
    book: Book;
    royPct: 0 | 50;
    basis: string;
} | {
    status: 'ambiguous';
    book: 'fuzion';
    royPct: null;
    readings: {
        settlement: 50;
        perRow: 0;
    };
    basis: string;
};
/** Explicit per-record book wins; user ownership never determines partner share. */
export function splitRuleFor(client: {
    partner: string | null;
    owner: SplitOwner;
    financeBook?: string;
}): SplitRule {
    const privateBook = client.financeBook === 'PRIVATE' || (!client.financeBook && client.partner === 'personal');
    if (privateBook)
        return { status: 'settled', book: 'personal', royPct: 0, basis: 'PRIVATE snapshot: owner keeps all profit' };
    if (client.financeBook === 'SHARED' || (!client.financeBook && client.partner === 'fuzion'))
        return { status: 'settled', book: 'fuzion', royPct: 50, basis: 'SHARED snapshot: half net profit after allocated shared costs' };
    return { status: 'ambiguous', book: 'fuzion', royPct: null, readings: { settlement: 50, perRow: 0 }, basis: 'UNASSIGNED: owner review required; exclude from partner money' };
}
