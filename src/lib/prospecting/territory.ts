import { createHash } from "node:crypto";

import { notifyAllAdmins } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

import { proposeTerritory } from "./ai";
import { getProspectingConfig } from "./config";

type TerritoryKind = "STREET" | "COMMERCIAL_CENTER" | "AREA";

export function normalizeTerritoryText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f\u0591-\u05c7]/g, "")
    .toLocaleLowerCase("en")
    .replace(/\b(?:street|st)\.?\b/gi, " ")
    .replace(/(?:^|\s)(?:רחוב|רח[׳']?)(?=\s|$)/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function createCoverageKey(input: {
  displayName: string;
  city: string;
  kind: TerritoryKind;
}): string {
  const canonical = [
    input.kind,
    normalizeTerritoryText(input.city),
    normalizeTerritoryText(input.displayName),
  ].join("|");
  return createHash("sha256").update(canonical).digest("hex");
}

export function startOfProspectingWeek(now: Date): Date {
  const weekStart = new Date(now);
  weekStart.setUTCHours(0, 0, 0, 0);
  weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
  return weekStart;
}

function settingString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export async function createWeeklyProposal(
  now = new Date(),
  dependencies: {
    propose?: typeof proposeTerritory;
    notifyAdmins?: typeof notifyAllAdmins;
  } = {},
): Promise<{
  action: "disabled" | "exists" | "proposed";
  cycleId?: string;
  proposalId?: string;
}> {
  const config = getProspectingConfig();
  if (!config.enabled) return { action: "disabled" };

  const weekStart = startOfProspectingWeek(now);
  const existing = await prisma.prospectingCycle.findUnique({ where: { weekStart } });
  if (existing) return { action: "exists", cycleId: existing.id };

  const [sellerSetting, previousProposals] = await Promise.all([
    prisma.keyValue.findUnique({ where: { key: "prospecting:defaultSellerId" } }),
    prisma.territoryProposal.findMany({
      where: { status: "APPROVED" },
      select: { coverageKey: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);
  const sellerId = settingString(sellerSetting?.value);
  if (!sellerId) throw new Error("No default seller is configured for prospecting");

  const cycle = await prisma.prospectingCycle.create({
    data: {
      weekStart,
      targetCount: config.weeklyTarget,
      assignedSellerId: sellerId,
      status: "PROPOSING",
    },
  });

  try {
    const proposalResult = await (dependencies.propose ?? proposeTerritory)(
      {
        previousCoverageKeys: previousProposals.map(({ coverageKey }) => coverageKey),
        performanceSummary: { requestedProspects: config.weeklyTarget },
      },
      { apiKey: config.aiApiKey, model: config.aiModel },
    );
    const proposal = proposalResult.value;
    const coverageKey = createCoverageKey(proposal);
    if (previousProposals.some((previous) => previous.coverageKey === coverageKey)) {
      throw new Error("AI proposed a territory that was already approved");
    }

    const saved = await prisma.$transaction(async (transaction) => {
      const created = await transaction.territoryProposal.create({
        data: {
          cycleId: cycle.id,
          displayName: proposal.displayName,
          city: proposal.city,
          kind: proposal.kind,
          searchQuery: proposal.searchQuery,
          coverageKey,
          rationale: proposal.rationale,
          expectedBusinessTypes: proposal.expectedBusinessTypes,
          confidence: proposal.confidence,
        },
      });
      await transaction.prospectingCycle.update({
        where: { id: cycle.id },
        data: {
          status: "AWAITING_APPROVAL",
          aiInputTokens: { increment: proposalResult.usage.inputTokens },
          aiOutputTokens: { increment: proposalResult.usage.outputTokens },
        },
      });
      return created;
    });

    await (dependencies.notifyAdmins ?? notifyAllAdmins)({
      type: "PROSPECTING_APPROVAL",
      title: "אזור חדש ממתין לאישור",
      body: `${proposal.displayName}, ${proposal.city}`,
      url: `/admin/prospecting?proposal=${saved.id}`,
    });
    return { action: "proposed", cycleId: cycle.id, proposalId: saved.id };
  } catch (error) {
    await prisma.prospectingCycle.update({
      where: { id: cycle.id },
      data: { status: "FAILED", lastError: error instanceof Error ? error.message : "Unknown error" },
    });
    throw error;
  }
}
