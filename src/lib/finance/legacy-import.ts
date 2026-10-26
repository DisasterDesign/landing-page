import type { FinanceBook } from '@prisma/client';
import { z } from 'zod';

const identifier = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const manifestEntry = z.object({
    accountId: identifier,
    recurringId: identifier.nullable(),
    name: z.string().trim().min(1).max(200),
    amountMinor: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    currency: z.string().regex(/^[A-Z]{3}$/),
    financeBook: z.enum(['PRIVATE', 'SHARED']),
    createIfMissing: z.boolean().optional().default(false),
}).strict();

export type LegacyImportEvidence = Omit<z.infer<typeof manifestEntry>, 'createIfMissing'> & { createIfMissing?: boolean };

/** Private evidence is supplied at runtime, never embedded in the application or repository. */
export function parseLegacyImportManifest(input: unknown) {
    const parsed = z.array(manifestEntry).nonempty().safeParse(input);
    if (!parsed.success || new Set(parsed.data.map(row => row.accountId)).size !== parsed.data.length) {
        throw new Error('Invalid private import manifest');
    }
    return parsed.data;
}

interface LegacyClient {
    id: string;
    name: string;
    partner: string;
    monthlyAmount: number | null;
    archivedAt: Date | null;
    cardcomAccountIds: number[];
    products: { id: string }[];
    agreements: { id: string; financeBook?: FinanceBook }[];
    status?: string;
    websiteUrl?: string | null;
    startDate?: Date | null;
    paymentDate?: Date | null;
}

export function planLegacyProducts(clients: LegacyClient[], manifest: readonly LegacyImportEvidence[] = []) {
    return clients.filter(c => !c.products.length).map(c => {
        const books = new Set(c.agreements.map(a => a.financeBook).filter(b => b && b !== 'UNASSIGNED'));
        const financeBook: FinanceBook = books.size > 1 ? 'UNASSIGNED' : books.size === 1 ? [...books][0]! : c.partner === 'personal' ? 'PRIVATE' : c.partner === 'fuzion' ? 'SHARED' : 'UNASSIGNED';
        const foreignCurrencies = [...new Set(manifest.filter(row => c.cardcomAccountIds.includes(row.accountId) && row.currency !== 'ILS').map(row => row.currency))];
        return {
            key: `legacy-product:${c.id}`,
            data: {
                id: `legacy-product-${c.id}`, clientId: c.id, name: c.name,
                monthlyAmount: foreignCurrencies.length ? null : c.monthlyAmount,
                financeBook, agreementId: c.agreements.length === 1 ? c.agreements[0].id : null,
                archivedAt: c.archivedAt, status: c.status ?? '', websiteUrl: c.websiteUrl ?? null,
                startDate: c.startDate ?? null, paymentDate: c.paymentDate ?? null,
                notes: foreignCurrencies.length
                    ? `Original billing currency ${foreignCurrencies.join(', ')}; ILS forecast unknown. No legal agreement fabricated.`
                    : `Legacy product from explicit client book ${c.partner}. No legal agreement fabricated.`,
            },
        };
    });
}

type PersonalImportOperation =
    | { type: 'EXISTING'; accountId: number; clientId: string; products: ReturnType<typeof planLegacyProducts> }
    | { type: 'CREATE_APPROVED'; accountId: number; clientId: string; evidence: z.infer<typeof manifestEntry> }
    | { type: 'REVIEW_NO_WRITE'; accountId: number };

export function planPersonalImport(clients: LegacyClient[], evidence: readonly LegacyImportEvidence[]): PersonalImportOperation[] {
    return parseLegacyImportManifest(evidence).map(row => {
        const matches = clients.filter(c => c.cardcomAccountIds.includes(row.accountId));
        if (matches.length > 1) throw new Error('Import has conflicting exact client mappings; no writes');
        if (matches.length === 1) {
            const client = matches[0];
            const expectedPartner = row.financeBook === 'PRIVATE' ? 'personal' : 'fuzion';
            if (client.partner !== expectedPartner) throw new Error('Import contradicts stored book; owner decision required');
            return { type: 'EXISTING', accountId: row.accountId, clientId: client.id, products: planLegacyProducts([client], [row]) };
        }
        return row.createIfMissing
            ? { type: 'CREATE_APPROVED', accountId: row.accountId, clientId: `legacy-cardcom-account-${row.accountId}`, evidence: row }
            : { type: 'REVIEW_NO_WRITE', accountId: row.accountId };
    });
}
