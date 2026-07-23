import assert from "node:assert/strict";
import test from "node:test";

import { legacyLeadStateHash, type LegacyLeadStateInput } from "./legacy-compat";
import {
  deriveLegacyLeadStage,
  mapLegacyLeadSource,
  mapLegacyProspectInteraction,
} from "./legacy-mapping";

test("maps only proved legacy attribution to a canonical source", () => {
  assert.deepEqual(mapLegacyLeadSource({ acquisitionChannel: "META" }), {
    intentLevel: "AD_RESPONSE",
    sourceKey: "meta_lead_ads",
  });
  assert.deepEqual(mapLegacyLeadSource({ source: "FACEBOOK" }), {
    intentLevel: "AD_RESPONSE",
    sourceKey: "meta_lead_ads",
  });
  assert.deepEqual(mapLegacyLeadSource({ acquisitionChannel: "WEBSITE" }), {
    intentLevel: "INBOUND",
    sourceKey: "website",
  });
  assert.deepEqual(
    mapLegacyLeadSource({ acquisitionChannel: "GOOGLE_PROSPECTING" }),
    {
      intentLevel: "OUTBOUND",
      sourceKey: "google_maps",
    },
  );
  assert.equal(
    mapLegacyLeadSource({ acquisitionChannel: "MANUAL", source: "OTHER" }),
    null,
  );
});

test("a linked Prospect is authoritative google_maps evidence", () => {
  assert.deepEqual(
    mapLegacyLeadSource({
      acquisitionChannel: null,
      source: null,
      prospect: { placeId: "ChIJ-proved" },
    }),
    {
      intentLevel: "OUTBOUND",
      sourceKey: "google_maps",
    },
  );
});

test("derives stage in payment, agreement, Prospect, then legacy priority", () => {
  assert.equal(
    deriveLegacyLeadStage({ paidAt: new Date(), status: "LOST" }),
    "WON",
  );
  assert.equal(
    deriveLegacyLeadStage({
      paidAt: null,
      status: "LOST",
      agreements: [{ status: "SIGNED", paidAt: null }],
    }),
    "AGREEMENT_SIGNED",
  );
  assert.equal(
    deriveLegacyLeadStage({
      paidAt: null,
      status: "NEW",
      prospectStatus: "QUALIFIED",
    }),
    "QUALIFIED",
  );
  assert.equal(
    deriveLegacyLeadStage({
      paidAt: null,
      status: "NEW",
      prospectStatus: "FOLLOW_UP",
    }),
    "CONTACTING",
  );
  assert.equal(
    deriveLegacyLeadStage({
      paidAt: null,
      status: "NEW",
      prospectInteractionCount: 1,
    }),
    "CONTACTING",
  );
  assert.equal(
    deriveLegacyLeadStage({
      paidAt: null,
      status: "NEW",
      prospectStatus: "NOT_INTERESTED",
    }),
    "LOST",
  );
  assert.equal(
    deriveLegacyLeadStage({
      paidAt: null,
      status: "NEW",
      prospectStatus: "DO_NOT_CALL",
    }),
    "LOST",
  );
  assert.equal(
    deriveLegacyLeadStage({ paidAt: null, status: "IN_PROGRESS" }),
    "CONTACTING",
  );
  assert.equal(deriveLegacyLeadStage({ paidAt: null, status: "CLOSED" }), null);
});

test("maps Prospect interactions and preserves the historical occurrence time", () => {
  const occurredAt = new Date("2026-05-10T08:30:00.000Z");
  assert.deepEqual(
    mapLegacyProspectInteraction({
      id: "legacy-interaction-1",
      outcome: "INTERESTED",
      note: "בקשת חזרה",
      nextFollowUpAt: occurredAt,
      createdAt: occurredAt,
    }),
    {
      legacyProspectInteractionId: "legacy-interaction-1",
      channel: "PHONE",
      outcome: "INTERESTED",
      decisionMakerReached: true,
      note: "בקשת חזרה",
      nextFollowUpAt: occurredAt,
      lossReason: null,
      lossReasonDetails: null,
      usedCallAngleIds: [],
      occurredAt,
    },
  );
  assert.deepEqual(
    mapLegacyProspectInteraction({
      id: "legacy-interaction-2",
      outcome: "DO_NOT_CALL",
      note: null,
      nextFollowUpAt: null,
      createdAt: occurredAt,
    }),
    {
      legacyProspectInteractionId: "legacy-interaction-2",
      channel: "PHONE",
      outcome: "DO_NOT_CALL",
      decisionMakerReached: false,
      note: null,
      nextFollowUpAt: null,
      lossReason: "DO_NOT_CONTACT",
      lossReasonDetails: null,
      usedCallAngleIds: [],
      occurredAt,
    },
  );
});

