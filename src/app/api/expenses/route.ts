export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  PersistedRoleAuthorizationError,
  requirePersistedUserRole,
} from "@/lib/auth/persisted-role";
import { prisma } from "@/lib/prisma";
import { createExpenseSchema } from "@/lib/validations";

// GET /api/expenses — all expense lines, newest first
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await requirePersistedUserRole(session.user.id, ["ADMIN"]);
  } catch (error) {
    if (error instanceof PersistedRoleAuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
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
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    await requirePersistedUserRole(session.user.id, ["ADMIN"]);
  } catch (error) {
    if (error instanceof PersistedRoleAuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
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
    },
    include: { client: { select: { id: true, name: true, number: true } } },
  });

  return NextResponse.json(expense, { status: 201 });
}
