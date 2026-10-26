import type { Viewer } from '@/lib/auth/viewer';
import { ViewerAuthorizationError } from '@/lib/auth/viewer';
import { prisma } from '@/lib/prisma';
import { financeClientScope } from './access';
import { monthlyIls, jobFinance } from '@/lib/finance';
import { major, minor, roundMinor, allocateProfit, sharedExpenseMinor, sanitizeExpense, recordedExpenseTotals } from './report';
import { loadReceipts, receiptTotals } from './receipts';
export function reportLens(viewer: Viewer, requested: string | null) {
    const lens = requested ?? (viewer.isOwner ? 'combined' : 'fuzion');
    if (!['personal', 'fuzion', 'combined', 'mine'].includes(lens))
        throw new Error('Invalid book');
    if (!viewer.isOwner && lens !== 'fuzion')
        throw new ViewerAuthorizationError('Forbidden', 403);
    return lens;
}
export async function buildFinanceReport(viewer: Viewer, lens: string, period?: { from: Date; to: Date }) {
    reportLens(viewer, lens);
    const now = new Date();
    const start = period?.from ?? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = new Date(Math.min(period?.to.getTime() ?? Infinity, now.getTime() + 1));
    const [clients, expenseRows, pending, receipts, sync, unassignedTransactions, expensePayments] = await Promise.all([
        prisma.client.findMany({ where: { AND: [financeClientScope(viewer), { archivedAt: null, status: 'בוצע' }] }, include: { _count: { select: { products: true } }, products: { where: viewer.isOwner ? {} : { financeBook: 'SHARED' } }, agreements: { where: viewer.isOwner ? {} : { financeBook: 'SHARED' }, select: { id: true, kind: true, financeBook: true } } }, orderBy: { name: 'asc' } }),
        prisma.expense.findMany({ where: viewer.isOwner ? {} : { OR: [{ financeBook: 'SHARED' }, { financeBook: 'PRIVATE', sharedBasisPoints: { gt: 0 } }] }, include: { client: { select: { id: true, name: true, number: true } }, paidBy: { select: { isOwner: true } } }, orderBy: [{ active: 'desc' }, { createdAt: 'desc' }] }),
        prisma.clientJob.findMany({ where: { status: 'PENDING', ...(viewer.isOwner ? {} : { financeBook: 'SHARED' as const }) } }),
        loadReceipts(start, viewer.isOwner ? (lens === 'personal' ? 'PRIVATE' : lens === 'fuzion' ? 'SHARED' : undefined) : 'SHARED', end),
        prisma.financeSyncState.findUnique({ where: { key: 'cardcom:transactions' } }),
        viewer.isOwner ? prisma.financeTransaction.findMany({ where: { financeBook: 'UNASSIGNED' }, take: 100, orderBy: { occurredAt: 'desc' } }) : Promise.resolve([]),
        prisma.financeExpensePayment.findMany({where:{paidAt:{gte:start,lt:end},...(viewer.isOwner?{}:{OR:[{financeBook:'SHARED' as const},{financeBook:'PRIVATE' as const,sharedBasisPoints:{gt:0}}]})}}),
    ]);
    const summaries = { personal: { clientCount: 0, amount: 0, profit: 0, partnerShare: 0, costs: 0 }, fuzion: { clientCount: 0, amount: 0, profit: 0, partnerShare: 0, costs: 0 } };
    const selected = (book: string) => book !== 'UNASSIGNED' && (lens === 'combined' || lens === 'mine' || (lens === 'personal' ? book === 'PRIVATE' : book === 'SHARED'));
    const expenses = expenseRows.map(e => sanitizeExpense(e, viewer.isOwner && lens !== 'fuzion')).filter(e => e !== null);
    const byCategory: Record<string, {
        total: number;
        fixed: number;
        variable: number;
        count: number;
    }> = {};
    let fixed = 0, variable = 0, personalCosts = 0, sharedCosts = 0, partnerPaidShared = 0;
    const attributed = new Map<string, number>();
    for (const e of expenseRows) {
        if (!e.active || e.financeBook === 'UNASSIGNED')
            continue;
        const amount = minor(monthlyIls(e));
        const shared = sharedExpenseMinor(e, amount);
        const personal = amount - shared;
        sharedCosts += shared;
        personalCosts += personal;
        if (e.paidBy?.isOwner === false)
            partnerPaidShared += shared;
        const chosen = lens === 'personal' ? personal : lens === 'fuzion' ? shared : amount;
        if (e.isFixed)
            fixed += chosen;
        else
            variable += chosen;
        if (chosen === 0)
            continue;
        const cat = byCategory[e.category] ??= { total: 0, fixed: 0, variable: 0, count: 0 };
        cat.total += major(chosen);
        cat.count++;
        if (e.isFixed)
            cat.fixed += major(chosen);
        else
            cat.variable += major(chosen);
        if (e.clientId)
            attributed.set(e.clientId, (attributed.get(e.clientId) ?? 0) + chosen);
    }
    const perClient = [];
    let vatTotal = 0, feeTotal = 0, personalRevenue = 0, sharedRevenue = 0, forecastUnvaluedCount = 0;
    for (const c of clients) {
        // Product snapshots govern mixed clients. Fallback only for rows predating products, never cumulative amount.
        const agreementBooks=new Set(c.agreements.map(a=>a.financeBook));
        const safeLegacy=viewer.isOwner&&agreementBooks.size<=1;
        if(!c._count.products&&!safeLegacy&&c.agreements.some(a=>a.kind==='SUBSCRIPTION'))forecastUnvaluedCount++;
        const products = c._count.products ? c.products.filter(p => !p.archivedAt && p.status === 'בוצע') : safeLegacy?[{ monthlyAmount: c.monthlyAmount, financeBook: agreementBooks.size===1?[...agreementBooks][0]:c.partner === 'personal' ? 'PRIVATE' : c.partner === 'fuzion' ? 'SHARED' : 'UNASSIGNED' }]:[];
        let amount = 0, vat = 0, fee = 0, sharedRowProfit = 0;
        const seenBooks = new Set<string>();
        for (const p of products) {
            if (p.financeBook === 'UNASSIGNED' || (!viewer.isOwner && p.financeBook !== 'SHARED'))
                continue;
            if (p.monthlyAmount == null && selected(p.financeBook))
                forecastUnvaluedCount++;
            const a = minor(p.monthlyAmount ?? 0), v = c.vatExempt ? 0 : roundMinor(a * 18 / 118), f = roundMinor(a * .02);
            const summary = p.financeBook === 'PRIVATE' ? summaries.personal : summaries.fuzion;
            summary.amount += a;
            summary.profit += a - v - f;
            seenBooks.add(p.financeBook);
            if (p.financeBook === 'PRIVATE')
                personalRevenue += a - v - f;
            else
                sharedRevenue += a - v - f;
            if (selected(p.financeBook)) {
                amount += a;
                vat += v;
                fee += f;
                if (p.financeBook === 'SHARED')
                    sharedRowProfit += a - v - f;
            }
        }
        for (const book of seenBooks)
            (book === 'PRIVATE' ? summaries.personal : summaries.fuzion).clientCount++;
        if (![...seenBooks].some(selected))
            continue;
        const direct = attributed.get(c.id) ?? 0;
        const net = amount - vat - fee - direct;
        vatTotal += vat;
        feeTotal += fee;
        perClient.push({ id: c.id, number: c.number, name: c.name, mrr: major(amount), vat: major(vat), cardcomFee: major(fee), directExpenses: major(direct), net: major(net), marginPct: amount ? net / amount * 100 : 0, amount: major(amount), profit: major(amount - vat - fee), partnerShare: major(Math.trunc(sharedRowProfit / 2)), royShare: major(Math.trunc(sharedRowProfit / 2)), eladShare: major(amount - vat - fee - Math.trunc(sharedRowProfit / 2)), paymentDate: viewer.isOwner?c.paymentDate?.toISOString()??null:null, book: seenBooks.size === 1 ? (seenBooks.has('PRIVATE') ? 'personal' : 'fuzion') : 'mixed' });
    }
    const allocation = allocateProfit(personalRevenue, sharedRevenue, personalCosts, sharedCosts);
    summaries.personal.costs = personalCosts;
    summaries.fuzion.costs = sharedCosts;
    for (const [key, b] of Object.entries(summaries)) {
        b.profit -= b.costs;
        b.partnerShare = key === 'fuzion' ? Math.trunc(b.profit / 2) : 0;
        for (const field of ['amount', 'profit', 'partnerShare', 'costs'] as const)
            b[field] = major(b[field]);
    }
    const books = viewer.isOwner ? { personal: { ...summaries.personal, count: summaries.personal.clientCount }, fuzion: { ...summaries.fuzion, count: summaries.fuzion.clientCount } } : { fuzion: { ...summaries.fuzion, count: summaries.fuzion.clientCount } };
    const totalMrr = perClient.reduce((s, c) => s + c.mrr, 0);
    const grossProfit = totalMrr - major(vatTotal + feeTotal);
    const totalExpensesMonthly = major(fixed + variable);
    const chosenReceipts = receipts.filter(r => selected(r.financeBook));
    const actual = receiptTotals(chosenReceipts);
    const oneOffIncomeThisMonth = receiptTotals(chosenReceipts.filter(r => r.source === 'job' || r.source === 'quote')).profit;
    const payers=await prisma.user.findMany({where:{id:{in:expensePayments.map(p=>p.paidById)},isOwner:false},select:{id:true}});
    const partnerPayers=new Set(payers.map(p=>p.id));
    const visiblePayments=expensePayments.filter(p=>{const bps=p.sharedBasisPoints??(p.financeBook==='SHARED'?10000:0);return p.financeBook!=='UNASSIGNED'&&((selected('PRIVATE')&&bps<10000)||(selected('SHARED')&&bps>0));});
    const paidIds=new Set(visiblePayments.map(p=>p.expenseId));
    const unrecordedExpenseCount=expenseRows.filter(e=>{const bps=e.sharedBasisPoints??(e.financeBook==='SHARED'?10000:0);return e.active&&e.financeBook!=='UNASSIGNED'&&!paidIds.has(e.id)&&((selected('PRIVATE')&&bps<10000)||(selected('SHARED')&&bps>0));}).length;
    const paymentTotals=(payments:typeof visiblePayments)=>{
     const totals=recordedExpenseTotals(payments,partnerPayers);
     if(!selected('PRIVATE'))totals.personalCostsMinor=0;
     if(!selected('SHARED')){totals.sharedCostsMinor=0;totals.partnerPaidSharedMinor=0;}
     return totals;
    };
    const receiptAllocation=(rows:typeof chosenReceipts,payments:typeof visiblePayments)=>{
     const costs=paymentTotals(payments);
     const allocated=allocateProfit(minor(receiptTotals(rows.filter(r=>r.financeBook==='PRIVATE')).profit),minor(receiptTotals(rows.filter(r=>r.financeBook==='SHARED')).profit),costs.personalCostsMinor,costs.sharedCostsMinor);
     return {...(viewer.isOwner?{personalProfit:major(allocated.personalProfit),ownerProfit:major(allocated.ownerProfit),personalCosts:major(costs.personalCostsMinor)}:{}),sharedProfit:major(allocated.sharedProfit),partnerProfit:major(allocated.partnerProfit),myProfit:major(viewer.isOwner?allocated.ownerProfit:allocated.partnerProfit),sharedCosts:major(costs.sharedCostsMinor),recordedPaymentCount:costs.paymentCount,unrecordedExpenseCount,expenseTreatment:'AFTER_RECORDED_PAYMENTS',expenseCoverage:payments.length?'RECORDED_PAYMENTS_ONLY':'NOT_RECORDED',incomplete:unrecordedExpenseCount>0||rows.some(r=>r.ilsAmountMinor==null),feeEstimated:true};
    };
    const actualAllocation=receiptAllocation(chosenReceipts,visiblePayments);
    const oneOffAllocation=receiptAllocation(chosenReceipts.filter(r=>r.source==='job'||r.source==='quote'),visiblePayments.filter(p=>p.frequency==='ONE_TIME'));
    const paidCosts=paymentTotals(visiblePayments);
    const actualSettlement={basis:'RECORDED_PAYMENTS',sharedExpenses:major(paidCosts.sharedCostsMinor),profit:actualAllocation.sharedProfit,royEntitlement:actualAllocation.partnerProfit,partnerPaidShared:major(paidCosts.partnerPaidSharedMinor),transferToRoy:actualAllocation.partnerProfit+major(paidCosts.partnerPaidSharedMinor),incomplete:actualAllocation.incomplete,feeEstimated:true};
    const oneOffOutstanding = pending.filter(p => selected(p.financeBook)).reduce((s, j) => s + jobFinance(j).gross, 0);
    return { snapshotAt: now.toISOString(), forecastUnvaluedCount, viewer: { isOwner: viewer.isOwner }, forecast: true, lens, books, ...(viewer.isOwner ? { personalProfit: major(allocation.personalProfit) } : {}), myProfit: major(viewer.isOwner ? (lens === 'personal' ? allocation.personalProfit : lens === 'fuzion' ? allocation.sharedProfit - allocation.partnerProfit : allocation.ownerProfit) : allocation.partnerProfit),
        bottomLine: { totalMrr, totalVat: major(vatTotal), totalCardcomFee: major(feeTotal), grossProfit, fixedMonthly: major(fixed), variableMonthly: major(variable), totalExpensesMonthly, oneOffIncomeThisMonth, oneOffOutstanding, netProfit: grossProfit - totalExpensesMonthly, partnerShareBeforeExpenses: major(Math.trunc(sharedRevenue / 2)), partnerShareAfterExpenses: major(allocation.partnerProfit), clientCount: perClient.length },
        actual, actualAllocation, oneOffAllocation, actualSettlement, receipts: actual, ...(viewer.isOwner ? { unassignedTransactions, unassignedExpenseCount:expenseRows.filter(e=>e.active&&e.financeBook==='UNASSIGNED').length } : {}), sync: { status: sync?.status ?? 'NOT_SYNCED', lastSuccessAt: sync?.lastSuccessAt ?? null, stale: !sync?.lastSuccessAt || now.getTime() - sync.lastSuccessAt.getTime() > 36 * 60 * 60 * 1000, ...(viewer.isOwner ? { error: sync?.error ?? null } : {}) },
        settlement: { basis:'FORECAST_ONLY', sharedExpenses: major(sharedCosts), ...(viewer.isOwner ? { personalExpenses: major(personalCosts) } : {}), profit: major(allocation.sharedProfit), royEntitlement: major(allocation.partnerProfit), transferToRoy: major(allocation.partnerProfit + partnerPaidShared) },
        byCategory, perClient, unknownAmounts: expenses.filter(e => e.active && e.amount === 0).map(e => ({ id: e.id, name: e.name, vendor: e.vendor, notes: e.notes })), expenses: expenses.filter(e => selected(e.financeBook) || ((lens === 'combined' || lens === 'mine') && viewer.isOwner)) };
}
