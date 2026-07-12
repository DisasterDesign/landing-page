export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateJobSchema } from "@/lib/validations";

// PATCH /api/jobs/[id] — edit a job or mark it paid/unpaid.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateJobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const d = parsed.data;

  const data: Record<string, unknown> = {};
  if (d.title !== undefined) data.title = d.title.trim();
  if (d.amount !== undefined) data.amount = d.amount;
  if (d.vatIncluded !== undefined) data.vatIncluded = d.vatIncluded;
  if (d.cardcomFee !== undefined) data.cardcomFee = d.cardcomFee;
  if (d.closedAt !== undefined) data.closedAt = new Date(d.closedAt);
  if (d.paymentTermsDays !== undefined) data.paymentTermsDays = d.paymentTermsDays;
  if (d.notes !== undefined) data.notes = d.notes?.trim() || null;

  // paidAt and status kept consistent: setting a paidAt marks PAID; clearing
  // it (or status PENDING) reverts to outstanding.
  if (d.paidAt !== undefined) {
    data.paidAt = d.paidAt ? new Date(d.paidAt) : null;
    data.status = d.paidAt ? "PAID" : "PENDING";
  }
  if (d.status !== undefined) {
    data.status = d.status;
    if (d.status === "PAID" && d.paidAt === undefined) data.paidAt = new Date();
    if (d.status === "PENDING") data.paidAt = null;
  }

  try {
    const job = await prisma.clientJob.update({
      where: { id },
      data,
      include: { client: { select: { id: true, name: true, number: true } } },
    });
    return NextResponse.json(job);
  } catch {
    return NextResponse.json({ error: "העבודה לא נמצאה" }, { status: 404 });
  }
}

// DELETE /api/jobs/[id]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  try {
    await prisma.clientJob.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "העבודה לא נמצאה" }, { status: 404 });
  }
}
