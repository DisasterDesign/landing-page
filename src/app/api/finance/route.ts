export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, viewerErrorResponse } from '@/lib/auth/viewer';
import { buildFinanceReport, reportLens } from '@/lib/finance/report-data';
export async function GET(request: NextRequest) {
    try {
        const viewer = await requireAdmin();
        return NextResponse.json(await buildFinanceReport(viewer, reportLens(viewer, request.nextUrl.searchParams.get('book'))));
    }
    catch (error) {
        const auth = viewerErrorResponse(error);
        if (auth)
            return auth;
        if (error instanceof Error && error.message === 'Invalid book')
            return NextResponse.json({ error: error.message }, { status: 400 });
        throw error;
    }
}
