export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { requireOwner, viewerErrorResponse } from "@/lib/auth/viewer";
import { prisma } from "@/lib/prisma";
import { createJobSchema } from "@/lib/validations";
import { jobFinance, expectedPaymentDate } from "@/lib/finance";

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

// GET /api/jobs — every one-off job + per-client and per-month rollups.
export async function GET() {
  try {
    await requireOwner();
  } catch (error) {
    const authError = viewerErrorResponse(error);
    if (authError) return authError;
    throw error;
  }

  const jobs = await prisma.clientJob.findMany({
    include: { client: { select: { id: true, name: true, number: true } } },
    orderBy: [{ status: "asc" }, { closedAt: "desc" }],
  });

  const now = new Date();
  const thisMonth = monthKey(now);

  const rows = jobs.map((j) => {
    const money = jobFinance(j);
    const expected = expectedPaymentDate(j.closedAt, j.paymentTermsDays);
    return {
      id: j.id,
      client: j.client,
      title: j.title,
      amount: j.amount,
      vatIncluded: j.vatIncluded,
      cardcomFee: j.cardcomFee,
      status: j.status,
      closedAt: j.closedAt.toISOString(),
      paymentTermsDays: j.paymentTermsDays,
      paidAt: j.paidAt ? j.paidAt.toISOString() : null,
      expectedPaidAt: expected.toISOString(),
      overdue: !j.paidAt && expected < now,
      notes: j.notes,
      gross: money.gross,
      net: money.net,
      vat: money.vat,
      fee: money.fee,
      profit: money.profit,
    };
  });

  // Per-client rollup
  const perClientMap = new Map<
    string,
    { clientId: string; name: string; number: number; outstanding: number; received: number; jobCount: number }
  >();
  for (const r of rows) {
    const key = r.client.id;
    const c = perClientMap.get(key) ?? {
      clientId: key,
      name: r.client.name,
      number: r.client.number,
      outstanding: 0,
      received: 0,
      jobCount: 0,
    };
    c.jobCount += 1;
    if (r.status === "PAID") c.received += r.gross;
    else c.outstanding += r.gross;
    perClientMap.set(key, c);
  }
  const perClient = [...perClientMap.values()].sort((a, b) => b.outstanding - a.outstanding);

  // Per-month rollup: billed (by closedAt) vs received (by paidAt), gross + net
  const perMonthMap = new Map<
    string,
    { month: string; billedGross: number; receivedGross: number; receivedNet: number }
  >();
  const bump = (m: string) =>
    perMonthMap.get(m) ?? { month: m, billedGross: 0, receivedGross: 0, receivedNet: 0 };
  for (const r of rows) {
    const bm = monthKey(new Date(r.closedAt));
    const b = bump(bm);
    b.billedGross += r.gross;
    perMonthMap.set(bm, b);
    if (r.status === "PAID" && r.paidAt) {
      const pm = monthKey(new Date(r.paidAt));
      const p = bump(pm);
      p.receivedGross += r.gross;
      p.receivedNet += r.net;
      perMonthMap.set(pm, p);
    }
  }
  const perMonth = [...perMonthMap.values()].sort((a, b) => b.month.localeCompare(a.month));

  const totals = {
    outstandingGross: rows.filter((r) => r.status === "PENDING").reduce((s, r) => s + r.gross, 0),
    receivedThisMonthGross: rows
      .filter((r) => r.status === "PAID" && r.paidAt && monthKey(new Date(r.paidAt)) === thisMonth)
      .reduce((s, r) => s + r.gross, 0),
    receivedThisMonthNet: rows
      .filter((r) => r.status === "PAID" && r.paidAt && monthKey(new Date(r.paidAt)) === thisMonth)
      .reduce((s, r) => s + r.profit, 0),
    openCount: rows.filter((r) => r.status === "PENDING").length,
    overdueCount: rows.filter((r) => r.overdue).length,
  };

  return NextResponse.json({ rows, perClient, perMonth, totals });
}

// POST /api/jobs — create a job; optionally create the client on the fly.
export async function POST(request: NextRequest) {
  let viewer;
  try {
    viewer = await requireOwner();
  } catch (error) {
    const authError = viewerErrorResponse(error);
    if (authError) return authError;
    throw error;
  }

  const body = await request.json().catch(() => null);
  const parsed = createJobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const d = parsed.data;

  // Resolve client: existing id, or create a lightweight one-off client.
  let clientId = d.clientId ?? null;
  if (!clientId && d.clientName) {
    const created = await prisma.client.create({
      // status "" (not "בוצע") so one-off clients don't enter the MRR
      // partner-report; their revenue comes only from jobs. One-off clients
      // are the owner's own deals — the partner model never splits them.
      data: {
        name: d.clientName.trim(),
        source: "one_off",
        status: "",
        ownerId: viewer.userId,
      },
      select: { id: true },
    });
    clientId = created.id;
  }
  if (!clientId) {
    return NextResponse.json({ error: "לקוח לא נמצא" }, { status: 400 });
  }

  const job = await prisma.clientJob.create({
    data: {
      clientId,
      title: d.title.trim(),
      amount: d.amount,
      vatIncluded: d.vatIncluded,
      cardcomFee: d.cardcomFee,
      closedAt: new Date(d.closedAt),
      paymentTermsDays: d.paymentTermsDays,
      paidAt: d.paidAt ? new Date(d.paidAt) : null,
      status: d.paidAt ? "PAID" : "PENDING",
      notes: d.notes?.trim() || null,
    },
    include: { client: { select: { id: true, name: true, number: true } } },
  });

  return NextResponse.json(job, { status: 201 });
}
