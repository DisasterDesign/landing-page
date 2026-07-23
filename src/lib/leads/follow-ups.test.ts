import assert from "node:assert/strict";
import test from "node:test";

import {
  cancelDuplicateFollowUpForMigrationInTransaction,
  completeFollowUp,
  rescheduleFollowUp,
  scheduleFollowUp,
  type FollowUpStore,
} from "./follow-ups";
import { addLeadNote } from "./interactions";

function fakeStore(options: {
  ownerId?: string;
  review?: boolean;
  doNotContactAt?: Date | null;
} = {}): FollowUpStore & {
  followUps: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
  notes: Array<Record<string, unknown>>;
  lead: Record<string, unknown>;
} {
  const followUps: Array<Record<string, unknown>> = [];
  const events: Array<Record<string, unknown>> = [];
  const notes: Array<Record<string, unknown>> = [];
  const lead: Record<string, unknown> = {
    id: "lead-1",
    ownerId: options.ownerId ?? "seller-1",
    eligibleSellerId: "seller-1",
    migrationReviewRequired: options.review ?? false,
    doNotContactAt: options.doNotContactAt ?? null,
    intentLevel: "OUTBOUND",
    sourceKey: "google_maps",
    stage: "CONTACTING",
    status: "IN_PROGRESS",
    source: "GOOGLE_PROSPECTING",
    acquisitionChannel: "GOOGLE_PROSPECTING",
    externalLeadId: "gplaces:place-1",
    externalFormId: null,
    externalFormName: null,
    externalCampaignId: null,
    externalAdId: null,
    nextFollowUpAt: null,
    lastContactedAt: null,
    closedAt: null,
    assignees: [{ id: options.ownerId ?? "seller-1" }],
  };
  const transaction = {
    user: {
      async findUnique({ where }: { where: { id: string } }) {
        return {
          role: where.id === "admin-1" ? "ADMIN" : "SELLER",
        };
      },
    },
    contactSubmission: {
      async findUnique() {
        return lead;
      },
      async update({ data }: { data: Record<string, unknown> }) {
        Object.assign(lead, data);
        return lead;
      },
    },
    leadFollowUp: {
      async findFirst({ where }: { where: Record<string, unknown> }) {
        return (
          followUps.find(
            (item) =>
              item.leadId === where.leadId &&
              item.status === "SCHEDULED" &&
              (!where.id ||
                typeof where.id !== "object" ||
                item.id !== (where.id as { not?: string }).not),
          ) ?? null
        );
      },
      async findUnique({ where }: { where: { id: string } }) {
        return followUps.find((item) => item.id === where.id) ?? null;
      },
      async create({ data }: { data: Record<string, unknown> }) {
        const row = {
          id: `follow-up-${followUps.length + 1}`,
          status: "SCHEDULED",
          ...data,
        };
        followUps.push(row);
        return row;
      },
      async update({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) {
        const row = followUps.find((item) => item.id === where.id);
        if (!row) throw new Error("missing follow-up");
        Object.assign(row, data);
        return row;
      },
      async updateMany({ data }: { data: Record<string, unknown> }) {
        const active = followUps.filter((item) => item.status === "SCHEDULED");
        active.forEach((item) => Object.assign(item, data));
        return { count: active.length };
      },
    },
    contactNote: {
      async create({ data }: { data: Record<string, unknown> }) {
        const note = {
          id: `note-${notes.length + 1}`,
          createdAt: new Date(),
          ...data,
        };
        notes.push(note);
        return note;
      },
    },
    leadEvent: {
      async create({ data }: { data: Record<string, unknown> }) {
        const event = { id: `event-${events.length + 1}`, ...data };
        events.push(event);
        return event;
      },
      async createMany({ data }: { data: Record<string, unknown> }) {
        if (
          data.dedupeKey &&
          events.some((event) => event.dedupeKey === data.dedupeKey)
        ) {
          return { count: 0 };
        }
        events.push({ id: `event-${events.length + 1}`, ...data });
        return { count: 1 };
      },
      async findUnique({ where }: { where: { dedupeKey: string } }) {
        return (
          events.find((event) => event.dedupeKey === where.dedupeKey) ?? null
        );
      },
    },
  };
  return {
    followUps,
    events,
    notes,
    lead,
    async transaction(callback) {
      return callback(transaction as never);
    },
  };
}

const seller = { userId: "seller-1", role: "SELLER" as const };

test("schedule, reschedule and complete maintain one active task and timeline events", async () => {
  const store = fakeStore();
  const firstDue = new Date(Date.now() + 60_000);
  const secondDue = new Date(Date.now() + 120_000);
  const first = await scheduleFollowUp(
    {
      leadId: "lead-1",
      dueAt: firstDue,
      reason: "Requested a callback",
      actor: seller,
    },
    { store },
  );
  assert.equal(store.lead.nextFollowUpAt, firstDue);
  assert.equal(
    store.events.filter((event) => event.type === "FOLLOW_UP_SCHEDULED").length,
    1,
  );
  await assert.rejects(
    scheduleFollowUp(
      {
        leadId: "lead-1",
        dueAt: secondDue,
        reason: "Duplicate",
        actor: seller,
      },
      { store },
    ),
    /active|scheduled/i,
  );

  const replacement = await rescheduleFollowUp(
    {
      leadId: "lead-1",
      followUpId: String(first.id),
      dueAt: secondDue,
      reason: "Customer asked for later",
      actor: seller,
    },
    { store },
  );
  assert.notEqual(replacement.id, first.id);
  assert.equal(first.status, "CANCELLED");
  assert.equal(store.lead.nextFollowUpAt, secondDue);
  assert.equal(
    store.events.filter((event) => event.type === "FOLLOW_UP_RESCHEDULED").length,
    1,
  );

  await completeFollowUp(
    {
      leadId: "lead-1",
      followUpId: String(replacement.id),
      actor: seller,
    },
    { store },
  );
  assert.equal(replacement.status, "COMPLETED");
  assert.equal(store.lead.nextFollowUpAt, null);
  assert.equal(
    store.events.filter((event) => event.type === "FOLLOW_UP_COMPLETED").length,
    1,
  );
});

test("company notes are append-only and use authenticated authorship", async () => {
  const store = fakeStore();
  const note = await addLeadNote(
    {
      leadId: "lead-1",
      body: "הלקוחה מעדיפה שיחה בבוקר",
      actor: seller,
    },
    { store },
  );
  assert.equal(note.authorId, "seller-1");
  assert.equal(store.events.at(-1)?.type, "NOTE_ADDED");
  assert.equal(
    (store.events.at(-1)?.metadata as Record<string, unknown>).body,
    undefined,
  );
});

test("review, non-owner and do-not-contact leads reject notes and follow-ups", async () => {
  const cases = [
    fakeStore({ review: true }),
    fakeStore({ ownerId: "seller-2" }),
    fakeStore({ doNotContactAt: new Date() }),
  ];
  for (const store of cases) {
    await assert.rejects(
      scheduleFollowUp(
        {
          leadId: "lead-1",
          dueAt: new Date(Date.now() + 60_000),
          reason: "Call later",
          actor: seller,
        },
        { store },
      ),
      /review|owned|contact/i,
    );
  }
});

test("migration duplicate follow-up cancellation keeps the retained task and audit trail", async () => {
  const store = fakeStore();
  const retainedDueAt = new Date(Date.now() + 120_000);
  store.followUps.push(
    {
      id: "follow-up-duplicate",
      leadId: "lead-1",
      status: "SCHEDULED",
      dueAt: new Date(Date.now() + 60_000),
    },
    {
      id: "follow-up-retained",
      leadId: "lead-1",
      status: "SCHEDULED",
      dueAt: retainedDueAt,
    },
  );

  await assert.rejects(
    store.transaction((transaction) =>
      cancelDuplicateFollowUpForMigrationInTransaction(transaction, {
        followUpId: "follow-up-duplicate",
        reason: "Duplicate created during legacy import",
        actor: seller,
      }),
    ),
    /admin/i,
  );

  await store.transaction((transaction) =>
    cancelDuplicateFollowUpForMigrationInTransaction(transaction, {
      followUpId: "follow-up-duplicate",
      reason: "Duplicate created during legacy import",
      actor: { userId: "admin-1", role: "ADMIN" },
    }),
  );
  assert.equal(store.followUps[0]?.status, "CANCELLED");
  assert.equal(store.followUps[1]?.status, "SCHEDULED");
  assert.equal(store.lead.nextFollowUpAt, retainedDueAt);
  assert.equal(store.events.at(-1)?.type, "MIGRATED");

  await store.transaction((transaction) =>
    cancelDuplicateFollowUpForMigrationInTransaction(transaction, {
      followUpId: "follow-up-duplicate",
      reason: "Duplicate created during legacy import",
      actor: { userId: "admin-1", role: "ADMIN" },
    }),
  );
  assert.equal(
    store.events.filter((event) => event.type === "MIGRATED").length,
    1,
  );

  const only = fakeStore();
  only.followUps.push({
    id: "follow-up-only",
    leadId: "lead-1",
    status: "SCHEDULED",
    dueAt: new Date(Date.now() + 60_000),
  });
  await assert.rejects(
    only.transaction((transaction) =>
      cancelDuplicateFollowUpForMigrationInTransaction(transaction, {
        followUpId: "follow-up-only",
        reason: "This is not actually a duplicate",
        actor: { userId: "admin-1", role: "ADMIN" },
      }),
    ),
    /duplicate|retained/i,
  );
});
