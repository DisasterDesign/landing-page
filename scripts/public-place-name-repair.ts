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
  expected: { prospectId: string; cycleId: string },
): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const metadata = value as Record<string, unknown>;
  return (
    Object.keys(metadata).sort().join(",") === "action,cycleId,prospectId,version" &&
    metadata.action === "PUBLISHED_PROSPECT_LEAD_CREATED" &&
    metadata.version === 1 &&
    metadata.prospectId === expected.prospectId &&
    metadata.cycleId === expected.cycleId
  );
}

export function validPublicPlaceCompanyName(value: string | null | undefined): string | null {
  const name = value?.trim();
  return name && name.length >= 2 && name.length <= 200 ? name : null;
}

export function assertOperationalPublicPlaceCompanyName(input: {
  displayName: string | null | undefined;
  businessStatus: string | null;
}): string {
  if (input.businessStatus !== "OPERATIONAL") {
    throw new Error("Google validation failed: business is not operational");
  }
  const company = validPublicPlaceCompanyName(input.displayName);
  if (!company) throw new Error("Google validation failed: invalid public business name");
  return company;
}

export function assertGoogleMapsProspectSnapshotIdentity(
  prospect: { placeId: string; cycleId: string; batchId: string | null },
  snapshot: Record<string, unknown>,
): void {
  if (snapshot.placeId !== prospect.placeId) {
    throw new Error("Target validation failed: source snapshot place mismatch");
  }
  if (snapshot.cycleId !== prospect.cycleId) {
    throw new Error("Target validation failed: source snapshot cycle mismatch");
  }
  if (
    typeof prospect.batchId !== "string" ||
    prospect.batchId.length === 0 ||
    snapshot.batchId !== prospect.batchId
  ) {
    throw new Error("Target validation failed: source snapshot batch mismatch");
  }
}

function hasExactKeys(value: unknown, keys: readonly string[]): boolean {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.keys(value as Record<string, unknown>).sort().join(",") === [...keys].sort().join(",")
  );
}

export function isExactActiveNameRepairEvent(
  event: {
    type: string;
    actorType: string;
    actorUserId: string | null;
    fromStage: string | null;
    toStage: string | null;
    dedupeKey: string | null;
    metadata: unknown;
  },
  leadId: string,
  stage: string,
): boolean {
  const metadata = event.metadata as Record<string, unknown>;
  return (
    event.type === "MIGRATED" &&
    event.actorType === "SYSTEM" &&
    event.actorUserId === null &&
    event.fromStage === stage &&
    event.toStage === stage &&
    event.dedupeKey === publicPlaceNameRepairDedupeKey(leadId) &&
    hasExactKeys(metadata, ["action", "provider", "version"]) &&
    metadata.action === "PUBLIC_PLACE_COMPANY_NAME_BACKFILLED" &&
    metadata.provider === "GOOGLE_PLACES" &&
    metadata.version === 1
  );
}

export function stableJson(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
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

function sortRelationById(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return [...value].sort((left, right) => {
    const leftId = typeof left === "object" && left !== null ? String((left as { id?: unknown }).id ?? "") : "";
    const rightId = typeof right === "object" && right !== null ? String((right as { id?: unknown }).id ?? "") : "";
    return leftId.localeCompare(rightId);
  });
}

export function protectedLeadState(lead: Record<string, unknown>): Record<string, unknown> {
  const { company, events, ...scalarsAndRelations } = lead;
  void company;
  const protectedEvents = Array.isArray(events)
    ? events.filter(
        (event) =>
          !(
            event &&
            typeof event === "object" &&
            (event as { dedupeKey?: unknown }).dedupeKey ===
              publicPlaceNameRepairDedupeKey(String(lead.id))
          ),
      )
    : events;
  return {
    ...scalarsAndRelations,
    events: sortRelationById(protectedEvents),
    notes: sortRelationById(scalarsAndRelations.notes),
    notifications: sortRelationById(scalarsAndRelations.notifications),
    agreements: sortRelationById(scalarsAndRelations.agreements),
    interactions: sortRelationById(scalarsAndRelations.interactions),
    followUps: sortRelationById(scalarsAndRelations.followUps),
    assignees: sortRelationById(scalarsAndRelations.assignees),
  };
}

export function assertPostWriteActiveNameRepairTargets(input: {
  expectedTargetCount: number;
  targetCount: number;
  pendingCount: number;
}): void {
  if (input.targetCount !== input.expectedTargetCount) {
    throw new Error("Post-write target count changed");
  }
  if (input.pendingCount !== 0) throw new Error("Post-write pending target remains");
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
