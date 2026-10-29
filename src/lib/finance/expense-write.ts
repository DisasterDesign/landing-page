import { prisma } from '@/lib/prisma';
import type { Viewer } from '@/lib/auth/viewer';
import { ViewerAuthorizationError } from '@/lib/auth/viewer';
import { requireBookSelection, requireFinanceBookAccess, financeClientScope } from './access';
import type { FinanceBook } from '@prisma/client';
export async function expenseAttribution(viewer: Viewer, input: {
    clientId?: string | null;
    clientProductId?: string | null;
    financeBook?: FinanceBook;
    sharedBasisPoints?: number | null;
}) {
    const clientId = input.clientId || null, productId = input.clientProductId || null;
    let fallback: FinanceBook = 'SHARED';
    if (clientId) {
        const c = await prisma.client.findFirst({ where: { AND: [{ id: clientId }, financeClientScope(viewer)] }, select: { partner: true } });
        if (!c)
            throw new ViewerAuthorizationError('Forbidden', 403);
        fallback = c.partner === 'personal' ? 'PRIVATE' : c.partner === 'fuzion' ? 'SHARED' : 'UNASSIGNED';
    }
    if (productId) {
        const p = await prisma.clientProduct.findUnique({ where: { id: productId }, select: { clientId: true, financeBook: true } });
        if (!p || p.clientId !== clientId)
            throw new ViewerAuthorizationError('Forbidden', 403);
        requireFinanceBookAccess(viewer, p.financeBook);
        fallback = p.financeBook;
        if (input.financeBook && input.financeBook !== p.financeBook)
            throw new Error('Expense must follow product book');
    }
    const financeBook = requireBookSelection(viewer, input.financeBook, fallback);
    if (!viewer.isOwner && input.sharedBasisPoints != null && input.sharedBasisPoints !== 10000)
        throw new ViewerAuthorizationError('Forbidden', 403);
    return { clientId, clientProductId: productId, financeBook, sharedBasisPoints: input.sharedBasisPoints ?? null };
}
