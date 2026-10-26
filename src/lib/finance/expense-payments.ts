import { z } from "zod";
import type { Viewer } from "@/lib/auth/viewer";
import { prisma } from "@/lib/prisma";
import { FinanceAccessError, financeExpenseScope } from "./access";

export class ExpensePaymentError extends Error {
  constructor(message: string, readonly status: 400 | 404 | 409) {
    super(message);
    this.name = "ExpensePaymentError";
  }
}

const paymentInput = z.object({
  paymentKey: z.string().uuid().toLowerCase(),
  amountIls: z.number().positive().max(21474836.47).multipleOf(0.01),
  paidAt: z.string().datetime({ offset: true }),
  reference: z.string().trim().max(500).nullable().optional(),
  paidById: z.string().min(1).optional(),
});

type PaymentDatabase = Pick<typeof prisma, "expense" | "financeExpensePayment" | "user">;

/** Records evidence only; this function never charges a provider or changes a forecast line. */
export async function recordExpensePayment(
  viewer: Viewer,
  expenseId: string,
  input: unknown,
  dependencies: { db?: PaymentDatabase; now?: Date } = {},
) {
  if (viewer.role !== "ADMIN") throw new FinanceAccessError();
  if (!viewer.isOwner && input && typeof input === "object" && "paidById" in input) throw new FinanceAccessError();
  const parsed = paymentInput.safeParse(input);
  if (!parsed.success) throw new ExpensePaymentError("Invalid payment input", 400);
  const data = parsed.data;
  const paidAt = new Date(data.paidAt);
  const now = dependencies.now ?? new Date();
  if (paidAt.getTime() > now.getTime() + 24 * 60 * 60 * 1000) throw new ExpensePaymentError("Invalid future payment date", 400);
  const db = dependencies.db ?? prisma;
  const expense = await db.expense.findFirst({
    where: { AND: [{ id: expenseId }, { financeBook: { in: ["PRIVATE", "SHARED"] } }, financeExpenseScope(viewer)] },
  });
  if (!expense || (expense.financeBook !== "PRIVATE" && expense.financeBook !== "SHARED") || (!viewer.isOwner && (expense.financeBook !== "SHARED" || (expense.sharedBasisPoints !== null && expense.sharedBasisPoints !== 10000)))) {
    throw new ExpensePaymentError("Expense not found or not classified", 404);
  }
  let paidById = expense.paidById ?? viewer.userId;
  if (viewer.isOwner && data.paidById) {
    const payer = await db.user.findUnique({ where: { id: data.paidById }, select: { id: true, role: true, isOwner: true } });
    if (!payer || (payer.role !== "ADMIN" && !payer.isOwner)) throw new ExpensePaymentError("Invalid payer", 400);
    paidById = payer.id;
  }
  const snapshot = {
    expenseId,
    paymentKey: data.paymentKey,
    amountIlsMinor: Math.round(data.amountIls * 100),
    paidAt,
    financeBook: expense.financeBook,
    sharedBasisPoints: expense.sharedBasisPoints,
    clientId: expense.clientId,
    clientProductId: expense.clientProductId,
    frequency: expense.frequency,
    paidById,
    reference: data.reference || null,
    source: "MANUAL",
  };
  const resolveReplay = (payment: NonNullable<Awaited<ReturnType<typeof db.financeExpensePayment.findUnique>>>) => {
    const same = payment.expenseId === expenseId && payment.amountIlsMinor === snapshot.amountIlsMinor && payment.paidAt.getTime() === paidAt.getTime() && payment.reference === snapshot.reference && payment.paidById === paidById;
    if (!same) throw new ExpensePaymentError("Payment key conflict", 409);
    return { payment, replay: true };
  };
  const existing = await db.financeExpensePayment.findUnique({ where: { paymentKey: data.paymentKey } });
  if (existing) return resolveReplay(existing);
  try {
    const payment = await db.financeExpensePayment.create({ data: snapshot });
    return { payment, replay: false };
  } catch (error) {
    // Concurrent identical requests are protected by the persisted unique key.
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      const raced = await db.financeExpensePayment.findUnique({ where: { paymentKey: data.paymentKey } });
      if (raced) return resolveReplay(raced);
    }
    throw error;
  }
}
