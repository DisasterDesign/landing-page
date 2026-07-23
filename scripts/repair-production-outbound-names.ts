import { Prisma } from "@prisma/client";

import { appendLeadEventOnce } from "@/lib/leads/events";
import { validateSourceSnapshot } from "@/lib/leads/source";
import { prisma } from "@/lib/prisma";
import { GooglePlacesProspectingProvider } from "@/lib/prospecting/places";
import type { LivePlaceDetails } from "@/lib/prospecting/types";

import {
  activeLeadStage,
  activeNameRepairManifestHash,
  assertActiveNameRepairApplyConfirmation,
  assertGoogleMapsProspectSnapshotIdentity,
  assertOperationalPublicPlaceCompanyName,
  assertPostWriteActiveNameRepairTargets,
  assertActiveNameRepairTargetCount,
  hasPublishedProspectLeadCreatedMetadata,
  isExactActiveNameRepairEvent,
  prospectCreatedByBackfillDedupeKey,
  publicPlaceNameRepairDedupeKey,
  protectedLeadState,
  safeActiveNameRepairSummary,
} from "./public-place-name-repair";

const leadInclude = {
  prospect: {
    select: {
      id: true,
      placeId: true,
      promotedLeadId: true,
      cycleId: true,
      batchId: true,
    },
  },
  assignees: { select: { id: true } },
  notes: { select: { id: true } },
  notifications: { select: { id: true } },
  agreements: { select: { id: true } },
  interactions: { select: { id: true } },
  followUps: { select: { id: true } },
  events: {
    select: {
      id: true,
      type: true,
      actorType: true,
      actorUserId: true,
      fromStage: true,
      toStage: true,
      metadata: true,
      dedupeKey: true,
      occurredAt: true,
      recordedAt: true,
    },
  },
} satisfies Prisma.ContactSubmissionInclude;

type RepairLead = Prisma.ContactSubmissionGetPayload<{
  include: typeof leadInclude;
}>;

type RepairTarget = {
  lead: RepairLead;
  placeId: string;
  state: "pending" | "alreadyRepaired";
  snapshot: Record<string, unknown>;
};

function hasCreatedByBackfillEvent(lead: RepairLead): boolean {
  const prospect = lead.prospect;
  if (!prospect) return false;
  return lead.events.some(
    (event) =>
      event.type === "MIGRATED" &&
      event.actorType === "SYSTEM" &&
      event.dedupeKey === prospectCreatedByBackfillDedupeKey(lead.id) &&
      hasPublishedProspectLeadCreatedMetadata(event.metadata, {
        prospectId: prospect.id,
        cycleId: prospect.cycleId,
      }),
  );
}

function hasBackfillProvenanceDedupeKey(lead: RepairLead): boolean {
  return lead.events.some(
    (event) => event.dedupeKey === prospectCreatedByBackfillDedupeKey(lead.id),
  );
}

function repairEvents(lead: RepairLead) {
  return lead.events.filter(
    (event) => event.dedupeKey === publicPlaceNameRepairDedupeKey(lead.id),
  );
}

function hasExactRepairEvent(lead: RepairLead): boolean {
  const events = repairEvents(lead);
  return (
    events.length === 1 &&
    isExactActiveNameRepairEvent(events[0], lead.id, lead.stage)
  );
}

function targetForLead(lead: RepairLead): RepairTarget | null {
  if (
    lead.intentLevel !== "OUTBOUND" ||
    lead.sourceKey !== "google_maps" ||
    !activeLeadStage(lead.stage)
  ) {
    return null;
  }
  if (!hasBackfillProvenanceDedupeKey(lead)) return null;
  if (!lead.prospect || lead.prospect.promotedLeadId !== lead.id) {
    throw new Error("Target validation failed: Prospect link drift");
  }
  if (!hasCreatedByBackfillEvent(lead)) {
    throw new Error("Target validation failed: backfill provenance drift");
  }
  const placeId = lead.prospect.placeId;
  if (lead.externalLeadId !== `gplaces:${placeId}`) {
    throw new Error("Target validation failed: external identity drift");
  }
  let snapshot: Record<string, unknown>;
  try {
    snapshot = validateSourceSnapshot("google_maps", lead.sourceSnapshot);
  } catch {
    throw new Error("Target validation failed: invalid source snapshot");
  }
  assertGoogleMapsProspectSnapshotIdentity(lead.prospect, snapshot);
  if (lead.migrationReviewRequired !== false) {
    throw new Error("Target validation failed: migration review is still required");
  }
  if (lead.name !== null) {
    throw new Error("Target validation failed: contact-person name must remain null");
  }
  const exactRepairEvent = hasExactRepairEvent(lead);
  if (lead.company !== null && !exactRepairEvent) {
    throw new Error("Target validation failed: company drift without repair event");
  }
  if (lead.company === null && repairEvents(lead).length > 0) {
    throw new Error("Target validation failed: repair event exists without company");
  }
  return {
    lead,
    placeId,
    state: lead.company === null ? "pending" : "alreadyRepaired",
    snapshot,
  };
}

