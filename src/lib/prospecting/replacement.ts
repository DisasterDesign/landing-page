import { prisma } from "@/lib/prisma";

import { createReplacementProposal } from "./territory";

export interface ReplacementSource {
  id: string;
  status: string;
  weekStart: Date;
  revision: number;
  targetCount: number;
  assignedSellerId: string | null;
  batchId: string | null;
  supersededAt: Date | null;
  existingReplacement: { id: string; hasProposal: boolean } | null;
}

export interface ReplacementTransactionInput {
  cycleId: string;
  batchId: string;
  weekStart: Date;
  revision: number;
  targetCount: number;
  assignedSellerId: string;
  reason: string;
  supersededAt: Date;
  invalidateOnlyUntouched: true;
}

export interface ProspectingReplacementStore {
  findSource(cycleId: string): Promise<ReplacementSource | null>;
  supersedeAndCreate(
    input: ReplacementTransactionInput,
  ): Promise<{ replacementCycleId: string; invalidatedProspects: number }>;
}

const prismaReplacementStore: ProspectingReplacementStore = {
  async findSource(cycleId) {
    const cycle = await prisma.prospectingCycle.findUnique({
      where: { id: cycleId },
      include: { batch: { select: { id: true } } },
    });
    if (!cycle) return null;
    const replacement = await prisma.prospectingCycle.findUnique({
      where: {
        weekStart_revision: {
          weekStart: cycle.weekStart,
          revision: cycle.revision + 1,
        },
      },
      include: { proposals: { select: { id: true }, take: 1 } },
    });
    return {
      id: cycle.id,
      status: cycle.status,
      weekStart: cycle.weekStart,
      revision: cycle.revision,
      targetCount: cycle.targetCount,
      assignedSellerId: cycle.assignedSellerId,
      batchId: cycle.batch?.id ?? null,
      supersededAt: cycle.supersededAt,
      existingReplacement: replacement
        ? { id: replacement.id, hasProposal: replacement.proposals.length > 0 }
        : null,
    };
  },

  async supersedeAndCreate(input) {
    return prisma.$transaction(async (transaction) => {
      const superseded = await transaction.prospectingCycle.updateMany({
        where: { id: input.cycleId, supersededAt: null, status: "PUBLISHED" },
        data: {
          supersededAt: input.supersededAt,
          supersededReason: input.reason,
        },
      });
      if (superseded.count !== 1) {
        throw new Error("Published prospecting cycle was already superseded");
      }
      await transaction.weeklyProspectBatch.update({
        where: { id: input.batchId },
        data: {
          supersededAt: input.supersededAt,
          supersededReason: input.reason,
        },
      });
      const invalidated = await transaction.prospect.updateMany({
        where: {
          cycleId: input.cycleId,
          status: "PUBLISHED",
          interactions: { none: {} },
        },
        data: {
          status: "INVALID",
          salesFitReason: input.reason,
        },
      });
      const replacement = await transaction.prospectingCycle.create({
        data: {
          weekStart: input.weekStart,
          revision: input.revision,
          targetCount: input.targetCount,
          assignedSellerId: input.assignedSellerId,
          status: "PROPOSING",
        },
      });
      return {
        replacementCycleId: replacement.id,
        invalidatedProspects: invalidated.count,
      };
    });
  },
};

export async function supersedePublishedCycle(
  cycleId: string,
  reason: string,
  now = new Date(),
  dependencies: {
    store?: ProspectingReplacementStore;
    createProposal?: (cycleId: string) => Promise<void>;
  } = {},
): Promise<{ replacementCycleId: string; invalidatedProspects: number }> {
  const store = dependencies.store ?? prismaReplacementStore;
  const source = await store.findSource(cycleId);
  if (!source) throw new Error("Prospecting cycle not found");

  if (source.supersededAt) {
    if (!source.existingReplacement) {
      throw new Error("Superseded cycle has no replacement revision");
    }
    if (!source.existingReplacement.hasProposal) {
      await (dependencies.createProposal ?? defaultCreateProposal)(
        source.existingReplacement.id,
      );
    }
    return {
      replacementCycleId: source.existingReplacement.id,
      invalidatedProspects: 0,
    };
  }
  if (source.status !== "PUBLISHED") {
    throw new Error("Only a published prospecting cycle can be superseded");
  }
  if (!source.batchId) {
    throw new Error("Published prospecting cycle has no batch");
  }
  if (!source.assignedSellerId) {
    throw new Error("Published prospecting cycle has no assigned seller");
  }
  const boundedReason = reason.trim();
  if (boundedReason.length < 5 || boundedReason.length > 500) {
    throw new Error("Replacement reason must contain 5-500 characters");
  }

  const result = await store.supersedeAndCreate({
    cycleId: source.id,
    batchId: source.batchId,
    weekStart: source.weekStart,
    revision: source.revision + 1,
    targetCount: source.targetCount,
    assignedSellerId: source.assignedSellerId,
    reason: boundedReason,
    supersededAt: now,
    invalidateOnlyUntouched: true,
  });
  await (dependencies.createProposal ?? defaultCreateProposal)(
    result.replacementCycleId,
  );
  return result;
}

async function defaultCreateProposal(cycleId: string): Promise<void> {
  await createReplacementProposal(cycleId);
}
