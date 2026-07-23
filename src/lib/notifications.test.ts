import assert from "node:assert/strict";
import test from "node:test";

import {
  createNotificationOnce,
  type NotificationPersistence,
  type NotificationTransactionRunner,
} from "./notifications";

function fakeNotificationStore(): NotificationPersistence & NotificationTransactionRunner {
  const rows = new Map<string, { id: string }>();
  let sequence = 0;

  const store: NotificationPersistence & NotificationTransactionRunner = {
    async createMany(args) {
      const key = args.data.dedupeKey;
      if (key && rows.has(key)) return { count: 0 };
      const id = `notification-${++sequence}`;
      if (key) rows.set(key, { id });
      return { count: 1 };
    },
    async findUnique(args) {
      return rows.get(args.where.dedupeKey) ?? null;
    },
    async create() {
      return { id: `notification-${++sequence}` };
    },
    async transaction(callback) {
      return callback(store);
    },
  };
  return store;
}

test("concurrent notification creation is idempotent by dedupe key", async () => {
  const store = fakeNotificationStore();
  const input = {
    recipientId: "seller-1",
    type: "CONTACT_RECEIVED" as const,
    title: "ליד חדש",
    leadId: "lead-1",
    dedupeKey: "seller-1:lead-created:lead-1",
  };

  const results = await Promise.all([
    createNotificationOnce(input, { store }),
    createNotificationOnce(input, { store }),
  ]);

  assert.deepEqual(
    results.map((result) => result.created).sort(),
    [false, true],
  );
  assert.equal(results[0].notificationId, results[1].notificationId);
});

test("notifications without a dedupe key are always created", async () => {
  const store = fakeNotificationStore();
  const input = {
    recipientId: "admin-1",
    type: "CONTACT_RECEIVED" as const,
    title: "פנייה חדשה",
  };

  const first = await createNotificationOnce(input, { store });
  const second = await createNotificationOnce(input, { store });
  assert.equal(first.created, true);
  assert.equal(second.created, true);
  assert.notEqual(first.notificationId, second.notificationId);
});
