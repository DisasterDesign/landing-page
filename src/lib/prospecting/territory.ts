import { createHash } from "node:crypto";

import { notifyAllAdmins } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";

import { proposeTerritory } from "./ai";
import { getProspectingConfig } from "./config";
import { PROSPECTING_CATEGORY_QUERIES } from "./places";
import type { TerritoryProposalOutput } from "./types";

type TerritoryKind = "STREET" | "COMMERCIAL_CENTER" | "AREA";

const PROHIBITED_TERRITORY_PATTERN =
  /(?:\bmall\b|shopping\s+mall|shopping\s+center|קניון|דיזנגוף\s+סנטר|עזריאלי|גרנד\s+קניון|ביג\s+(?:פאשן|מרכז)|קמפוס|בית\s+חולים|אוניברסיט|אזור\s+תעשייה|פארק\s+תעשייה|מתחם\s+לוגיסט|corporate\s+campus|industrial\s+(?:zone|park)|logistics?\s+(?:center|park))/iu;
const BROAD_AREA_PATTERN = /(?:כל\s+העיר|רחבי\s+העיר|אזור\s+כללי|citywide|entire\s+city)/iu;
const CHAIN_DOMINANCE_PATTERN = /(?:רוב[^.]{0,40}רשת|דומיננט[^.]{0,30}רשת|chain[-\s]?dominat)/iu;

export function validateTerritoryProposal(
  proposal: Omit<TerritoryProposalOutput, "kind"> & { kind: TerritoryKind },
): { ok: true } | { ok: false; reason: string } {
  if (proposal.kind === "AREA") {
    return { ok: false, reason: "Broad AREA territories are not allowed" };
  }
  if (proposal.searchQueries.length < 2 || proposal.searchQueries.length > 4) {
    return { ok: false, reason: "Territory must contain two to four bounded search queries" };
  }

  const combined = [
    proposal.displayName,
    proposal.city,
    proposal.rationale,
    proposal.independentBusinessRationale,
    ...proposal.searchQueries,
    ...proposal.riskFactors,
  ].join(" ");
  if (PROHIBITED_TERRITORY_PATTERN.test(combined)) {
    return { ok: false, reason: "Territory is a prohibited mall, institution, or large complex" };
  }
  if (BROAD_AREA_PATTERN.test(combined)) {
    return { ok: false, reason: "Territory is not a bounded micro-market" };
  }
  if (CHAIN_DOMINANCE_PATTERN.test(combined)) {
    return { ok: false, reason: "Territory is described as chain-dominated" };
  }
  return { ok: true };
}

export function buildDiscoveryQueries(
  searchQueries: readonly string[],
  categories: readonly string[] = PROSPECTING_CATEGORY_QUERIES,
): string[] {
  return searchQueries.flatMap((searchQuery) =>
    categories.map((category) => `${category} ${searchQuery}`),
  );
}

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
  const existing = await prisma.prospectingCycle.findFirst({
    where: { weekStart, supersededAt: null },
    orderBy: { revision: "desc" },
  });
  if (existing) return { action: "exists", cycleId: existing.id };

  const [sellerSetting, targetSetting, previousProposals] = await Promise.all([
    prisma.keyValue.findUnique({ where: { key: "prospecting:defaultSellerId" } }),
    prisma.keyValue.findUnique({ where: { key: "prospecting:weeklyTarget" } }),
    prisma.territoryProposal.findMany({
      where: { status: "APPROVED" },
      select: { coverageKey: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);
  const sellerId = settingString(sellerSetting?.value);
  if (!sellerId) throw new Error("No default seller is configured for prospecting");
  const storedTarget = typeof targetSetting?.value === "number" ? targetSetting.value : config.weeklyTarget;
  const targetCount = Math.min(Math.max(Math.trunc(storedTarget), 1), 50);

  const cycle = await prisma.prospectingCycle.create({
    data: {
      weekStart,
      targetCount,
      assignedSellerId: sellerId,
      status: "PROPOSING",
    },
  });

  try {
    const proposalResult = await (dependencies.propose ?? proposeTerritory)(
      {
        previousCoverageKeys: previousProposals.map(({ coverageKey }) => coverageKey),
        performanceSummary: { requestedProspects: targetCount },
      },
      { apiKey: config.aiApiKey, model: config.aiModel },
    );
    const proposal = proposalResult.value;
    const validation = validateTerritoryProposal(proposal);
    if (!validation.ok) throw new Error(validation.reason);
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
          searchQuery: proposal.searchQueries[0],
          searchQueries: proposal.searchQueries,
          coverageKey,
          rationale: proposal.rationale,
          independentBusinessRationale: proposal.independentBusinessRationale,
          riskFactors: proposal.riskFactors,
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

export async function createReplacementProposal(
  cycleId: string,
  dependencies: {
    propose?: typeof proposeTerritory;
    notifyAdmins?: typeof notifyAllAdmins;
  } = {},
): Promise<{ proposalId: string }> {
  const config = getProspectingConfig();
  const cycle = await prisma.prospectingCycle.findUnique({ where: { id: cycleId } });
  if (!cycle) throw new Error("Prospecting cycle not found");

  const previousProposals = await prisma.territoryProposal.findMany({
    where: { OR: [{ status: "APPROVED" }, { cycleId }] },
    select: { coverageKey: true },
    orderBy: { createdAt: "desc" },
    take: 250,
  });
  const proposalResult = await (dependencies.propose ?? proposeTerritory)(
    {
      previousCoverageKeys: previousProposals.map(({ coverageKey }) => coverageKey),
      performanceSummary: { requestedProspects: cycle.targetCount, replacement: true },
    },
    { apiKey: config.aiApiKey, model: config.aiModel },
  );
  const proposal = proposalResult.value;
  const validation = validateTerritoryProposal(proposal);
  if (!validation.ok) throw new Error(validation.reason);
  const coverageKey = createCoverageKey(proposal);
  if (previousProposals.some((previous) => previous.coverageKey === coverageKey)) {
    throw new Error("AI proposed a territory that was already considered");
  }

  const saved = await prisma.$transaction(async (transaction) => {
    const created = await transaction.territoryProposal.create({
      data: {
        cycleId,
        displayName: proposal.displayName,
        city: proposal.city,
        kind: proposal.kind,
        searchQuery: proposal.searchQueries[0],
        searchQueries: proposal.searchQueries,
        coverageKey,
        rationale: proposal.rationale,
        independentBusinessRationale: proposal.independentBusinessRationale,
        riskFactors: proposal.riskFactors,
        expectedBusinessTypes: proposal.expectedBusinessTypes,
        confidence: proposal.confidence,
      },
    });
    await transaction.prospectingCycle.update({
      where: { id: cycleId },
      data: {
        status: "AWAITING_APPROVAL",
        lastError: null,
        aiInputTokens: { increment: proposalResult.usage.inputTokens },
        aiOutputTokens: { increment: proposalResult.usage.outputTokens },
      },
    });
    return created;
  });
  await (dependencies.notifyAdmins ?? notifyAllAdmins)({
    type: "PROSPECTING_APPROVAL",
    title: "אזור חלופי ממתין לאישור",
    body: `${proposal.displayName}, ${proposal.city}`,
    url: `/admin/prospecting?proposal=${saved.id}`,
  });
  return { proposalId: saved.id };
}
