import type { LeadEventType, LeadIntentLevel, LeadStage, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

import { buildAdminLeadWhere, type AdminLeadFilters } from "./admin-query";
import { resolveAgreementPartnerId } from "./agreement-lifecycle";
import { getLeadSlaMinutes, type LeadSlaMinutes } from "./lead-sla";

export interface LeadAnalyticsCohort {
  from?: Date;
  to?: Date;
}

export interface LeadAnalyticsRow {
  id: string;
  createdAt: Date;
  intentLevel: LeadIntentLevel | null;
  stage: LeadStage | null;
  sourceKey: string | null;
  lossReason: string | null;
  sourceSnapshot: unknown;
  prospect: {
    qualityScore: number | null;
    cycle: {
      proposals?: Array<{ displayName: string }>;
      territory?: string | null;
    } | null;
  } | null;
  events: Array<{
    type: LeadEventType;
    occurredAt: Date;
    actorUserId: string | null;
    metadata?: unknown;
  }>;
  interactions: Array<{
    occurredAt: Date;
    authorId: string;
    usedCallAngleIds: string[];
  }>;
  agreements: Array<{
    id: string;
    status: string;
    createdAt: Date;
    signedAt: Date | null;
    paidAt: Date | null;
    paidAmount: number | null;
    monthlyPrice: number;
    creditedSellerId: string | null;
  }>;
}

export interface FunnelCounts {
  created: number;
  claimed: number;
  contacted: number;
  decisionMakerReached: number;
  qualified: number;
  agreementCreated: number;
  agreementSent: number;
  agreementSigned: number;
  paid: number;
}

export interface SellerLeadMetrics extends Omit<FunnelCounts, "created"> {
  paid: number;
  revenue: number;
}

export interface LeadMetrics extends FunnelCounts {
  revenue: number;
  averageDealSize: number;
  rates: Omit<FunnelCounts, "created">;
  timeToClaimMedianMinutes: number | null;
  timeToContactMedianMinutes: number | null;
  sla: {
    INBOUND: { eligible: number; within: number; rate: number };
    AD_RESPONSE: { eligible: number; within: number; rate: number };
  };
  lossReasons: Record<string, number>;
  coldBreakdown: {
    territory: Record<string, number>;
    businessCategory: Record<string, number>;
    score: Record<string, number>;
    callAngleId: Record<string, number>;
  };
  byIntent: Record<string, FunnelCounts>;
  bySource: Record<string, FunnelCounts>;
  bySeller: Record<string, SellerLeadMetrics>;
}

const funnelEvent: Record<Exclude<keyof Omit<FunnelCounts, "created">, "paid">, LeadEventType> = {
  claimed: "CLAIMED",
  contacted: "CONTACT_ATTEMPTED",
  decisionMakerReached: "DECISION_MAKER_REACHED",
  qualified: "QUALIFIED",
  agreementCreated: "AGREEMENT_CREATED",
  agreementSent: "AGREEMENT_SENT",
  agreementSigned: "AGREEMENT_SIGNED",
};

/**
 * Milestone rank each funnel step sits at, and the rank a lead's CURRENT
 * stage implies it must have passed.
 *
 * Migrated leads (the pre-unified history and the old admin statuses) carry
 * a stage but no milestone events — the backfill could not invent timestamps
 * that were never recorded. Counting events alone therefore rendered the
 * whole past as zeros ("everything disappeared", Elad, 24.7). A lead sitting
 * in CONTACTING has by definition been claimed and contacted, so the funnel
 * counts attainment as: event exists OR current stage implies it. Terminal
 * LOST/SPAM imply nothing beyond creation — we honestly don't know how far
 * they got; only their recorded events count.
 */
const funnelRank: Record<Exclude<keyof Omit<FunnelCounts, "created">, "paid">, number> = {
  claimed: 1,
  contacted: 2,
  decisionMakerReached: 3,
  qualified: 4,
  agreementCreated: 5,
  agreementSent: 6,
  agreementSigned: 7,
};

const stageImpliedRank: Record<LeadStage, number> = {
  NEW: 0,
  PREPARING: 1,
  CONTACTING: 2,
  QUALIFIED: 4,
  AGREEMENT_DRAFT: 5,
  AGREEMENT_SENT: 6,
  AGREEMENT_SIGNED: 7,
  WON: 7,
  LOST: 0,
  SPAM: 0,
};

const zeroFunnel = (): FunnelCounts => ({
  created: 0,
  claimed: 0,
  contacted: 0,
  decisionMakerReached: 0,
  qualified: 0,
  agreementCreated: 0,
  agreementSent: 0,
  agreementSigned: 0,
  paid: 0,
});

function increment(target: Record<string, number>, key: string | null | undefined) {
  if (!key) return;
  target[key] = (target[key] ?? 0) + 1;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!;
}

function firstEvent(
  row: LeadAnalyticsRow,
  type: LeadEventType,
): LeadAnalyticsRow["events"][number] | undefined {
  return row.events
    .filter((event) => event.type === type)
    .sort((left, right) => left.occurredAt.getTime() - right.occurredAt.getTime())[0];
}

function sourceSnapshot(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function snapshotString(snapshot: Record<string, unknown> | null, key: string): string | null {
  const value = snapshot?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function snapshotScore(snapshot: Record<string, unknown> | null): number | null {
  const value = snapshot?.qualityScore;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function lossReasonFromEvent(row: LeadAnalyticsRow): string | null {
  const event = firstEvent(row, "LOST");
  const metadata = sourceSnapshot(event?.metadata);
  return snapshotString(metadata, "lossReason");
}

function breakdownFor(
  container: Record<string, FunnelCounts>,
  key: string | null,
): FunnelCounts | null {
  if (!key) return null;
  container[key] ??= zeroFunnel();
  return container[key];
}

function sellerFor(
  container: Record<string, SellerLeadMetrics>,
  sellerId: string | null | undefined,
): SellerLeadMetrics | null {
  if (!sellerId) return null;
  container[sellerId] ??= {
    claimed: 0,
    contacted: 0,
    decisionMakerReached: 0,
    qualified: 0,
    agreementCreated: 0,
    agreementSent: 0,
    agreementSigned: 0,
    paid: 0,
    revenue: 0,
  };
  return container[sellerId];
}

function inCohort(createdAt: Date, cohort: LeadAnalyticsCohort): boolean {
  return (!cohort.from || createdAt >= cohort.from) && (!cohort.to || createdAt <= cohort.to);
}

export function calculateLeadMetrics(
  rows: readonly LeadAnalyticsRow[],
  cohort: LeadAnalyticsCohort = {},
  options: { slaMinutes?: LeadSlaMinutes } = {},
): LeadMetrics {
  const metrics: LeadMetrics = {
    ...zeroFunnel(),
    revenue: 0,
    averageDealSize: 0,
    rates: {
      claimed: 0,
      contacted: 0,
      decisionMakerReached: 0,
      qualified: 0,
      agreementCreated: 0,
      agreementSent: 0,
      agreementSigned: 0,
      paid: 0,
    },
    timeToClaimMedianMinutes: null,
    timeToContactMedianMinutes: null,
    sla: {
      INBOUND: { eligible: 0, within: 0, rate: 0 },
      AD_RESPONSE: { eligible: 0, within: 0, rate: 0 },
    },
    lossReasons: {},
    coldBreakdown: { territory: {}, businessCategory: {}, score: {}, callAngleId: {} },
    byIntent: {},
    bySource: {},
    bySeller: {},
  };
  const claimTimes: number[] = [];
  const contactTimes: number[] = [];
  const slaMinutes = options.slaMinutes ?? getLeadSlaMinutes();

  for (const row of rows) {
    if (!inCohort(row.createdAt, cohort)) continue;
    metrics.created += 1;
    const intentMetrics = breakdownFor(metrics.byIntent, row.intentLevel);
    const sourceMetrics = breakdownFor(metrics.bySource, row.sourceKey);
    if (intentMetrics) intentMetrics.created += 1;
    if (sourceMetrics) sourceMetrics.created += 1;
    if (row.intentLevel === "INBOUND" || row.intentLevel === "AD_RESPONSE") {
      metrics.sla[row.intentLevel].eligible += 1;
    }

    const snapshot = sourceSnapshot(row.sourceSnapshot);
    if (row.intentLevel === "OUTBOUND") {
      const territory =
        snapshotString(snapshot, "territory") ??
        row.prospect?.cycle?.territory ??
        row.prospect?.cycle?.proposals?.[0]?.displayName ??
        null;
      const businessCategory = snapshotString(
        snapshot,
        "internalBusinessCategory",
      );
      const score =
        snapshotScore(snapshot) ?? row.prospect?.qualityScore ?? null;
      increment(metrics.coldBreakdown.territory, territory);
      increment(metrics.coldBreakdown.businessCategory, businessCategory);
      if (score !== null) {
        increment(metrics.coldBreakdown.score, String(score));
      }
    }

    const impliedRank = row.stage ? stageImpliedRank[row.stage] : 0;
    for (const [key, eventType] of Object.entries(funnelEvent) as Array<[
      Exclude<keyof Omit<FunnelCounts, "created">, "paid">,
      LeadEventType,
    ]>) {
      const event = firstEvent(row, eventType);
      // Attained = recorded event OR implied by the lead's current stage.
      // Timing medians and per-seller attribution stay event-only — a stage
      // cannot tell us WHEN or WHO.
      if (!event && impliedRank < funnelRank[key]) continue;
      metrics[key] += 1;
      if (intentMetrics) intentMetrics[key] += 1;
      if (sourceMetrics) sourceMetrics[key] += 1;
      if (!event) continue;
      const sellerMetrics = sellerFor(metrics.bySeller, event.actorUserId);
      if (sellerMetrics) sellerMetrics[key] += 1;
      if (key === "claimed") {
        const minutes = (event.occurredAt.getTime() - row.createdAt.getTime()) / 60_000;
        claimTimes.push(minutes);
        if (row.intentLevel === "INBOUND" || row.intentLevel === "AD_RESPONSE") {
          const sla = metrics.sla[row.intentLevel];
          if (minutes <= slaMinutes[row.intentLevel]) sla.within += 1;
        }
      }
      if (key === "contacted") {
        contactTimes.push((event.occurredAt.getTime() - row.createdAt.getTime()) / 60_000);
      }
    }

    if (row.intentLevel === "OUTBOUND") {
      for (const interaction of row.interactions) {
        for (const callAngleId of interaction.usedCallAngleIds) {
          increment(metrics.coldBreakdown.callAngleId, callAngleId);
        }
      }
    }

    increment(metrics.lossReasons, row.lossReason ?? lossReasonFromEvent(row));
    const firstPaidAgreement = row.agreements
      .filter(
        (
          agreement,
        ): agreement is typeof agreement & { paidAt: Date } =>
          agreement.paidAt !== null,
      )
      .sort((left, right) => left.paidAt.getTime() - right.paidAt.getTime())[0];
    if (firstPaidAgreement) {
      metrics.paid += 1;
      if (intentMetrics) intentMetrics.paid += 1;
      if (sourceMetrics) sourceMetrics.paid += 1;
      const amount =
        firstPaidAgreement.paidAmount ?? firstPaidAgreement.monthlyPrice;
      metrics.revenue += amount;
      // Same attribution source as every money surface. Reading
      // creditedSellerId alone would drop every backfilled deal (partnerId
      // set, mirror null) out of its partner's row.
      const sellerMetrics = sellerFor(
        metrics.bySeller,
        resolveAgreementPartnerId(firstPaidAgreement),
      );
      if (sellerMetrics) {
        sellerMetrics.paid += 1;
        sellerMetrics.revenue += amount;
      }
    }
  }

  metrics.timeToClaimMedianMinutes = median(claimTimes);
  metrics.timeToContactMedianMinutes = median(contactTimes);
  metrics.averageDealSize = metrics.paid > 0 ? metrics.revenue / metrics.paid : 0;
  for (const key of Object.keys(metrics.rates) as Array<keyof LeadMetrics["rates"]>) {
    metrics.rates[key] = metrics.created > 0 ? metrics[key] / metrics.created : 0;
  }
  for (const intent of ["INBOUND", "AD_RESPONSE"] as const) {
    const sla = metrics.sla[intent];
    sla.rate = sla.eligible > 0 ? sla.within / sla.eligible : 0;
  }
  return metrics;
}

const analyticsInclude = {
  events: {
    select: { type: true, occurredAt: true, actorUserId: true, metadata: true },
    orderBy: { occurredAt: "asc" },
  },
  interactions: {
    select: { occurredAt: true, authorId: true, usedCallAngleIds: true },
  },
  agreements: {
    select: {
      id: true,
      status: true,
      createdAt: true,
      signedAt: true,
      paidAt: true,
      paidAmount: true,
      monthlyPrice: true,
      partnerId: true,
      creditedSellerId: true,
    },
  },
  prospect: {
    select: {
      qualityScore: true,
      cycle: {
        select: {
          proposals: {
            where: { status: "APPROVED" },
            select: { displayName: true },
            take: 1,
          },
        },
      },
    },
  },
} satisfies Prisma.ContactSubmissionInclude;

export async function getLeadMetrics(
  filters: AdminLeadFilters,
  dependencies: { db?: Pick<typeof prisma, "contactSubmission">; now?: Date; slaMinutes?: LeadSlaMinutes } = {},
): Promise<LeadMetrics> {
  const db = dependencies.db ?? prisma;
  const now = dependencies.now ?? new Date();
  const where = buildAdminLeadWhere(
    { ...filters, dateField: "createdAt", cursor: undefined, limit: 100 },
    now,
  );
  const rows = await db.contactSubmission.findMany({
    where,
    include: analyticsInclude,
  });
  return calculateLeadMetrics(rows as unknown as LeadAnalyticsRow[], {
    from: filters.from,
    to: filters.to,
  }, { slaMinutes: dependencies.slaMinutes });
}
