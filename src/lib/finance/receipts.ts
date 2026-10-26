import { prisma } from '@/lib/prisma';
import { getCardcomConfig } from '@/lib/cardcom';
import { jobFinance } from '@/lib/finance';
import { deduplicateReceipts, type Receipt } from './transactions';
import { minor, roundMinor } from './report';
import type { FinanceBook, Prisma } from '@prisma/client';
/** Paid money only: never infer receipts from client totals or subscription start dates. */
export async function loadReceipts(from: Date, book?: FinanceBook): Promise<Receipt[]> {
    const terminalId = String(getCardcomConfig()?.terminal ?? 'legacy');
    const scoped = book ? { financeBook: book } : {};
    const [ledger, charges, quotes, jobs] = await Promise.all([
        prisma.financeTransaction.findMany({ where: { occurredAt: { gte: from }, ...scoped }, orderBy: { occurredAt: 'asc' } }),
        prisma.agreementCharge.findMany({ where: { success: true, agreement: scoped, OR: [{ cardcomChargeDate: { gte: from } }, { cardcomChargeDate: null, chargedAt: { gte: from } }] }, include: { agreement: { select: { id: true, kind: true, financeBook: true, clientId: true, vatExempt: true, cardcomVerifiedTransactionId: true } } } }),
        prisma.agreement.findMany({ where: { paymentStatus: 'COMPLETED', paidAt: { gte: from }, ...scoped }, select: { id: true, kind: true, financeBook: true, clientId: true, paidAmount: true, paidAt: true, vatExempt: true, cardcomVerifiedTransactionId: true, cardcomDealId: true } }),
        prisma.clientJob.findMany({ where: { status: 'PAID', paidAt: { gte: from }, ...scoped }, include: { client: { select: { vatExempt: true } } } }),
    ]);
    // A historical ledger receipt suppresses fallback rows even when its authoritative date/book lies outside this view.
    const providerIds = [...charges.flatMap(c => c.cardcomDealId ? [c.cardcomDealId] : []), ...quotes.flatMap(q => q.cardcomVerifiedTransactionId ? [q.cardcomVerifiedTransactionId] : q.cardcomDealId ? [q.cardcomDealId] : [])];
    const represented = new Set((await prisma.financeTransaction.findMany({ where: { provider: 'CARDCOM', terminalId, providerTransactionId: { in: providerIds } }, select: { providerTransactionId: true, kind: true } })).map(r => `${r.providerTransactionId}:${r.kind}`));
    const [ledgerAgreements, ledgerClients] = await Promise.all([
        prisma.agreement.findMany({ where: { id: { in: ledger.flatMap(l => l.agreementId ? [l.agreementId] : []) }, ...scoped }, select: { id: true, kind: true, vatExempt: true } }),
        prisma.client.findMany({ where: { id: { in: ledger.flatMap(l => l.clientId ? [l.clientId] : []) } }, select: { id: true, vatExempt: true } }),
    ]);
    const agreementById = new Map(ledgerAgreements.map(a => [a.id, a]));
    const clientById = new Map(ledgerClients.map(c => [c.id, c]));
    const result: Receipt[] = ledger.map(l => ({ ...l, source: l.agreementId && agreementById.get(l.agreementId)?.kind === 'ONE_TIME' ? 'quote' : 'ledger', vatExempt: (l.agreementId ? agreementById.get(l.agreementId)?.vatExempt : undefined) ?? (l.clientId ? clientById.get(l.clientId)?.vatExempt : undefined), feeApplies: true }));
    for (const c of charges) {
        const id = c.cardcomDealId ?? c.providerChargeKey ?? `charge:${c.id}`;
        if (represented.has(`${id}:${c.amount < 0 ? 'REFUND' : 'CHARGE'}`))
            continue;
        result.push({ provider: 'CARDCOM', terminalId, providerTransactionId: id, kind: c.amount < 0 ? 'REFUND' : 'CHARGE', amountMinor: minor(c.amount), currency: 'ILS', ilsAmountMinor: minor(c.amount), occurredAt: c.cardcomChargeDate ?? c.chargedAt, financeBook: c.agreement.financeBook, clientId: c.agreement.clientId, agreementId: c.agreementId, vatExempt: c.agreement.vatExempt, feeApplies: true, source: c.agreement.kind === 'ONE_TIME' ? 'quote' : 'charge' });
    }
    for (const q of quotes) {
        if (q.paidAmount == null || !q.paidAt)
            continue;
        if (represented.has(`${q.cardcomVerifiedTransactionId ?? q.cardcomDealId}:${q.paidAmount < 0 ? 'REFUND' : 'CHARGE'}`))
            continue;
        result.push({ provider: 'CARDCOM', terminalId, providerTransactionId: q.cardcomVerifiedTransactionId ?? q.cardcomDealId ?? `quote:${q.id}`, kind: q.paidAmount < 0 ? 'REFUND' : 'CHARGE', amountMinor: minor(q.paidAmount), currency: 'ILS', ilsAmountMinor: minor(q.paidAmount), occurredAt: q.paidAt, financeBook: q.financeBook, clientId: q.clientId, agreementId: q.id, vatExempt: q.vatExempt, feeApplies: true, source: q.kind === 'ONE_TIME' ? 'quote' : 'agreement' });
    }
    for (const j of jobs) {
        const f = jobFinance(j);
        if (j.client.vatExempt)
            f.gross = j.amount;
        result.push({ provider: 'MANUAL', terminalId: 'manual', providerTransactionId: j.id, kind: j.amount < 0 ? 'REFUND' : 'CHARGE', amountMinor: minor(f.gross), currency: 'ILS', ilsAmountMinor: minor(f.gross), occurredAt: j.paidAt!, financeBook: j.financeBook, clientId: j.clientId, vatExempt: j.client.vatExempt, feeApplies: j.cardcomFee, source: 'job' });
    }
    return deduplicateReceipts(result);
}
export function receiptTotals(rows: Receipt[]) {
    let gross = 0, vat = 0, fee = 0, unvaluedCount = 0, count = 0;
    for (const r of rows) {
        if (r.ilsAmountMinor == null) {
            unvaluedCount++;
            continue;
        }
        const a = r.ilsAmountMinor;
        gross += a;
        vat += r.vatExempt ? 0 : roundMinor(a * 18 / 118);
        fee += r.feeApplies === false ? 0 : roundMinor(a * .02);
        count++;
    }
    return { gross: gross / 100, vat: vat / 100, fee: fee / 100, net: (gross - vat) / 100, profit: (gross - vat - fee) / 100, count, unvaluedCount, feeEstimated: true };
}
export function receiptScope(owner: boolean, book?: FinanceBook): Prisma.FinanceTransactionWhereInput { return owner ? (book ? { financeBook: book } : {}) : { financeBook: 'SHARED' }; }