function validatedTargets(leads: RepairLead[], expectedTargetCount: number): RepairTarget[] {
  const targets = leads
    .map(targetForLead)
    .filter((target): target is RepairTarget => target !== null)
    .sort((left, right) => left.lead.id.localeCompare(right.lead.id));
  if (targets.length !== expectedTargetCount) {
    throw new Error("Target validation failed: unexpected active historical target count");
  }
  return targets;
}

function manifestFor(targets: readonly RepairTarget[]): Record<string, unknown>[] {
  return targets.map(({ lead }) => protectedLeadState(lead));
}

async function loadScopedLeads(client: Pick<typeof prisma, "contactSubmission">): Promise<RepairLead[]> {
  return client.contactSubmission.findMany({
    where: {
      intentLevel: "OUTBOUND",
      sourceKey: "google_maps",
      stage: { notIn: ["WON", "LOST", "SPAM"] },
    },
    include: leadInclude,
  });
}

async function lockTargets(
  transaction: Prisma.TransactionClient,
  targets: readonly RepairTarget[],
): Promise<void> {
  for (const target of targets) {
    const locked = await transaction.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT "id" FROM "ContactSubmission" WHERE "id" = ${target.lead.id} FOR UPDATE`,
    );
    if (locked.length !== 1) throw new Error("Transaction validation failed: lead lock missing");
  }
  for (const target of [...targets].sort((left, right) => left.lead.prospect!.id.localeCompare(right.lead.prospect!.id))) {
    const locked = await transaction.$queryRaw<Array<{ id: string }>>(
      Prisma.sql`SELECT "id" FROM "Prospect" WHERE "id" = ${target.lead.prospect!.id} FOR UPDATE`,
    );
    if (locked.length !== 1) throw new Error("Transaction validation failed: Prospect lock missing");
  }
}

function assertSameManifest(beforeHash: string, targets: readonly RepairTarget[]): void {
  if (activeNameRepairManifestHash(manifestFor(targets)) !== beforeHash) {
    throw new Error("Transaction validation failed: protected manifest changed");
  }
}

function assertLiveDetails(
  pending: readonly RepairTarget[],
  details: Map<string, LivePlaceDetails>,
): Map<string, string> {
  const names = new Map<string, string>();
  for (const target of pending) {
    const detail = details.get(target.placeId);
    if (!detail || detail.placeId !== target.placeId) {
      throw new Error("Google validation failed: missing place details");
    }
    const company = assertOperationalPublicPlaceCompanyName(detail);
    names.set(target.lead.id, company);
  }
  return names;
}

async function validatePendingNames(pending: readonly RepairTarget[]): Promise<Map<string, string>> {
  if (pending.length === 0) return new Map();
  const apiKey = process.env.PROSPECTING_GOOGLE_PLACES_API_KEY?.trim();
  if (!apiKey) throw new Error("Google validation failed: Places credentials are unavailable");
  const provider = new GooglePlacesProspectingProvider({
    apiKey,
    maxDiscoveredPerCycle: pending.length,
    maxPlacesCallsPerCycle: pending.length,
    onDetailError: () => undefined,
  });
  return assertLiveDetails(
    pending,
    await provider.getLiveDetails(pending.map(({ placeId }) => placeId)),
  );
}

async function applyRepair(input: {
  targets: readonly RepairTarget[];
  expectedTargetCount: number;
  manifestHash: string;
  names: ReadonlyMap<string, string>;
  repairStartedAt: Date;
}): Promise<{ updated: number; eventsCreated: number }> {
  return prisma.$transaction(
    async (transaction) => {
      await lockTargets(transaction, input.targets);
      const reloaded = await loadScopedLeads(transaction);
      const lockedTargets = validatedTargets(reloaded, input.expectedTargetCount);
      assertSameManifest(input.manifestHash, lockedTargets);
      const pending = lockedTargets.filter((target) => target.state === "pending");
      if (pending.length !== input.names.size) {
        throw new Error("Transaction validation failed: pending target set changed");
      }

      let updated = 0;
      let eventsCreated = 0;
      for (const target of pending) {
        const company = input.names.get(target.lead.id);
        if (!company) throw new Error("Transaction validation failed: public business name missing");
        const result = await transaction.contactSubmission.updateMany({
          where: {
            id: target.lead.id,
            intentLevel: "OUTBOUND",
            sourceKey: "google_maps",
            externalLeadId: `gplaces:${target.placeId}`,
            stage: target.lead.stage,
            migrationReviewRequired: false,
            name: null,
            company: null,
            ownerId: target.lead.ownerId,
            eligibleSellerId: target.lead.eligibleSellerId,
            prospect: {
              is: { id: target.lead.prospect!.id, promotedLeadId: target.lead.id },
            },
          },
          data: { company },
        });
        if (result.count !== 1) {
          throw new Error("Transaction validation failed: company update count mismatch");
        }
        updated += result.count;
        const event = await appendLeadEventOnce(transaction, {
          leadId: target.lead.id,
          type: "MIGRATED",
          actor: { type: "SYSTEM", occurredAt: input.repairStartedAt },
          fromStage: target.lead.stage,
          toStage: target.lead.stage,
          occurredAt: input.repairStartedAt,
          dedupeKey: publicPlaceNameRepairDedupeKey(target.lead.id),
          metadata: {
            action: "PUBLIC_PLACE_COMPANY_NAME_BACKFILLED",
            provider: "GOOGLE_PLACES",
            version: 1,
          },
        });
        if (!event.created) throw new Error("Transaction validation failed: repair event already exists");
        eventsCreated += 1;
      }
      const postWriteLeads = await loadScopedLeads(transaction);
      const postWriteTargets = validatedTargets(postWriteLeads, input.expectedTargetCount);
      assertPostWriteActiveNameRepairTargets({
        expectedTargetCount: input.expectedTargetCount,
        targetCount: postWriteTargets.length,
        pendingCount: postWriteTargets.filter((target) => target.state === "pending").length,
      });
      assertSameManifest(input.manifestHash, postWriteTargets);
      return { updated, eventsCreated };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      maxWait: 10_000,
      timeout: 30_000,
    },
  );
}

async function main(): Promise<void> {
  const apply = assertActiveNameRepairApplyConfirmation();
  const expectedTargetCount = assertActiveNameRepairTargetCount();
  const scoped = await loadScopedLeads(prisma);
  const targets = validatedTargets(scoped, expectedTargetCount);
  const manifestHash = activeNameRepairManifestHash(manifestFor(targets));
  const pending = targets.filter((target) => target.state === "pending");
  const alreadyRepaired = targets.length - pending.length;
  const names = await validatePendingNames(pending);

  if (!apply) {
    console.log(
      JSON.stringify(safeActiveNameRepairSummary({
        expected: expectedTargetCount,
        total: targets.length,
        pending: pending.length,
        alreadyRepaired,
        updated: 0,
        eventsCreated: 0,
        manifestHash,
        mode: "dry-run",
      })),
    );
    return;
  }

  const repairStartedAt = new Date();
  const result = await applyRepair({
    targets,
    expectedTargetCount,
    manifestHash,
    names,
    repairStartedAt,
  });
  console.log(
    JSON.stringify(safeActiveNameRepairSummary({
      expected: expectedTargetCount,
      total: targets.length,
      pending: 0,
      alreadyRepaired: targets.length,
      updated: result.updated,
      eventsCreated: result.eventsCreated,
      manifestHash,
      mode: "apply",
    })),
  );
}

void main()
  .catch(() => {
    console.error("Active name repair failed; no repair summary was produced");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
