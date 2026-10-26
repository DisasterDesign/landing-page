export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, viewerErrorResponse } from '@/lib/auth/viewer';
import { buildFinanceReport, reportLens } from '@/lib/finance/report-data';
export async function GET(request: NextRequest) {
    try {
        const viewer = await requireAdmin();
        const report = await buildFinanceReport(viewer, reportLens(viewer, request.nextUrl.searchParams.get('book')));
        const rows = report.perClient;
        const totals = rows.reduce((s, r) => ({ amount: s.amount + r.amount, vat: s.vat + r.vat, cardcomFee: s.cardcomFee + r.cardcomFee, profit: s.profit + r.profit, partnerShare: s.partnerShare + r.partnerShare, royShare: s.royShare + r.royShare, eladShare: s.eladShare + r.eladShare }), { amount: 0, vat: 0, cardcomFee: 0, profit: 0, partnerShare: 0, royShare: 0, eladShare: 0 });
        const averages = Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, rows.length ? v / rows.length : 0]));
        return NextResponse.json({ ...report, rows, totals, averages, count: rows.length, expensesByCategory: Object.fromEntries(Object.entries(report.byCategory).map(([k, v]) => [k, v.total])) });
    }
    catch (error) {
        const auth = viewerErrorResponse(error);
        if (auth)
            return auth;
        throw error;
    }
}
