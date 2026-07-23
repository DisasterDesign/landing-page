import { createHash } from "node:crypto";
import type { LeadStage } from "@prisma/client";

export interface MigrationNoteSnapshot {
  id: string;
  contactId: string;
  authorId: string;
  createdAt: Date;
}

export interface UnifiedLeadMigrationBaseline {
  version: number;
  capturedAt: string;
  contactSubmissionCount: number;
  contactSubmissionIds: string[];
  contactNoteCount: number;
  contactNoteIds: string[];
  contactNoteHistoryHash: string;
}

interface SupersessionSafetyInput {
  stage: LeadStage | null;
  hasProspect: boolean;
  replaced: boolean;
  ownerId: string | null;
  legacyAssigneeCount: number;
  canonicalInteractionCount: number;
  prospectInteractionCount: number;
}

export function shouldInvalidateLeadForSupersession(
  input: SupersessionSafetyInput,
): boolean {
  return (
    input.hasProspect &&
    input.replaced &&
    input.stage === "NEW" &&
    input.ownerId === null &&
    input.legacyAssigneeCount === 0 &&
    input.canonicalInteractionCount === 0 &&
    input.prospectInteractionCount === 0
  );
}

export function stageAfterSupersession(
  input: SupersessionSafetyInput,
): LeadStage | null {
  return shouldInvalidateLeadForSupersession(input) ? "LOST" : input.stage;
}

export function shouldCancelScheduledFollowUpDuringBackfill(input: {
  stage: LeadStage | null;
  hasScheduledFollowUp: boolean;
  needsLegacyFollowUp: boolean;
}): boolean {
  return (
    input.hasScheduledFollowUp &&
    !input.needsLegacyFollowUp &&
    (input.stage === "WON" ||
      input.stage === "LOST" ||
      input.stage === "SPAM")
  );
}

function noteHistoryHash(notes: readonly MigrationNoteSnapshot[]): string {
  return createHash("sha256")
    .update(
      JSON.stringify(
        notes.map((note) => ({
          id: note.id,
          contactId: note.contactId,
          authorId: note.authorId,
          createdAt: note.createdAt.toISOString(),
        })),
      ),
    )
    .digest("hex");
}

export async function captureMigrationBaseline(
  loader: {
    loadLeadIds(): Promise<string[]>;
    loadNotes(): Promise<MigrationNoteSnapshot[]>;
  },
  options: {
    version: number;
    now?: () => Date;
  },
): Promise<UnifiedLeadMigrationBaseline> {
  const capturedAt = (options.now ?? (() => new Date()))();
  const [leadIds, notes] = await Promise.all([
    loader.loadLeadIds(),
    loader.loadNotes(),
  ]);
  const sortedLeadIds = [...leadIds].sort();
  const sortedNotes = [...notes].sort(
    (left, right) =>
      left.createdAt.getTime() - right.createdAt.getTime() ||
      left.id.localeCompare(right.id),
  );
  return {
    version: options.version,
    capturedAt: capturedAt.toISOString(),
    contactSubmissionCount: sortedLeadIds.length,
    contactSubmissionIds: sortedLeadIds,
    contactNoteCount: sortedNotes.length,
    contactNoteIds: sortedNotes.map(({ id }) => id),
    contactNoteHistoryHash: noteHistoryHash(sortedNotes),
  };
}

export function parseMigrationBaseline(
  value: unknown,
): UnifiedLeadMigrationBaseline | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const rawLeadIds = Array.isArray(record.contactSubmissionIds)
    ? record.contactSubmissionIds
    : null;
  const leadIds = rawLeadIds
    ? rawLeadIds.filter(
        (item): item is string => typeof item === "string" && item.length > 0,
      )
    : null;
  const rawNoteIds = Array.isArray(record.contactNoteIds)
    ? record.contactNoteIds
    : null;
  const noteIds = rawNoteIds
    ? rawNoteIds.filter(
        (item): item is string => typeof item === "string" && item.length > 0,
      )
    : null;
  const capturedAt =
    typeof record.capturedAt === "string" ? record.capturedAt : null;
  const validCapturedAt =
    capturedAt !== null && !Number.isNaN(new Date(capturedAt).getTime());
  if (
    !Number.isInteger(record.version) ||
    !validCapturedAt ||
    !Number.isInteger(record.contactSubmissionCount) ||
    !Number.isInteger(record.contactNoteCount) ||
    !leadIds ||
    !rawLeadIds ||
    leadIds.length !== rawLeadIds.length ||
    new Set(leadIds).size !== leadIds.length ||
    leadIds.length !== record.contactSubmissionCount ||
    !noteIds ||
    !rawNoteIds ||
    noteIds.length !== rawNoteIds.length ||
    new Set(noteIds).size !== noteIds.length ||
    noteIds.length !== record.contactNoteCount ||
    typeof record.contactNoteHistoryHash !== "string" ||
    !/^[a-f0-9]{64}$/.test(record.contactNoteHistoryHash)
  ) {
    return null;
  }
  return {
    version: record.version as number,
    capturedAt,
    contactSubmissionCount: record.contactSubmissionCount as number,
    contactSubmissionIds: leadIds,
    contactNoteCount: record.contactNoteCount as number,
    contactNoteIds: noteIds,
    contactNoteHistoryHash: record.contactNoteHistoryHash,
  };
}

export function missingBaselineLeadIds(
  baseline: UnifiedLeadMigrationBaseline,
  currentLeadIds: readonly string[],
): string[] {
  const current = new Set(currentLeadIds);
  return baseline.contactSubmissionIds.filter((id) => !current.has(id));
}

export function baselineNoteHistoryIsIntact(
  baseline: UnifiedLeadMigrationBaseline,
  currentNotes: readonly MigrationNoteSnapshot[],
): boolean {
  const baselineIds = new Set(baseline.contactNoteIds);
  const originalNotes = currentNotes
    .filter(({ id }) => baselineIds.has(id))
    .sort(
      (left, right) =>
        left.createdAt.getTime() - right.createdAt.getTime() ||
        left.id.localeCompare(right.id),
    );
  return (
    originalNotes.length === baseline.contactNoteCount &&
    noteHistoryHash(originalNotes) === baseline.contactNoteHistoryHash
  );
}

export function shouldRequireBackfillNoteSnapshot(
  baseline: UnifiedLeadMigrationBaseline,
  leadId: string,
): boolean {
  return baseline.contactSubmissionIds.includes(leadId);
}
