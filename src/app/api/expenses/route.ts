export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, viewerErrorResponse } from '@/lib/auth/viewer';
import { prisma } from '@/lib/prisma';
import { createExpenseSchema } from '@/lib/validations';
import { sanitizeExpense } from '@/lib/finance/report';
import { expenseAttribution } from '@/lib/finance/expense-write';
export async function GET() { try {
    const viewer = await requireAdmin();
    const rows = await prisma.expense.findMany({ where: viewer.isOwner ? {} : { OR: [{ financeBook: 'SHARED' }, { financeBook: 'PRIVATE', sharedBasisPoints: { gt: 0 } }] }, include: { client: { select: { id: true, name: true, number: true } } }, orderBy: [{ active: 'desc' }, { createdAt: 'desc' }] });
    return NextResponse.json({ data: rows.map(e => sanitizeExpense(e, viewer.isOwner)).filter(e => e !== null), viewer: { isOwner: viewer.isOwner } });
}
catch (error) {
    const auth = viewerErrorResponse(error);
    if (auth)
        return auth;
    throw error;
} }
export async function POST(request: NextRequest) {
    try {
        const viewer = await requireAdmin();
        const parsed = createExpenseSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success)
            return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
        const { startedAt, clientId, clientProductId, financeBook, sharedBasisPoints, ...rest } = parsed.data;
        const attribution = await expenseAttribution(viewer, { clientId, clientProductId, financeBook, sharedBasisPoints });
        const expense = await prisma.expense.create({ data: { ...rest, ...attribution, startedAt: startedAt ? new Date(startedAt) : null, paidById: viewer.userId }, include: { client: { select: { id: true, name: true, number: true } } } });
        return NextResponse.json(sanitizeExpense(expense, viewer.isOwner), { status: 201 });
    }
    catch (error) {
        const auth = viewerErrorResponse(error);
        if (auth)
            return auth;
        if (error instanceof Error && error.message === 'Expense must follow product book')
            return NextResponse.json({ error: error.message }, { status: 400 });
        throw error;
    }
}
