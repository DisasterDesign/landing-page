import { monthlyIls, toIls } from '@/lib/finance';
export type Book = 'PRIVATE' | 'SHARED' | 'UNASSIGNED';
export const roundMinor = (value: number) => Math.sign(value) * Math.round(Math.abs(value));
export const minor = (value: number) => roundMinor(value * 100);
export const major = (value: number) => value / 100;
export function allocateProfit(personalRevenue: number, sharedRevenue: number, personalCosts: number, sharedCosts: number) {
    const personalProfit = personalRevenue - personalCosts;
    const sharedProfit = sharedRevenue - sharedCosts;
    const partnerProfit = Math.trunc(sharedProfit / 2);
    return { personalProfit, sharedProfit, ownerProfit: personalProfit + sharedProfit - partnerProfit, partnerProfit };
}
export function sharedExpenseMinor(e: {
    financeBook: string;
    sharedBasisPoints?: number | null;
}, amount: number): number {
    if (e.financeBook === 'UNASSIGNED')
        return 0;
    const bps = e.sharedBasisPoints ?? (e.financeBook === 'SHARED' ? 10000 : 0);
    if (!Number.isInteger(bps) || bps < 0 || bps > 10000)
        throw new Error('Invalid shared allocation');
    return roundMinor(amount * bps / 10000);
}
export interface ExpenseLine {
    id: string;
    financeBook: string;
    sharedBasisPoints?: number | null;
    amount: number;
    currency: string;
    frequency: string;
    name: string;
    vendor: string;
    notes: string | null;
    clientId: string | null;
    category: string;
    active: boolean;
    isFixed: boolean;
    [key: string]: unknown;
}
/** Mixed supplier invoices never leave the owner boundary. Only the allocated line is public. */
export function sanitizeExpense<T extends ExpenseLine>(e: T, owner: boolean): (T & {
    monthlyIls: number;
    amountIls: number;
}) | null {
    const total = minor(toIls(e.amount, e.currency));
    const monthly = minor(monthlyIls(e));
    if (owner)
        return { ...e, monthlyIls: major(monthly), amountIls: major(total) };
    const shared = sharedExpenseMinor(e, total);
    if ((e.sharedBasisPoints ?? (e.financeBook === 'SHARED' ? 10000 : 0)) === 0 || e.financeBook === 'UNASSIGNED')
        return null;
    if (e.financeBook === 'SHARED' && (e.sharedBasisPoints === null || e.sharedBasisPoints === undefined || e.sharedBasisPoints === 10000))
        return { ...e, notes: null, monthlyIls: major(monthly), amountIls: major(total) };
    // Explicit allowlist. Raw invoice fields, timestamps and attachments are intentionally absent.
    return { id: e.id, name: 'הקצאת הוצאה משותפת', vendor: '', category: e.category, isFixed: e.isFixed, amount: major(shared), currency: 'ILS', frequency: e.frequency, clientId: null, client: null, clientProductId: null, paidById: e.paidById, notes: null, active: e.active, financeBook: 'SHARED', sharedBasisPoints: 10000, monthlyIls: major(sharedExpenseMinor(e, monthly)), amountIls: major(shared), allocationOnly: true } as unknown as T & {
        monthlyIls: number;
        amountIls: number;
    };
}

export function recordedExpenseTotals(rows:{amountIlsMinor:number;financeBook:string;sharedBasisPoints?:number|null;paidById:string}[],partners:Set<string>){
 let personalCostsMinor=0,sharedCostsMinor=0,partnerPaidSharedMinor=0,paymentCount=0;
 for(const p of rows){if(p.financeBook==='UNASSIGNED')continue;const shared=sharedExpenseMinor(p,p.amountIlsMinor);sharedCostsMinor+=shared;personalCostsMinor+=p.amountIlsMinor-shared;if(partners.has(p.paidById))partnerPaidSharedMinor+=shared;paymentCount++;}
 return {personalCostsMinor,sharedCostsMinor,partnerPaidSharedMinor,paymentCount};
}
