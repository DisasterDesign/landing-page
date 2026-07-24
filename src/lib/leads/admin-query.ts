import type {
  LeadIntentLevel,
  LeadStage,
  Prisma,
} from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

import { LeadDomainError } from "./errors";
import {
  decodeLeadCursor,
  encodeLeadCursor,
  leadProjectionInclude,
  loadProjectionLiveDetails,
  projectLeadRecord,
  type LeadDetail,
  type LeadProjectionRecord,
  type ProjectionDatabase,
} from "./projection";
import { isLeadSourceKey } from "./source";

export interface AdminLeadFilters {
  intent?: LeadIntentLevel;
  source?: string;
  owner?: string | "UNASSIGNED";
  stage?: LeadStage;
  stageGroup?: "NEW" | "IN_PROGRESS" | "WON" | "LOST" | "SPAM";
  from?: Date;
  to?: Date;
  territory?: string;
  minScore?: number;
  maxScore?: number;
  businessCategory?: "UNKNOWN" | "SERVICE" | "RETAIL" | "ECOMMERCE";
  dateField?: "createdAt" | "lastActivityAt";
  overdue?: boolean;
  reviewRequired?: boolean;
  search?: string;
  cursor?: string;
  limit: number;
  openOnly?: boolean;
}

export interface AdminLeadPage {
  items: LeadDetail[];
  nextCursor: string | null;
  stats: {
    openCount: number;
    dueThisWeekCount: number;
    newThisWeekCount: number;
    /** OPEN (non-terminal) leads per temperature — what is alive right now. */
    openByIntent: Record<"OUTBOUND" | "AD_RESPONSE" | "INBOUND", number>;
    /** Life-state counts WITHIN the selected source tab (stage-agnostic). */
    byStageGroup: Record<
      "NEW" | "IN_PROGRESS" | "WON" | "LOST" | "SPAM" | "ALL" | "OPEN",
      number
    >;
  };
}

const intentSchema = z.enum(["OUTBOUND", "AD_RESPONSE", "INBOUND"]);
const stageSchema = z.enum([
  "NEW",
  "PREPARING",
  "CONTACTING",
  "QUALIFIED",
  "AGREEMENT_DRAFT",
  "AGREEMENT_SENT",
  "AGREEMENT_SIGNED",
  "WON",
  "LOST",
  "SPAM",
]);
const sourceSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .refine(isLeadSourceKey, "Unknown lead source");
const dateSchema = z
  .string()
  .datetime({ offset: true })
  .transform((value) => new Date(value));
const scoreSchema = z
  .string()
  .regex(/^\d$/)
  .transform(Number)
  .pipe(z.number().int().min(0).max(5));
const booleanSchema = z
  .enum(["true", "false"])
  .transform((value) => value === "true");
const limitSchema = z
  .string()
  .regex(/^\d+$/)
  .transform((value) => Math.max(1, Math.min(Number(value), 100)));

const rawFilterSchema = z
  .object({
    intent: intentSchema.optional(),
    source: sourceSchema.optional(),
    owner: z.string().trim().min(1).max(200).optional(),
    stage: stageSchema.optional(),
    // The classic status bar: broad life-state groups, mapped onto stages.
    stageGroup: z
      .enum(["NEW", "IN_PROGRESS", "WON", "LOST", "SPAM"])
      .optional(),
    from: dateSchema.optional(),
    to: dateSchema.optional(),
    territory: z.string().trim().min(1).max(300).optional(),
    minScore: scoreSchema.optional(),
    maxScore: scoreSchema.optional(),
    businessCategory: z
      .enum(["UNKNOWN", "SERVICE", "RETAIL", "ECOMMERCE"])
      .optional(),
    dateField: z.enum(["createdAt", "lastActivityAt"]).optional(),
    overdue: booleanSchema.optional(),
    reviewRequired: booleanSchema.optional(),
    search: z.string().trim().min(1).max(200).optional(),
    cursor: z
      .string()
      .trim()
      .min(1)
      .max(1_000)
      .refine((value) => {
        try {
          decodeLeadCursor(value);
          return true;
        } catch {
          return false;
        }
      }, "Invalid cursor")
      .optional(),
    limit: limitSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.minScore !== undefined &&
      value.maxScore !== undefined &&
      value.minScore > value.maxScore
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["minScore"],
        message: "Minimum score cannot exceed maximum score",
      });
    }
    if (value.from && value.to && value.from > value.to) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["from"],
        message: "From date cannot be after to date",
      });
    }
  });

