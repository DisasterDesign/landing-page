import assert from "node:assert/strict";
import test from "node:test";

import { appendLeadEvent, appendLeadEventOnce } from "./events";

function fakeEventTransaction() {
  const rows: Array<Record<string, unknown> & { id: string; dedupeKey?: string | null }> = [];
  return {
    rows,
    leadEvent: {
      async create({ data }: { data: Record<string, unknown> }) {
        const row = { ...data, id: `event-${rows.length + 1}` };
        rows.push(row);
        return row;
      },
      async createMany({ data }: { data: Record<string, unknown> }) {
        const dedupeKey =
          typeof data.dedupeKey === "string" ? data.dedupeKey : undefined;
        if (dedupeKey && rows.some((row) => row.dedupeKey === dedupeKey)) {
          return { count: 0 };
        }
        rows.push({ ...data, id: `event-${rows.length + 1}` });
        return { count: 1 };
      },
      async findUnique({
        where,
      }: {
        where: { dedupeKey: string };
      }) {
        return rows.find((row) => row.dedupeKey === where.dedupeKey) ?? null;
      },
    },
  };
}

test("event metadata rejects PII recursively", async () => {
  const transaction = fakeEventTransaction();
  await assert.rejects(
    appendLeadEvent(transaction as never, {
      leadId: "lead-1",
      type: "CONTACT_DETAILS_UPDATED",
      actor: { type: "USER", userId: "seller-1", role: "SELLER" },
      metadata: { changed: ["phone"], nested: { email: "secret@example.com" } },
    }),
    /metadata.*email|forbidden/i,
  );
  assert.equal(transaction.rows.length, 0);
});

test("deduplicated events preserve occurred time independently", async () => {
  const transaction = fakeEventTransaction();
  const occurredAt = new Date("2026-07-20T09:00:00.000Z");
  const input = {
    leadId: "lead-1",
    type: "CREATED" as const,
    actor: { type: "SYSTEM" as const },
    dedupeKey: "lead:lead-1:created",
    occurredAt,
    metadata: { sourceKey: "website" },
  };

  const first = await appendLeadEventOnce(transaction as never, input);
  const second = await appendLeadEventOnce(transaction as never, input);
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(first.event.id, second.event.id);
  assert.equal(transaction.rows[0].occurredAt, occurredAt);
});