const baseLegacyState: LegacyLeadStateInput = {
  status: "NEW",
  assigneeIds: ["seller-b", "seller-a"],
  source: "FACEBOOK",
  acquisitionChannel: "META",
  externalLeadId: "meta-1",
  externalFormId: "form-1",
  externalFormName: "Main",
  externalCampaignId: "campaign-1",
  externalAdId: "ad-1",
  nextFollowUpAt: new Date("2026-05-11T08:30:00.000Z"),
  lastContactedAt: new Date("2026-05-10T08:30:00.000Z"),
  closedAt: null,
};

test("legacy hash is ordered, PII-free, and covers every compatibility field", () => {
  const baseline = legacyLeadStateHash(baseLegacyState);
  assert.equal(
    baseline,
    legacyLeadStateHash({
      ...baseLegacyState,
      assigneeIds: ["seller-a", "seller-b"],
    }),
  );

  for (const [field, value] of [
    ["status", "LOST"],
    ["assigneeIds", ["seller-a"]],
    ["source", "WEBSITE"],
    ["acquisitionChannel", "WEBSITE"],
    ["externalLeadId", "meta-2"],
    ["externalFormId", "form-2"],
    ["externalFormName", "Alternate"],
    ["externalCampaignId", "campaign-2"],
    ["externalAdId", "ad-2"],
    ["nextFollowUpAt", null],
    ["lastContactedAt", null],
    ["closedAt", new Date("2026-05-12T08:30:00.000Z")],
  ] as const) {
    assert.notEqual(
      baseline,
      legacyLeadStateHash({ ...baseLegacyState, [field]: value }),
      field,
    );
  }

  for (const forbidden of ["name", "email", "phone", "note"]) {
    assert.throws(
      () =>
        legacyLeadStateHash({
          ...baseLegacyState,
          [forbidden]: "PII must not be accepted",
        }),
      new RegExp(`unsupported legacy state key: ${forbidden}`),
    );
  }
});

interface FakeLead {
  legacy: LegacyLeadStateInput;
  stage: ReturnType<typeof deriveLegacyLeadStage>;
  ownerId: string | null;
  legacyStateHash: string | null;
}

function catchUp(row: FakeLead): boolean {
  const fingerprint = legacyLeadStateHash(row.legacy);
  if (fingerprint === row.legacyStateHash) return false;
  row.stage = deriveLegacyLeadStage({
    status: row.legacy.status,
    paidAt: null,
  });
  row.ownerId =
    row.legacy.assigneeIds.length === 1 ? row.legacy.assigneeIds[0]! : null;
  row.legacyStateHash = fingerprint;
  return true;
}

function canonicalWrite(
  row: FakeLead,
  next: { status: LegacyLeadStateInput["status"]; assigneeIds: string[] },
): void {
  row.legacy = { ...row.legacy, ...next };
  row.stage = deriveLegacyLeadStage({ status: next.status, paidAt: null });
  row.ownerId = next.assigneeIds.length === 1 ? next.assigneeIds[0]! : null;
  row.legacyStateHash = legacyLeadStateHash(row.legacy);
}

test("catch-up refreshes old-writer mutations and is then idempotent", () => {
  const row: FakeLead = {
    legacy: { ...baseLegacyState, assigneeIds: ["seller-a"] },
    stage: "NEW",
    ownerId: "seller-a",
    legacyStateHash: legacyLeadStateHash({
      ...baseLegacyState,
      assigneeIds: ["seller-a"],
    }),
  };

  row.legacy = {
    ...row.legacy,
    status: "LOST",
    assigneeIds: ["seller-b"],
  };
  assert.equal(catchUp(row), true);
  assert.equal(row.stage, "LOST");
  assert.equal(row.ownerId, "seller-b");
  assert.equal(row.legacyStateHash, legacyLeadStateHash(row.legacy));
  assert.equal(catchUp(row), false);
});

test("catch-up never regresses a canonical write with an atomic mirror hash", () => {
  const row: FakeLead = {
    legacy: { ...baseLegacyState, assigneeIds: ["seller-a"] },
    stage: "NEW",
    ownerId: "seller-a",
    legacyStateHash: null,
  };
  canonicalWrite(row, { status: "IN_PROGRESS", assigneeIds: ["seller-b"] });
  assert.equal(catchUp(row), false);
  assert.equal(row.stage, "CONTACTING");
  assert.equal(row.ownerId, "seller-b");
});

test("serialized catch-up/canonical interleave leaves canonical truth and hash", async () => {
  const row: FakeLead = {
    legacy: { ...baseLegacyState, assigneeIds: ["seller-a"] },
    stage: "NEW",
    ownerId: "seller-a",
    legacyStateHash: null,
  };
  let releaseLock!: () => void;
  const lock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  const catchUpTransaction = (async () => {
    catchUp(row);
    await lock;
  })();
  const canonicalTransaction = catchUpTransaction.then(() => {
    canonicalWrite(row, {
      status: "IN_PROGRESS",
      assigneeIds: ["seller-b"],
    });
  });

  releaseLock();
  await Promise.all([catchUpTransaction, canonicalTransaction]);
  assert.equal(row.stage, "CONTACTING");
  assert.equal(row.ownerId, "seller-b");
  assert.equal(row.legacyStateHash, legacyLeadStateHash(row.legacy));
});