const filterKeys = [
  "intent",
  "source",
  "owner",
  "stage",
  "stageGroup",
  "from",
  "to",
  "territory",
  "minScore",
  "maxScore",
  "businessCategory",
  "dateField",
  "overdue",
  "reviewRequired",
  "search",
  "cursor",
  "limit",
] as const;

export function parseAdminLeadFilters(
  searchParams: URLSearchParams,
): AdminLeadFilters {
  const raw: Record<string, string> = {};
  for (const key of filterKeys) {
    const value = searchParams.get(key);
    if (value !== null && value !== "") raw[key] = value;
  }
  const result = rawFilterSchema.safeParse(raw);
  if (!result.success) {
    throw new LeadDomainError("VALIDATION", "Invalid admin lead filters", {
      issues: result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }
  return {
    ...result.data,
    owner: result.data.owner,
    dateField: result.data.dateField ?? "createdAt",
    limit: result.data.limit ?? 50,
  };
}

function activityFromCondition(from: Date): Prisma.ContactSubmissionWhereInput {
  return {
    OR: [
      { createdAt: { gte: from } },
      { events: { some: { recordedAt: { gte: from } } } },
      { interactions: { some: { recordedAt: { gte: from } } } },
      { notes: { some: { createdAt: { gte: from } } } },
      { followUps: { some: { updatedAt: { gte: from } } } },
      { agreements: { some: { updatedAt: { gte: from } } } },
    ],
  };
}

function activityToConditions(to: Date): Prisma.ContactSubmissionWhereInput[] {
  return [
    { createdAt: { lte: to } },
    { events: { none: { recordedAt: { gt: to } } } },
    { interactions: { none: { recordedAt: { gt: to } } } },
    { notes: { none: { createdAt: { gt: to } } } },
    { followUps: { none: { updatedAt: { gt: to } } } },
    { agreements: { none: { updatedAt: { gt: to } } } },
  ];
}

function cursorCondition(cursorValue: string): Prisma.ContactSubmissionWhereInput {
  const cursor = decodeLeadCursor(cursorValue);
  const createdAt = new Date(cursor.createdAt);
  return {
    OR: [
      { createdAt: { lt: createdAt } },
      { createdAt, id: { lt: cursor.id } },
    ],
  };
}

export function buildAdminLeadWhere(
  filters: AdminLeadFilters,
  now: Date,
): Prisma.ContactSubmissionWhereInput {
  const where: Prisma.ContactSubmissionWhereInput = {};
  const and: Prisma.ContactSubmissionWhereInput[] = [];
  if (filters.intent) where.intentLevel = filters.intent;
  if (filters.source) where.sourceKey = filters.source;
  if (filters.owner === "UNASSIGNED") where.ownerId = null;
  else if (filters.owner) where.ownerId = filters.owner;
  if (filters.stage) where.stage = filters.stage;
  if (!filters.stage && filters.stageGroup) {
    const groups: Record<NonNullable<AdminLeadFilters["stageGroup"]>, LeadStage[]> = {
      NEW: ["NEW"],
      IN_PROGRESS: [
        "PREPARING",
        "CONTACTING",
        "QUALIFIED",
        "AGREEMENT_DRAFT",
        "AGREEMENT_SENT",
        "AGREEMENT_SIGNED",
      ],
      WON: ["WON"],
      LOST: ["LOST"],
      SPAM: ["SPAM"],
    };
    where.stage = { in: groups[filters.stageGroup] };
  }
  if (filters.reviewRequired !== undefined) {
    where.migrationReviewRequired = filters.reviewRequired;
  }
  if (filters.openOnly) {
    and.push({ stage: { notIn: ["WON", "LOST", "SPAM"] } });
  }
  if (filters.search) {
    and.push({
      OR: [
        { name: { contains: filters.search, mode: "insensitive" } },
        { company: { contains: filters.search, mode: "insensitive" } },
        { email: { contains: filters.search, mode: "insensitive" } },
        { phone: { contains: filters.search } },
        { message: { contains: filters.search, mode: "insensitive" } },
      ],
    });
  }
  if (filters.territory) {
    and.push({
      sourceSnapshot: {
        path: ["territory"],
        string_contains: filters.territory,
      },
    });
  }
  if (
    filters.minScore !== undefined ||
    filters.maxScore !== undefined
  ) {
    and.push({
      sourceSnapshot: {
        path: ["qualityScore"],
        ...(filters.minScore !== undefined
          ? { gte: filters.minScore }
          : {}),
        ...(filters.maxScore !== undefined
          ? { lte: filters.maxScore }
          : {}),
      },
    });
  }
  if (filters.businessCategory) {
    and.push({
      sourceSnapshot: {
        path: ["internalBusinessCategory"],
        equals: filters.businessCategory,
      },
    });
  }
  if (filters.dateField === "lastActivityAt") {
    if (filters.from) and.push(activityFromCondition(filters.from));
    if (filters.to) and.push(...activityToConditions(filters.to));
  } else if (filters.from || filters.to) {
    where.createdAt = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    };
  }
  if (filters.overdue === true) {
    where.followUps = {
      some: { status: "SCHEDULED", dueAt: { lt: now } },
    };
  } else if (filters.overdue === false) {
    and.push({
      followUps: {
        none: { status: "SCHEDULED", dueAt: { lt: now } },
      },
    });
  }
  if (filters.cursor) and.push(cursorCondition(filters.cursor));
  if (and.length > 0) where.AND = and;
  return where;
}

interface AdminQueryDependencies {
  db?: ProjectionDatabase;
  loadLiveDetails?: typeof loadProjectionLiveDetails;
  now?: Date;
}

function sourceObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function placeIdFor(row: LeadProjectionRecord): string | null {
  if (row.prospect?.placeId) return row.prospect.placeId;
  const value = sourceObject(row.sourceSnapshot)?.placeId;
  return typeof value === "string" ? value : null;
}

export async function getAdminLeadList(
  filters: AdminLeadFilters,
  dependencies: AdminQueryDependencies = {},
): Promise<AdminLeadPage> {
  const db = dependencies.db ?? prisma;
  const now = dependencies.now ?? new Date();
  const where = buildAdminLeadWhere(filters, now);
  const rows = (await db.contactSubmission.findMany({
    where,
    include: leadProjectionInclude,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: filters.limit + 1,
  })) as unknown as LeadProjectionRecord[];
  const hasMore = rows.length > filters.limit;
  const pageRows = rows.slice(0, filters.limit);
  const placeIds = pageRows.flatMap((row) => {
    const placeId = placeIdFor(row);
    return placeId ? [placeId] : [];
  });
  const loadLive = dependencies.loadLiveDetails ?? loadProjectionLiveDetails;
  const live = await loadLive(placeIds);

  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const weekAhead = new Date(startOfDay);
  weekAhead.setDate(weekAhead.getDate() + 7);
  const weekAgo = new Date(startOfDay);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const baseWhere = buildAdminLeadWhere(
    { ...filters, cursor: undefined, limit: filters.limit },
    now,
  );
  const [openCount, dueThisWeekCount, newThisWeekCount] = await Promise.all([
    db.contactSubmission.count({
      where: {
        AND: [
          baseWhere,
          { stage: { notIn: ["WON", "LOST", "SPAM"] } },
        ],
      },
    }),
    db.contactSubmission.count({
      where: {
        AND: [
          baseWhere,
          {
            followUps: {
              some: {
                status: "SCHEDULED",
                dueAt: { lte: weekAhead },
              },
            },
          },
        ],
      },
    }),
    // WARM inflow only. A weekly cold sweep dumps dozens of OUTBOUND rows at
    // once, and counting them here made the card scream "70 new leads" the
    // morning after a sweep — a number that matches no external reality.
    // Warm-only keeps this card aligned with Meta Business Suite. Computed
    // WITHOUT the intent tab (headline numbers describe the whole business;
    // the tab filters only the list).
    db.contactSubmission.count({
      where: {
        AND: [
          buildAdminLeadWhere(
            {
              ...filters,
              intent: undefined,
              stage: undefined,
              stageGroup: undefined,
              cursor: undefined,
              limit: filters.limit,
            },
            now,
          ),
          { createdAt: { gte: weekAgo } },
          { intentLevel: { not: "OUTBOUND" } },
        ],
      },
    }),
  ]);

  // Open leads per temperature, IGNORING the intent filter itself — the
  // temperature tabs must show all three live counts even while one of them
  // is selected.
  const openByIntentWhere = buildAdminLeadWhere(
    {
      ...filters,
      intent: undefined,
      stage: undefined,
      stageGroup: undefined,
      cursor: undefined,
      limit: filters.limit,
    },
    now,
  );
  const openByIntentRows = await db.contactSubmission.groupBy({
    by: ["intentLevel"],
    where: {
      AND: [openByIntentWhere, { stage: { notIn: ["WON", "LOST", "SPAM"] } }],
    },
    _count: true,
  });
  const openByIntent = { OUTBOUND: 0, AD_RESPONSE: 0, INBOUND: 0 };
  for (const row of openByIntentRows) {
    if (row.intentLevel in openByIntent) {
      openByIntent[row.intentLevel as keyof typeof openByIntent] =
        typeof row._count === "number" ? row._count : 0;
    }
  }

  // Status-bar counts: WITHIN the selected source tab (that is the question
  // the bar answers — "of the Facebook leads, how many are new / in
  // progress / spam"), ignoring only the stage selection itself.
  const byStageRows = await db.contactSubmission.groupBy({
    by: ["stage"],
    where: buildAdminLeadWhere(
      {
        ...filters,
        stage: undefined,
        stageGroup: undefined,
        cursor: undefined,
        limit: filters.limit,
      },
      now,
    ),
    _count: true,
  });
  const byStageGroup = {
    NEW: 0,
    IN_PROGRESS: 0,
    WON: 0,
    LOST: 0,
    SPAM: 0,
    ALL: 0,
    OPEN: 0,
  };
  const stageToGroup: Record<string, keyof typeof byStageGroup> = {
    NEW: "NEW",
    PREPARING: "IN_PROGRESS",
    CONTACTING: "IN_PROGRESS",
    QUALIFIED: "IN_PROGRESS",
    AGREEMENT_DRAFT: "IN_PROGRESS",
    AGREEMENT_SENT: "IN_PROGRESS",
    AGREEMENT_SIGNED: "IN_PROGRESS",
    WON: "WON",
    LOST: "LOST",
    SPAM: "SPAM",
  };
  for (const row of byStageRows) {
    const count = typeof row._count === "number" ? row._count : 0;
    const group = stageToGroup[row.stage];
    if (group) byStageGroup[group] += count;
    byStageGroup.ALL += count;
  }
  byStageGroup.OPEN = byStageGroup.NEW + byStageGroup.IN_PROGRESS;

  const items = pageRows.map((row) =>
    projectLeadRecord(row, {
      audience: "ADMIN",
      viewerId: "ADMIN",
      now,
      live: live.get(placeIdFor(row) ?? ""),
    }),
  );
  const last = pageRows.at(-1);
  return {
    items,
    nextCursor:
      hasMore && last
        ? encodeLeadCursor({
            createdAt:
              last.createdAt instanceof Date
                ? last.createdAt.toISOString()
                : new Date(last.createdAt).toISOString(),
            id: last.id,
          })
        : null,
    stats: {
      openCount,
      dueThisWeekCount,
      newThisWeekCount,
      openByIntent,
      byStageGroup,
    },
  };
}

export type AdminLeadDetail = LeadDetail;
