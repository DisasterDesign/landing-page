export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, viewerErrorResponse } from "@/lib/auth/viewer";
import { prisma } from "@/lib/prisma";
import { createExpenseSchema } from "@/lib/validations";

// GET /api/expenses — all expense lines, newest first
export async function GET() {
  try {
    await requireAdmin();
  } catch (error) {
    const authError = viewerErrorResponse(error);
    if (authError) return authError;
    throw error;
  }

  const expenses = await prisma.expense.findMany({
    include: { client: { select: { id: true, name: true, number: true } } },
    orderBy: [{ active: "desc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ data: expenses });
}

// POST /api/expenses — create an expense line
export async function POST(request: NextRequest) {
  let viewerUserId: string;
  try {
    viewerUserId = (await requireAdmin()).userId;
  } catch (error) {
    const authError = viewerErrorResponse(error);
    if (authError) return authError;
    throw error;
  }

  const body = await request.json().catch(() => null);
  const parsed = createExpenseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { startedAt, clientId, ...rest } = parsed.data;
  const expense = await prisma.expense.create({
    data: {
      ...rest,
      clientId: clientId || null,
      startedAt: startedAt ? new Date(startedAt) : null,
      // The payer is whoever entered the row — Roy typing in his campaign
      // spend gets credited automatically; the settlement reimburses him.
      paidById: viewerUserId,
    },
    include: { client: { select: { id: true, name: true, number: true } } },
  });

  return NextResponse.json(expense, { status: 201 });
}
