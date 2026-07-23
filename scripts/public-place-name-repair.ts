import { createHash } from "node:crypto";

export const EXPECTED_ACTIVE_NAME_REPAIR_TARGET_COUNT = 11;

export function expectedActiveNameRepairTargetCount(
  env: Record<string, string | undefined> = process.env,
): number {
  const value = env.ACTIVE_NAME_REPAIR_TARGET_COUNT;
  if (value === undefined) return EXPECTED_ACTIVE_NAME_REPAIR_TARGET_COUNT;
  if (!/^\d+$/.test(value)) {
    throw new Error("ACTIVE_NAME_REPAIR_TARGET_COUNT must be a positive integer");
  }
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 1) {
    throw new Error("ACTIVE_NAME_REPAIR_TARGET_COUNT must be a positive integer");
  }
  return count;
}

export function assertActiveNameRepairTargetCount(
  env: Record<string, string | undefined> = process.env,
): number {
  const count = expectedActiveNameRepairTargetCount(env);
  if (count !== EXPECTED_ACTIVE_NAME_REPAIR_TARGET_COUNT) {
    throw new Error("ACTIVE_NAME_REPAIR_TARGET_COUNT must be exactly 11");
  }
  return count;
}

export function assertActiveNameRepairApplyConfirmation(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const apply = env.APPLY;
  if (apply === undefined) return false;
  if (apply !== "1") throw new Error("APPLY must be exactly 1 when set");
  if (env.CONFIRM_ACTIVE_NAME_REPAIR !== "11") {
    throw new Error("CONFIRM_ACTIVE_NAME_REPAIR must be exactly 11 when APPLY=1");
  }
  return true;
}

export function activeLeadStage(stage: string): boolean {
  return stage !== "WON" && stage !== "LOST" && stage !== "SPAM";
}

export function publicPlaceNameRepairDedupeKey(leadId: string): string {
  return `lead:${leadId}:public-place-company-name-backfill:v1`;
}

export function prospectCreatedByBackfillDedupeKey(leadId: string): string {
  return `lead:${leadId}:prospect-created-by-backfill:v1`;
}

export function hasPublishedProspectLeadCreatedMetadata(
  value: unknown,
  prospectId: string,
): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const metadata = value as Record<string, unknown>;
  return (
    metadata.action === "PUBLISHED_PROSPECT_LEAD_CREATED" &&
    metadata.version === 1 &&
    metadata.prospectId === prospectId &&
    typeof metadata.cycleId === "string" &&
    metadata.cycleId.trim().length > 0
  );
}

export function validPublicPlaceCompanyName(value: string | null | undefined): string | null {
  const name = value?.trim();
  return name && name.length >= 2 && name.length <= 200 ? name : null;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function activeNameRepairManifestHash(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

export function safeActiveNameRepairSummary(input: {
  expected: number;
  total: number;
  pending: number;
  alreadyRepaired: number;
  updated: number;
  eventsCreated: number;
  manifestHash: string;
  mode: "dry-run" | "apply";
} & Record<string, unknown>): {
  expected: number;
  total: number;
  pending: number;
  alreadyRepaired: number;
  updated: number;
  eventsCreated: number;
  manifestHash: string;
  mode: "dry-run" | "apply";
} {
  return {
    expected: input.expected,
    total: input.total,
    pending: input.pending,
    alreadyRepaired: input.alreadyRepaired,
    updated: input.updated,
    eventsCreated: input.eventsCreated,
    manifestHash: input.manifestHash,
    mode: input.mode,
  };
}
