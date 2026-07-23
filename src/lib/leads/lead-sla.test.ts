import assert from "node:assert/strict";
import test from "node:test";

import {
  dispatchLeadSlaAlerts,
  getLeadSlaMinutes,
  type LeadSlaStore,
} from "./lead-sla";
import { leadActionUrlFor } from "./action-url";

function fakeSlaStore(
  leads: Array<Record<string, unknown>>,
): LeadSlaStore & {
  notifications: Array<Record<string, unknown>>;
} {
  const notifications: Array<Record<string, unknown>> = [];
  const admins = [{ id: "admin-1" }];
  const tx = {
    contactSubmission: {
      async findUnique({ where }: { where: { id: string } }) {
        return leads.find((lead) => lead.id === where.id) ?? null;
      },
      async updateMany({
        where,
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) {
        const lead = leads.find((item) => item.id === where.id);
        if (!lead) return { count: 0 };
        for (const [key, value] of Object.entries(where)) {
          if (key === "id") continue;
          if (lead[key] !== value) return { count: 0 };
        }
        Object.assign(lead, data);
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
    user: {
      async findMany() {
        return admins;
      },
    },
  };
  return {
    notifications,
    async findSlaCandidates() {
      return leads.map((lead) => ({ id: String(lead.id) }));
    },
    async transaction(callback) {
      return callback(tx as never);
    },
  };
}

function lead(
  id: string,
  intentLevel: "INBOUND" | "AD_RESPONSE",
  createdAt: Date,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    name: "נועה",
    company: "סטודיו נועה",
    intentLevel,
    sourceKey: intentLevel === "INBOUND" ? "website" : "meta_lead_ads",
    stage: "NEW",
    ownerId: null,
    eligibleSellerId: "seller-1",
    migrationReviewRequired: false,
    slaAlertedAt: null,
    slaEscalatedAt: null,
    createdAt,
    ...overrides,
  };
}

test("lead SLA defaults are intent-specific", () => {
  assert.deepEqual(getLeadSlaMinutes({}), {
    INBOUND: 5,
    AD_RESPONSE: 15,
  });
});

test("lead action URLs always target a screen enabled for the audience", () => {
  const outbound = { id: "lead-1", intentLevel: "OUTBOUND" as const };
  assert.equal(
    leadActionUrlFor({
      audience: "SELLER",
      lead: outbound,
      config: { enabled: true, coldPreparationEnabled: false },
    }),
    "/seller/cold-leads?focus=lead-1",
  );
  assert.equal(
    leadActionUrlFor({
      audience: "SELLER",
      lead: outbound,
      config: { enabled: true, coldPreparationEnabled: true },
    }),
    "/seller/leads/lead-1",
  );
  assert.equal(
    leadActionUrlFor({
      audience: "ADMIN",
      lead: outbound,
      config: { enabled: false, coldPreparationEnabled: false },
    }),
    "/admin/leads?focus=lead-1",
  );
});

test("inbound breaches before ad response and repeated workers dedupe recipients", async () => {
  const now = new Date("2026-07-23T10:06:00.000Z");
  const store = fakeSlaStore([
    lead("inbound-1", "INBOUND", new Date("2026-07-23T10:00:00.000Z")),
    lead(
      "ad-1",
      "AD_RESPONSE",
      new Date("2026-07-23T10:00:00.000Z"),
    ),
  ]);

  assert.deepEqual(await dispatchLeadSlaAlerts(now, { store }), {
    scanned: 2,
    created: 1,
  });
  assert.equal(store.notifications.length, 1);
  assert.equal(
    store.notifications[0]?.dedupeKey,
    "seller-1:lead-sla:inbound-1:v1",
  );

  assert.deepEqual(await dispatchLeadSlaAlerts(now, { store }), {
    scanned: 2,
    created: 0,
  });
  assert.equal(store.notifications.length, 1);
});

test("claimed and non-new leads never create SLA alerts", async () => {
  const now = new Date("2026-07-23T10:30:00.000Z");
  const store = fakeSlaStore([
    lead("claimed", "INBOUND", new Date("2026-07-23T10:00:00.000Z"), {
      ownerId: "seller-1",
    }),
    lead("contacting", "INBOUND", new Date("2026-07-23T10:00:00.000Z"), {
      stage: "CONTACTING",
    }),
  ]);
  assert.deepEqual(await dispatchLeadSlaAlerts(now, { store }), {
    scanned: 2,
    created: 0,
  });
  assert.equal(store.notifications.length, 0);
});

test("twice-threshold escalation is once per admin recipient", async () => {
  const now = new Date("2026-07-23T10:20:00.000Z");
  const store = fakeSlaStore([
    lead("inbound-1", "INBOUND", new Date("2026-07-23T10:00:00.000Z")),
  ]);
  await dispatchLeadSlaAlerts(now, { store });
  await dispatchLeadSlaAlerts(now, { store });
  assert.equal(
    store.notifications.filter(
      (notification) =>
        notification.dedupeKey ===
        "admin-1:lead-sla-escalation:inbound-1:v1",
    ).length,
    1,
  );
});
