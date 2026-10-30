import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, viewerErrorResponse } from '@/lib/auth/viewer';
import { buildCashSettlement, CashAccessError } from '@/lib/finance/cash-data';
import type { CashPeriodInput } from '@/lib/finance/cash-period';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest) {
  try {
    const viewer=await requireAdmin();
    const query=Object.fromEntries(request.nextUrl.searchParams);
    if(Object.keys(query).some(k=>!['from','to','timezone','asOf'].includes(k)))return NextResponse.json({error:'Invalid settlement query'},{status:400});
    const report=await buildCashSettlement(viewer,query as CashPeriodInput);
    return NextResponse.json(report,{headers:{'Cache-Control':'private, no-store'}});
  } catch(error) {
    const auth=viewerErrorResponse(error);if(auth)return auth;
    if(error instanceof CashAccessError)return NextResponse.json({error:'Forbidden'},{status:403});
    // Only input errors are exposed. Operational failures never look like an empty report.
    if(error instanceof Error&&/date|timestamp|period|boundaries|timezone|cutoff/i.test(error.message))return NextResponse.json({error:'Invalid settlement period'},{status:400});
    throw error;
  }
}
