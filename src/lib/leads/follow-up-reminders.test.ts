import assert from "node:assert/strict";
import test from "node:test";

import {
  dispatchDueFollowUps,
  type FollowUpReminderStore,
} from "./follow-up-reminders";

function fakeStore(now: Date, dueAt: Date): FollowUpReminderStore & {
  notifications: Array<Record<string, unknown>>;
  followUps: Array<Record<string, unknown>>;
} {
  const notifications: Array<Record<string, unknown>> = [];
  const lead = {
    id: "lead-1",
    name: "נועה",
    company: "סטודיו נועה",
    ownerId: "seller-1",
    intentLevel: "INBOUND",
    stage: "CONTACTING",
    migrationReviewRequired: false,
  };
  const followUps: Array<Record<string, unknown>> = [
    {
      id: "followup-1",
      leadId: "lead-1",
      ownerId: "seller-1",
      dueAt,
      reason: "לחזור עם הצעת מחיר",
      status: "SCHEDULED",
      reminderSentAt: null,
      lead,
    },
  ];
  const tx = {
    leadFollowUp: {
      async findUnique({ where }: { where: { id: string } }) {
        return followUps.find((row) => row.id === where.id) ?? null;
      },
      async updateMany({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) {
        const row = followUps.find(
          (item) =>
            item.id === where.id &&
            item.status === where.status &&
            item.ownerId === where.ownerId &&
            item.reminderSentAt === where.reminderSentAt,
        );
        if (!row) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
    },
    notification: {
      async createMany({ data }: { data: Record<string, unknown> }) {
        if (
          notifications.some(
            (notification) =>
              notification.dedupeKey === data.dedupeKey,
          )
        ) {
          return { count: 0 };
        }
        notifications.push({
          id: `notification-${notifications.length + 1}`,
          ...data,
        });
        return { count: 1 };
      },
      async findUnique({ where }: { where: { dedupeKey: string } }) {
        return (
          notifications.find(
            (notification) =>
              notification.dedupeKey === where.dedupeKey,
          ) ?? null
        );
      },
      async create({ data }: { data: Record<string, unknown> }) {
        const row = {
          id: `notification-${notifications.length + 1}`,
          ...data,
        };
        notifications.push(row);
        return row;
      },
    },
  };
  return {
    notifications,
    followUps,
    async findDueFollowUps(at) {
      return followUps
        .filter(
          (row) =>
            row.status === "SCHEDULED" &&
            row.reminderSentAt === null &&
            (row.dueAt as Date) <= at,
        )
        .map((row) => ({ id: String(row.id) }));
    },
    async transaction(callback) {
      return callback(tx as never);
    },
  };
}

test("due follow-up creates one notification and marks the reminder once", async () => {
  const now = new Date("2026-07-23T10:00:00.000Z");
  const store = fakeStore(now, new Date("2026-07-23T09:59:00.000Z"));
  const pushes: unknown[] = [];

  assert.equal(store.notifications.length, 0);
  assert.deepEqual(
    await dispatchDueFollowUps(now, {
      store,
      push: async (input) => {
        pushes.push(input);
      },
    }),
    { scanned: 1, created: 1 },
  );
  assert.deepEqual(
    await dispatchDueFollowUps(now, {
      store,
      push: async (input) => {
        pushes.push(input);
      },
    }),
    { scanned: 0, created: 0 },
  );
  assert.equal(store.notifications.length, 1);
  assert.equal(
    store.notifications[0]?.dedupeKey,
    "seller-1:lead-followup:followup-1",
  );
  assert.equal(
    (store.followUps[0]?.reminderSentAt as Date).toISOString(),
    now.toISOString(),
  );
  assert.equal(pushes.length, 1);
});

test("a future follow-up creates no notification", async () => {
  const now = new Date("2026-07-23T10:00:00.000Z");
  const store = fakeStore(now, new Date("2026-07-23T10:01:00.000Z"));
  assert.deepEqual(await dispatchDueFollowUps(now, { store }), {
    scanned: 0,
    created: 0,
  });
  assert.equal(store.notifications.length, 0);
});
