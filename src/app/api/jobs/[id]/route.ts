export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireOwner, viewerErrorResponse } from "@/lib/auth/viewer";
import { prisma } from "@/lib/prisma";
import { updateJobSchema } from "@/lib/validations";

// PATCH /api/jobs/[id] — edit a job or mark it paid/unpaid.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireOwner();
  } catch (error) {
    const authError = viewerErrorResponse(error);
    if (authError) return authError;
    throw error;
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
  try {
    await requireOwner();
  } catch (error) {
    const authError = viewerErrorResponse(error);
    if (authError) return authError;
    throw error;
  }
  const { id } = await params;
  const job = await prisma.clientJob.findUnique({
    where: { id },
    select: { status: true, paidAt: true },
  });
  if (!job) {
    return NextResponse.json({ error: "העבודה לא נמצאה" }, { status: 404 });
  }
  // A paid job is a settled receivable — money that arrived and was counted.
  // Deleting it silently rewrites the month it landed in. Only an unpaid,
  // still-open job may be removed (a typo, a duplicate); a paid one stays.
  if (job.status === "PAID" || job.paidAt) {
    return NextResponse.json(
      { error: "עבודה ששולמה היא רשומה כספית ולא ניתן למחוק אותה. אפשר לערוך את הפרטים." },
      { status: 409 },
    );
  }
  await prisma.clientJob.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
