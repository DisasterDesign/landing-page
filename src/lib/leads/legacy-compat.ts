import { createHash } from "node:crypto";
import type { AcquisitionChannel, ContactStatus } from "@prisma/client";

type LegacyDate = Date | string | null | undefined;

export interface LegacyLeadStateInput {
  status: ContactStatus;
  assigneeIds: readonly string[];
  source: string | null | undefined;
  acquisitionChannel: AcquisitionChannel | null | undefined;
  externalLeadId: string | null | undefined;
  externalFormId: string | null | undefined;
  externalFormName: string | null | undefined;
  externalCampaignId: string | null | undefined;
  externalAdId: string | null | undefined;
  nextFollowUpAt: LegacyDate;
  lastContactedAt: LegacyDate;
  closedAt: LegacyDate;
}

const allowedKeys = new Set<keyof LegacyLeadStateInput>([
  "status",
  "assigneeIds",
  "source",
  "acquisitionChannel",
  "externalLeadId",
  "externalFormId",
  "externalFormName",
  "externalCampaignId",
  "externalAdId",
  "nextFollowUpAt",
  "lastContactedAt",
  "closedAt",
]);

function normalizedDate(value: LegacyDate): string | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("invalid legacy state date");
  }
  return date.toISOString();
}

function nullableString(value: string | null | undefined): string | null {
  return value ?? null;
}

export function legacyLeadStateHash(input: LegacyLeadStateInput): string {
  for (const key of Object.keys(input)) {
    if (!allowedKeys.has(key as keyof LegacyLeadStateInput)) {
      throw new Error(`unsupported legacy state key: ${key}`);
    }
  }

  const canonical = {
    status: input.status,
    assigneeIds: [...input.assigneeIds].sort(),
    source: nullableString(input.source),
    acquisitionChannel: input.acquisitionChannel ?? null,
    externalLeadId: nullableString(input.externalLeadId),
    externalFormId: nullableString(input.externalFormId),
    externalFormName: nullableString(input.externalFormName),
    externalCampaignId: nullableString(input.externalCampaignId),
    externalAdId: nullableString(input.externalAdId),
    nextFollowUpAt: normalizedDate(input.nextFollowUpAt),
    lastContactedAt: normalizedDate(input.lastContactedAt),
    closedAt: normalizedDate(input.closedAt),
  };

  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}
