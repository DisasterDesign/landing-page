export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, viewerErrorResponse } from '@/lib/auth/viewer';
import { prisma } from '@/lib/prisma';
import { updateExpenseSchema } from '@/lib/validations';
import { financeExpenseScope } from '@/lib/finance/access';
import { sanitizeExpense } from '@/lib/finance/report';
export async function PATCH(request: NextRequest, { params }: {
    params: Promise<{
        id: string;
    }>;
}) {
    try {
        const viewer = await requireAdmin();
        const { id } = await params;
        const existing = await prisma.expense.findFirst({ where: { AND: [{ id }, financeExpenseScope(viewer)] } });
        if (!existing)
            return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
        const parsed = updateExpenseSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success)
            return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
        const { startedAt, clientId, clientProductId, financeBook, sharedBasisPoints, ...rest } = parsed.data;
        // Expense allocations are accounting snapshots. Change future billing by a new line, never rewrite history.
        if ((clientId !== undefined && (clientId || null) !== existing.clientId) || (clientProductId !== undefined && (clientProductId || null) !== existing.clientProductId) || (financeBook !== undefined && financeBook !== existing.financeBook) || (sharedBasisPoints !== undefined && sharedBasisPoints !== existing.sharedBasisPoints))
            return NextResponse.json({ error: 'Financial attribution is immutable; create a new expense for future billing' }, { status: 409 });
        const expense = await prisma.expense.update({ where: { id }, data: { ...rest, ...(startedAt !== undefined ? { startedAt: startedAt ? new Date(startedAt) : null } : {}) }, include: { client: { select: { id: true, name: true, number: true } } } });
        return NextResponse.json(sanitizeExpense(expense, viewer.isOwner));
    }
    catch (error) {
        const auth = viewerErrorResponse(error);
        if (auth)
            return auth;
        throw error;
    }
}
export async function DELETE(_request: NextRequest, { params }: {
    params: Promise<{
        id: string;
    }>;
}) {
    try {
        const viewer = await requireAdmin();
        const { id } = await params;
        const expense = await prisma.expense.findFirst({ where: { AND: [{ id }, financeExpenseScope(viewer)] }, select: { id: true } });
        if (!expense)
            return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
        // Soft deactivation retains payer and book evidence for historical settlement.
        await prisma.expense.update({ where: { id }, data: { active: false } });
        return NextResponse.json({ ok: true });
    }
    catch (error) {
        const auth = viewerErrorResponse(error);
        if (auth)
            return auth;
        throw error;
    }
}
