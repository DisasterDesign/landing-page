export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import {
  PersistedRoleAuthorizationError,
  requirePersistedUserRole,
} from "@/lib/auth/persisted-role";
import { prisma } from "@/lib/prisma";
import { jobFinance, CARDCOM_FEE_RATE, VAT_RATE } from "@/lib/finance";

/**
 * GET /api/revenue/monthly?months=12
 *
 * Money that ACTUALLY arrived, bucketed by the month it arrived in.
 *
 * This exists because the dashboard chart used to derive "revenue per month"
 * from `Client.amount` — a lifetime CUMULATIVE counter — placed on the month
 * of the client's startDate. That is a cohort view, not a monthly one: every
 * shekel a March client ever paid sits on March forever, and a month with no
 * NEW clients reads as ₪0 even when eleven subscriptions were charged in it.
 *
 * Two real sources, both timestamped at the moment of payment:
 * - AgreementCharge (success): recurring + first subscription charges. Uses
 *   cardcomChargeDate (the actual billing date at Cardcom) and falls back to
 *   chargedAt (webhook arrival) for rows that predate that column.
 * - ClientJob with paidAt: one-off projects, counted only once the money is
 *   in — a job closed but unpaid is a receivable, not revenue.
 *
 * Amounts are gross (VAT included, as charged). `net` strips VAT, `fee` is
 * Cardcom's 2% where it applies, and `profit` = net − fee − the monthly
 * expenses of clients that actually billed that month (e.g. a dedicated
 * server). Studio overhead is deliberately excluded — that lives in /finance.
 */
export async function GET(request: NextRequest) {
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

  const requested = Number.parseInt(
    request.nextUrl.searchParams.get("months") ?? "12",
    10,
  );
  const months = Number.isInteger(requested)
    ? Math.min(Math.max(requested, 1), 36)
    : 12;

  const now = new Date();
  const windowStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1),
  );

  const [charges, jobs] = await Promise.all([
    prisma.agreementCharge.findMany({
      where: {
        success: true,
        OR: [
          { cardcomChargeDate: { gte: windowStart } },
          { cardcomChargeDate: null, chargedAt: { gte: windowStart } },
        ],
      },
      select: {
        amount: true,
        chargedAt: true,
        cardcomChargeDate: true,
        agreement: {
          select: { clientId: true, client: { select: { expense: true } } },
        },
      },
    }),
    prisma.clientJob.findMany({
      where: { paidAt: { gte: windowStart } },
      select: {
        amount: true,
        vatIncluded: true,
        cardcomFee: true,
        paidAt: true,
      },
    }),
  ]);

  const monthKey = (date: Date) =>
    `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

  const buckets = new Map<
    string,
    {
      subscriptions: number;
      jobs: number;
      fee: number;
      /** client ids that billed this month — their expense counts once */
      billedClients: Set<string>;
      clientExpenses: Map<string, number>;
    }
  >();
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1),
    );
    buckets.set(monthKey(d), {
      subscriptions: 0,
      jobs: 0,
      fee: 0,
      billedClients: new Set(),
      clientExpenses: new Map(),
    });
  }

  for (const charge of charges) {
    const bucket = buckets.get(
      monthKey(charge.cardcomChargeDate ?? charge.chargedAt),
    );
    if (!bucket) continue;
    bucket.subscriptions += charge.amount;
    bucket.fee += charge.amount * CARDCOM_FEE_RATE;
    const clientId = charge.agreement?.clientId;
    if (clientId) {
      bucket.billedClients.add(clientId);
      bucket.clientExpenses.set(
        clientId,
        charge.agreement?.client?.expense ?? 0,
      );
    }
  }

  for (const job of jobs) {
    if (!job.paidAt) continue;
    const bucket = buckets.get(monthKey(job.paidAt));
    if (!bucket) continue;
    const { gross, fee } = jobFinance(job);
    bucket.jobs += gross;
    bucket.fee += fee;
  }

  const data = Array.from(buckets.entries()).map(([key, bucket]) => {
    const revenue = bucket.subscriptions + bucket.jobs;
    const clientExpenses = Array.from(bucket.billedClients).reduce(
      (sum, id) => sum + (bucket.clientExpenses.get(id) ?? 0),
      0,
    );
    const expenses = bucket.fee + clientExpenses;
    const net = (revenue * 100) / (100 + VAT_RATE);
    return {
      month: key,
      subscriptions: Math.round(bucket.subscriptions * 100) / 100,
      jobs: Math.round(bucket.jobs * 100) / 100,
      revenue: Math.round(revenue * 100) / 100,
      expenses: Math.round(expenses * 100) / 100,
      profit: Math.round((net - expenses) * 100) / 100,
    };
  });

  // Months before the first recorded charge have no receipt data at all —
  // the UI needs to say "not tracked yet" rather than draw an honest-looking
  // ₪0 next to months that do have data.
  const earliest = await prisma.agreementCharge.findFirst({
    where: { success: true },
    orderBy: { chargedAt: "asc" },
    select: { chargedAt: true, cardcomChargeDate: true },
  });

  return NextResponse.json({
    data,
    trackedFrom: earliest
      ? monthKey(earliest.cardcomChargeDate ?? earliest.chargedAt)
      : null,
  });
}
