import type { Prisma, PrismaClient } from "@prisma/client";
import type { Viewer } from "@/lib/auth/viewer";
import { prisma } from "@/lib/prisma";
import { FinanceAccessError, financeAgreementScope } from "./access";

/** Brief task links predate finance books and are stored as commission scalar ids. */
export async function financeTaskScope(viewer: Viewer, db: PrismaClient | Prisma.TransactionClient = prisma): Promise<Prisma.TaskWhereInput> {
  if (viewer.isOwner) return {};
  const links = await db.sellerCommission.findMany({ where: { briefTaskId: { not: null } }, select: { briefTaskId: true, agreementId: true, agreementRefId: true } });
  if (links.length === 0) return {};
  const allowed = await db.agreement.findMany({ where: { id: { in: links.map(link => link.agreementRefId ?? link.agreementId) }, ...financeAgreementScope(viewer) }, select: { id: true } });
  const allowedIds = new Set(allowed.map(row => row.id));
  return { id: { notIn: links.filter(link => !allowedIds.has(link.agreementRefId ?? link.agreementId)).map(link => link.briefTaskId!) } };
}
export async function requireFinanceTaskAccess(viewer: Viewer, taskId: string): Promise<void> {
  const scope = await financeTaskScope(viewer);
  const task = await prisma.task.findFirst({ where: { AND: [{ id: taskId }, scope] }, select: { id: true } });
  if (!task) throw new FinanceAccessError();
}
