export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, viewerErrorResponse } from "@/lib/auth/viewer";
import { prisma } from "@/lib/prisma";
import { updateExpenseSchema } from "@/lib/validations";

// PATCH /api/expenses/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
  } catch (error) {
    const authError = viewerErrorResponse(error);
    if (authError) return authError;
    throw error;
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateExpenseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { startedAt, clientId, ...rest } = parsed.data;
  try {
    const expense = await prisma.expense.update({
      where: { id },
      data: {
        ...rest,
        ...(clientId !== undefined ? { clientId: clientId || null } : {}),
        ...(startedAt !== undefined
          ? { startedAt: startedAt ? new Date(startedAt) : null }
          : {}),
      },
      include: { client: { select: { id: true, name: true, number: true } } },
    });
    return NextResponse.json(expense);
  } catch {
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }
}

// DELETE /api/expenses/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
  } catch (error) {
    const authError = viewerErrorResponse(error);
    if (authError) return authError;
    throw error;
  }

  const { id } = await params;
  try {
    await prisma.expense.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }
}
