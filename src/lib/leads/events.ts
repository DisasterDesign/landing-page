import type {
  LeadActorType,
  LeadEvent,
  LeadEventType,
  LeadStage,
  Prisma,
} from "@prisma/client";

import type { LeadActor } from "./types";

const forbiddenMetadataKeys = new Set(["phone", "email", "rawpayload"]);

export interface AppendLeadEventInput {
  leadId: string;
  type: LeadEventType;
  actor: LeadActor;
  fromStage?: LeadStage | null;
  toStage?: LeadStage | null;
  metadata?: Record<string, unknown>;
  dedupeKey?: string;
  occurredAt?: Date;
}

type LeadEventCreateData = {
  leadId: string;
  type: LeadEventType;
  actorType: LeadActorType;
  actorUserId?: string;
  fromStage?: LeadStage | null;
  toStage?: LeadStage | null;
  metadata?: Prisma.InputJsonValue;
  dedupeKey?: string;
  occurredAt: Date;
};

export interface LeadEventTransaction {
  leadEvent: {
    create(args: { data: LeadEventCreateData }): Promise<LeadEvent>;
    createMany(args: {
      data: LeadEventCreateData;
      skipDuplicates: true;
    }): Promise<{ count: number }>;
    findUnique(args: {
      where: { dedupeKey: string };
    }): Promise<LeadEvent | null>;
  };
}

function assertSafeMetadata(value: unknown, path: string[] = []): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertSafeMetadata(item, [...path, String(index)]),
    );
    return;
  }
  if (value === null || typeof value !== "object") return;

  for (const [key, nested] of Object.entries(value)) {
    if (forbiddenMetadataKeys.has(key.toLowerCase())) {
      throw new Error(
        `Lead event metadata contains forbidden key ${[...path, key].join(".")}`,
      );
    }
    assertSafeMetadata(nested, [...path, key]);
  }
}

function eventData(input: AppendLeadEventInput): LeadEventCreateData {
  if (input.metadata) assertSafeMetadata(input.metadata);
  return {
    leadId: input.leadId,
    type: input.type,
    actorType: input.actor.type,
    actorUserId: input.actor.userId,
    fromStage: input.fromStage,
    toStage: input.toStage,
    metadata: input.metadata as Prisma.InputJsonValue | undefined,
    dedupeKey: input.dedupeKey,
    occurredAt: input.occurredAt ?? input.actor.occurredAt ?? new Date(),
  };
}

export async function appendLeadEvent(
  transaction: LeadEventTransaction,
  input: AppendLeadEventInput,
): Promise<LeadEvent> {
  return transaction.leadEvent.create({ data: eventData(input) });
}

export async function appendLeadEventOnce(
  transaction: LeadEventTransaction,
  input: AppendLeadEventInput & { dedupeKey: string },
): Promise<{ created: boolean; event: LeadEvent }> {
  const result = await transaction.leadEvent.createMany({
    data: eventData(input),
    skipDuplicates: true,
  });
  const event = await transaction.leadEvent.findUnique({
    where: { dedupeKey: input.dedupeKey },
  });
  if (!event) {
    throw new Error("Lead event dedupe row is missing after persistence");
  }
  return { created: result.count === 1, event };
}
