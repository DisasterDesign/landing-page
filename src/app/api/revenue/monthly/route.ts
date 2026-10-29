export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, viewerErrorResponse } from '@/lib/auth/viewer';
import {prisma} from '@/lib/prisma';
import {sharedExpenseMinor} from '@/lib/finance/report';
import { reportLens } from '@/lib/finance/report-data';
import { loadReceipts, receiptTotals } from '@/lib/finance/receipts';
export async function GET(request: NextRequest) {
    try {
        const viewer = await requireAdmin();
        const lens = reportLens(viewer, request.nextUrl.searchParams.get('book'));
        const requested = Number.parseInt(request.nextUrl.searchParams.get('months') ?? '12', 10);
        const months = Number.isInteger(requested) ? Math.min(Math.max(requested, 1), 36) : 12;
        const now = new Date();
        const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months + 1, 1));
        const sync=await prisma.financeSyncState.findUnique({where:{key:'cardcom:transactions'}});
        const rows = await loadReceipts(start, lens === 'personal' ? 'PRIVATE' : lens === 'fuzion' ? 'SHARED' : undefined);
        const paidExpenses = await prisma.financeExpensePayment.findMany({where:{paidAt:{gte:start,lte:now},...(viewer.isOwner?{financeBook:{not:'UNASSIGNED' as const}}:{OR:[{financeBook:'SHARED' as const},{financeBook:'PRIVATE' as const,sharedBasisPoints:{gt:0}}]})}});
        const paidCost = (p:typeof paidExpenses[number])=>{const shared=sharedExpenseMinor(p,p.amountIlsMinor);return lens==='personal'?p.amountIlsMinor-shared:lens==='fuzion'?shared:p.amountIlsMinor;};
        const key = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
        const data = Array.from({ length: months }, (_, i) => { const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1)); const month = key(date); const r = rows.filter(r => r.financeBook !== 'UNASSIGNED' && key(r.occurredAt) === month); const t = receiptTotals(r);const cost=paidExpenses.filter(p=>key(p.paidAt)===month).reduce((sum,p)=>sum+paidCost(p),0)/100;
            const periodEnd=new Date(Math.min(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,1),now.getTime()));
            const coverage=sync?.coveredFrom&&sync.coveredTo&&sync.coveredFrom<=date&&sync.coveredTo>=periodEnd?'COMPLETE':'PARTIAL'; return { month, coverage, subscriptions: receiptTotals(r.filter(r => r.source !== 'job' && r.source !== 'quote')).gross, jobs: receiptTotals(r.filter(r => r.source === 'job' || r.source === 'quote')).gross, revenue: t.gross, expenses: t.fee+cost, profit: t.profit-cost, unvaluedCount: t.unvaluedCount }; });
        return NextResponse.json({ viewer: { isOwner: viewer.isOwner }, data, trackedFrom: rows.length ? key(rows[0].occurredAt) : null, actual: true,feeEstimated:true,expenseTreatment:'RECORDED_PAYMENTS',coverage:{from:sync?.coveredFrom??null,to:sync?.coveredTo??null,status:sync?.status??'NOT_SYNCED'},partial:data.some(d=>d.coverage!=='COMPLETE') });
    }
    catch (error) {
        const auth = viewerErrorResponse(error);
        if (auth)
            return auth;
        throw error;
    }
}
