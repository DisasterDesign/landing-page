import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  baselineNoteHistoryIsIntact,
  captureMigrationBaseline,
  historicalLeadFieldPlan,
  missingBaselineLeadIds,
  parseMigrationBaseline,
  shouldCancelScheduledFollowUpDuringBackfill,
  shouldInvalidateLeadForSupersession,
  shouldRequireBackfillNoteSnapshot,
  sourceExternalIdentityKey,
  stageAfterSupersession,
} from "../../../scripts/unified-lead-lifecycle-safety";
import {
  assertOperationalPublicPlaceCompanyName,
  assertGoogleMapsProspectSnapshotIdentity,
  assertActiveNameRepairApplyConfirmation,
  assertActiveNameRepairTargetCount,
  assertPostWriteActiveNameRepairTargets,
  expectedActiveNameRepairTargetCount,
  hasPublishedProspectLeadCreatedMetadata,
  isExactActiveNameRepairEvent,
  activeNameRepairManifestHash,
  classifyActiveNameRepairState,
  protectedLeadState,
  runActiveNameRepairTransaction,
  safeActiveNameRepairSummary,
  stableJson,
  validPublicPlaceCompanyName,
} from "../../../scripts/public-place-name-repair";
import {
  targetForLead as repairTargetForLead,
  validatedTargets as validatedRepairTargets,
} from "../../../scripts/repair-production-outbound-names";

const backfillSource = readFileSync(
  new URL("../../../scripts/backfill-unified-lead-lifecycle.ts", import.meta.url),
  "utf8",
);
const reconcileSource = readFileSync(
  new URL(
    "../../../scripts/reconcile-unified-lead-lifecycle.ts",
    import.meta.url,
  ),
  "utf8",
);
const constraintSource = readFileSync(
  new URL(
    "../../../scripts/apply-unified-lead-constraints.ts",
    import.meta.url,
  ),
  "utf8",
);
const activeNameRepairSource = (() => {
  try {
    return readFileSync(
      new URL(
        "../../../scripts/repair-production-outbound-names.ts",
        import.meta.url,
      ),
      "utf8",
    );
  } catch {
    return "";
  }
})();
const activeNameRepairHelperSource = readFileSync(
  new URL("../../../scripts/public-place-name-repair.ts", import.meta.url),
  "utf8",
);

test("supersession invalidates only an untouched published Prospect", () => {
  const base = {
    hasProspect: true,
    replaced: true,
    ownerId: null,
    legacyAssigneeCount: 0,
    canonicalInteractionCount: 0,
    prospectInteractionCount: 0,
  };

  assert.equal(stageAfterSupersession({ ...base, stage: "NEW" }), "LOST");
  assert.equal(stageAfterSupersession({ ...base, stage: "WON" }), "WON");
  assert.equal(
    stageAfterSupersession({ ...base, stage: "AGREEMENT_SENT" }),
    "AGREEMENT_SENT",
  );
  assert.equal(
    stageAfterSupersession({ ...base, stage: "CONTACTING" }),
    "CONTACTING",
  );
  assert.equal(
    stageAfterSupersession({ ...base, stage: "NEW", ownerId: "seller-1" }),
    "NEW",
  );
  assert.equal(
    stageAfterSupersession({
      ...base,
      stage: "NEW",
      canonicalInteractionCount: 1,
    }),
    "NEW",
  );
  assert.equal(
    stageAfterSupersession({
      ...base,
      stage: "NEW",
      legacyAssigneeCount: 1,
    }),
    "NEW",
  );
  assert.equal(
    stageAfterSupersession({
      ...base,
      stage: "NEW",
      prospectInteractionCount: 1,
    }),
    "NEW",
  );
  assert.equal(
    stageAfterSupersession({ ...base, stage: "NEW", hasProspect: false }),
    "NEW",
  );
  assert.equal(
    stageAfterSupersession({ ...base, stage: "NEW", replaced: false }),
    "NEW",
  );
  assert.equal(
    shouldInvalidateLeadForSupersession({ ...base, stage: "NEW" }),
    true,
  );
  assert.equal(
    shouldInvalidateLeadForSupersession({
      ...base,
      stage: "LOST",
      prospectInteractionCount: 1,
    }),
    false,
  );
});

test("backfill preserves an overdue scheduled follow-up on an active Lead", () => {
  assert.equal(
    shouldCancelScheduledFollowUpDuringBackfill({
      stage: "CONTACTING",
      hasScheduledFollowUp: true,
      needsLegacyFollowUp: false,
    }),
    false,
  );
  assert.equal(
    shouldCancelScheduledFollowUpDuringBackfill({
      stage: "LOST",
      hasScheduledFollowUp: true,
      needsLegacyFollowUp: false,
    }),
    true,
  );
});

test("historical lead field planning suppresses only migration-era rows", () => {
  const backfillAt = new Date("2026-07-23T16:00:00.000Z");
  const canonical = {
    historicalBackfillAt: backfillAt,
    historicalByOrigin: false,
    intentLevel: "AD_RESPONSE" as const,
    sourceKey: "meta_lead_ads",
    stage: "NEW" as const,
    phone: "0501234567",
    phoneProvenance: null,
    validatedSourceKey: "meta_lead_ads",
    slaAlertedAt: null,
    slaEscalatedAt: null,
  };

  assert.deepEqual(historicalLeadFieldPlan(canonical), {
    isHistoricalLead: false,
    slaAlertedAt: null,
    slaEscalatedAt: null,
    phoneProvenance: null,
  });
  assert.deepEqual(
    historicalLeadFieldPlan({
      ...canonical,
      historicalByOrigin: true,
      validatedSourceKey: "website",
    }),
    {
      isHistoricalLead: true,
      slaAlertedAt: backfillAt,
      slaEscalatedAt: backfillAt,
      phoneProvenance: "FIRST_PARTY_FORM",
    },
  );
  assert.deepEqual(
    historicalLeadFieldPlan({
      ...canonical,
      intentLevel: null,
      sourceKey: null,
      stage: null,
    }),
    {
      isHistoricalLead: true,
      slaAlertedAt: backfillAt,
      slaEscalatedAt: backfillAt,
      phoneProvenance: "MIGRATED",
    },
  );
});

test("historical lead field planning preserves evidence and is idempotent", () => {
  const backfillAt = new Date("2026-07-23T16:00:00.000Z");
  const alertedAt = new Date("2026-07-01T08:00:00.000Z");
  const escalatedAt = new Date("2026-07-01T09:00:00.000Z");
  const preserved = historicalLeadFieldPlan({
    historicalBackfillAt: backfillAt,
    historicalByOrigin: true,
    intentLevel: "INBOUND",
    sourceKey: "website",
    stage: "CONTACTING",
    phone: "0501234567",
    phoneProvenance: "SELLER_CONFIRMED",
    validatedSourceKey: "website",
    slaAlertedAt: alertedAt,
    slaEscalatedAt: escalatedAt,
  });
  assert.deepEqual(preserved, {
    isHistoricalLead: true,
    slaAlertedAt: alertedAt,
    slaEscalatedAt: escalatedAt,
    phoneProvenance: "SELLER_CONFIRMED",
  });

  const first = historicalLeadFieldPlan({
    historicalBackfillAt: backfillAt,
    historicalByOrigin: true,
    intentLevel: null,
    sourceKey: null,
    stage: null,
    phone: "0501234567",
    phoneProvenance: null,
    validatedSourceKey: "meta_lead_ads",
    slaAlertedAt: null,
    slaEscalatedAt: null,
  });
  const second = historicalLeadFieldPlan({
    historicalBackfillAt: backfillAt,
    historicalByOrigin: false,
    intentLevel: "AD_RESPONSE",
    sourceKey: "meta_lead_ads",
    stage: "NEW",
    phone: "0501234567",
    phoneProvenance: first.phoneProvenance,
    validatedSourceKey: "meta_lead_ads",
    slaAlertedAt: first.slaAlertedAt,
    slaEscalatedAt: first.slaEscalatedAt,
  });
  assert.deepEqual(second, {
    isHistoricalLead: false,
    slaAlertedAt: backfillAt,
    slaEscalatedAt: backfillAt,
    phoneProvenance: "MIGRATED",
  });

  for (const phone of [null, "", "   "]) {
    assert.equal(
      historicalLeadFieldPlan({
        historicalBackfillAt: backfillAt,
        historicalByOrigin: true,
        intentLevel: "INBOUND",
        sourceKey: "website",
        stage: "NEW",
        phone,
        phoneProvenance: null,
        validatedSourceKey: "website",
        slaAlertedAt: null,
        slaEscalatedAt: null,
      }).phoneProvenance,
      null,
    );
  }
});

test("baseline capture timestamps before reading IDs and hashes original notes", async () => {
  const order: string[] = [];
  const baseline = await captureMigrationBaseline(
    {
      async loadLeadIds() {
        order.push("leads");
        return ["lead-b", "lead-a"];
      },
      async loadNotes() {
        order.push("notes");
        return [
          {
            id: "note-1",
            contactId: "lead-a",
            authorId: "admin-1",
            createdAt: new Date("2026-07-20T08:00:00.000Z"),
          },
        ];
      },
    },
    {
      version: 1,
      now() {
        order.push("clock");
        return new Date("2026-07-23T09:00:00.000Z");
      },
    },
  );

  assert.deepEqual(order, ["clock", "leads", "notes"]);
  assert.deepEqual(baseline.contactSubmissionIds, ["lead-a", "lead-b"]);
  assert.deepEqual(baseline.contactNoteIds, ["note-1"]);
  assert.equal(baseline.contactSubmissionCount, 2);
  assert.equal(baseline.contactNoteCount, 1);
  assert.match(baseline.contactNoteHistoryHash, /^[a-f0-9]{64}$/);
  assert.deepEqual(parseMigrationBaseline(baseline), baseline);
  assert.equal(
    parseMigrationBaseline({
      version: 1,
      capturedAt: baseline.capturedAt,
      contactSubmissionCount: 2,
      contactNoteCount: 1,
    }),
    null,
  );
});

test("baseline reconciliation detects missing Leads and original note mutation", async () => {
  const originalNote = {
    id: "note-1",
    contactId: "lead-a",
    authorId: "admin-1",
    createdAt: new Date("2026-07-20T08:00:00.000Z"),
  };
  const baseline = await captureMigrationBaseline(
    {
      async loadLeadIds() {
        return ["lead-a", "lead-b"];
      },
      async loadNotes() {
        return [originalNote];
      },
    },
    { version: 1 },
  );

  assert.deepEqual(
    missingBaselineLeadIds(baseline, ["lead-a", "lead-new"]),
    ["lead-b"],
  );
  assert.equal(
    baselineNoteHistoryIsIntact(baseline, [
      originalNote,
      {
        id: "note-new",
        contactId: "lead-a",
        authorId: "admin-1",
        createdAt: new Date("2026-07-23T10:00:00.000Z"),
      },
    ]),
    true,
  );
  assert.equal(
    baselineNoteHistoryIsIntact(baseline, [
      { ...originalNote, authorId: "different-author" },
    ]),
    false,
  );
  assert.equal(baselineNoteHistoryIsIntact(baseline, []), false);
});

test("canonical post-rollout Leads do not require a backfill MIGRATED snapshot", async () => {
  const baseline = await captureMigrationBaseline(
    {
      async loadLeadIds() {
        return ["legacy-lead"];
      },
      async loadNotes() {
        return [];
      },
    },
    { version: 1 },
  );

  assert.equal(
    shouldRequireBackfillNoteSnapshot(baseline, "legacy-lead"),
    true,
  );
  assert.equal(
    shouldRequireBackfillNoteSnapshot(baseline, "canonical-new-lead"),
    false,
  );
});

test("backfill routes historical SLA and phone fields through the tested plan", () => {
  assert.match(
    backfillSource,
    /const historicalLeadIds = new Set\(baseline\.contactSubmissionIds\)/,
  );
  assert.match(
    backfillSource,
    /createdByBackfill \|\| historicalLeadIds\.has\(leadId\)/,
  );
  assert.match(
    backfillSource,
    /synchronizeLockedLead\([\s\S]*?historicalBackfillAt,[\s\S]*?historicalLeadIds\.has\(id\)/,
  );
  assert.match(
    backfillSource,
    /historicalLeadFieldPlan\(\{[\s\S]*?historicalByOrigin: historicalAtBaseline[\s\S]*?intentLevel: lead\.intentLevel[\s\S]*?sourceKey: lead\.sourceKey[\s\S]*?stage: lead\.stage[\s\S]*?phone: lead\.phone[\s\S]*?validatedSourceKey: safeSource\?\.sourceKey \?\? null/,
  );

  const canonicalMatches =
    backfillSource.match(
      /const canonicalMatches =([\s\S]*?)if \(canonicalMatches\)/,
    )?.[1] ?? "";
  assert.match(canonicalMatches, /lead\.slaAlertedAt/);
  assert.match(canonicalMatches, /lead\.slaEscalatedAt/);

  const canonicalUpdate =
    backfillSource.match(
      /await transaction\.contactSubmission\.update\(\{[\s\S]*?data: \{([\s\S]*?)\n\s*},\n\s*}\);/,
    )?.[1] ?? "";
  assert.match(canonicalUpdate, /\bslaAlertedAt\b/);
  assert.match(canonicalUpdate, /\bslaEscalatedAt\b/);
  assert.match(canonicalMatches, /lead\.phoneProvenance/);
  assert.match(canonicalUpdate, /\bphoneProvenance\b/);
});

test("migration scripts route safety decisions through the tested helpers", () => {
  for (const helper of [
    "stageAfterSupersession",
    "shouldCancelScheduledFollowUpDuringBackfill",
    "captureMigrationBaseline",
    "historicalLeadFieldPlan",
  ]) {
    assert.match(backfillSource, new RegExp(`\\b${helper}\\s*\\(`));
  }
  for (const helper of [
    "baselineNoteHistoryIsIntact",
    "missingBaselineLeadIds",
    "shouldRequireBackfillNoteSnapshot",
  ]) {
    assert.match(reconcileSource, new RegExp(`\\b${helper}\\s*\\(`));
  }
  assert.match(reconcileSource, /VERIFIED_FIRST_PAYMENT_IS_WON/);
});

test("migration derives WON only from immutable provider-bound first-payment proof", () => {
  assert.match(backfillSource, /\bverifiedFirstPaymentEvidence\s*\(/);
  assert.match(backfillSource, /UNVERIFIED_FIRST_PAYMENT/);
  assert.match(reconcileSource, /\bverifiedFirstPaymentEvidence\s*\(/);
  assert.match(
    reconcileSource,
    /UNVERIFIED_FIRST_PAYMENT_REQUIRES_REVIEW/,
  );
});

test("reconciliation identities are isolated by source and external ID", () => {
  const google = sourceExternalIdentityKey("google_maps", "gplaces:shared");
  const manual = sourceExternalIdentityKey("manual_outbound", "gplaces:shared");
  assert.notEqual(google, manual);
  assert.equal(
    google,
    sourceExternalIdentityKey("google_maps", "gplaces:shared"),
  );
  assert.equal(sourceExternalIdentityKey(null, "gplaces:shared"), null);
  assert.equal(sourceExternalIdentityKey("google_maps", null), null);
  assert.match(
    reconcileSource,
    /sourceExternalIdentityKey\(\s*lead\.sourceKey,\s*lead\.externalLeadId,\s*\)/,
  );
  assert.match(
    reconcileSource,
    /sourceExternalIdentityKey\(\s*"google_maps",\s*expectedExternalId,\s*\)/,
  );
});

test("post-hardening migration scripts never write nullable canonical identity", () => {
  assert.match(
    constraintSource,
    /FROM "ContactSubmission"[\s\S]*?"intentLevel" IS NULL[\s\S]*?"sourceKey" IS NULL[\s\S]*?"stage" IS NULL/,
  );
  assert.doesNotMatch(
    backfillSource,
    /intentLevel:\s*safeSource\?\.intentLevel\s*\?\?\s*null/,
  );
  assert.doesNotMatch(
    backfillSource,
    /sourceKey:\s*safeSource\?\.sourceKey\s*\?\?\s*null/,
  );
  assert.doesNotMatch(
    backfillSource,
    /OR:\s*\[[\s\S]*?\{\s*sourceKey:\s*"google_maps",\s*externalLeadId\s*\}[\s\S]*?\{\s*externalLeadId\s*\}/,
  );
  assert.match(
    constraintSource,
    /GROUP BY "sourceKey", "externalLeadId"/,
  );
  assert.match(
    backfillSource,
    /if \(!safeSource \|\| !stage\) \{[\s\S]*?throw new Error/,
  );
  assert.match(
    backfillSource,
    /data:\s*\{[\s\S]*?intentLevel:\s*safeSource\.intentLevel,[\s\S]*?sourceKey:\s*safeSource\.sourceKey,[\s\S]*?stage,/,
  );
  assert.match(
    backfillSource,
    /sourceKey_externalLeadId:\s*\{[\s\S]*?sourceKey:\s*"google_maps",[\s\S]*?externalLeadId/,
  );
  assert.match(
    backfillSource,
    /id:\s*\{\s*not:\s*lead\.id\s*\},[\s\S]*?sourceKey:\s*"google_maps",[\s\S]*?externalLeadId:\s*expectedExternalLeadId/,
  );
  const promotedCreateData =
    backfillSource.match(
      /const created = await transaction\.contactSubmission\.create\(\{\s*data:\s*\{([\s\S]*?)\n\s*\},\n\s*\}\);/,
    )?.[1] ?? "";
  assert.match(
    promotedCreateData,
    /migrationReviewReason:\s*"PROSPECT_SOURCE_CONTEXT_PENDING"/,
  );
  assert.match(promotedCreateData, /intentLevel:\s*"OUTBOUND"/);
  assert.match(promotedCreateData, /sourceKey:\s*"google_maps"/);
  assert.match(promotedCreateData, /stage:\s*"NEW"/);
});

test("active historical outbound name repair is fail-closed and limits its production write set", () => {
  const repairSources = `${activeNameRepairSource}\n${activeNameRepairHelperSource}`;
  assert.match(repairSources, /EXPECTED_(ACTIVE_NAME_REPAIR_)?TARGET_COUNT\s*=\s*11/);
  assert.match(repairSources, /CONFIRM_ACTIVE_NAME_REPAIR/);
  assert.match(repairSources, /Prisma\.TransactionIsolationLevel\.Serializable/);
  assert.match(repairSources, /FOR UPDATE/);
  assert.match(repairSources, /contactSubmission\.updateMany/);
  assert.match(repairSources, /name:\s*null/);
  assert.match(repairSources, /company:\s*null/);
  assert.match(repairSources, /PUBLIC_PLACE_COMPANY_NAME_BACKFILLED/);
  assert.match(repairSources, /prospect-created-by-backfill:v1/);
  assert.match(repairSources, /public-place-company-name-backfill:v1/);
  assert.match(repairSources, /validateSourceSnapshot\(\s*"google_maps"/);
  assert.match(repairSources, /migrationReviewRequired\s*!==\s*false/);
  assert.match(repairSources, /businessStatus\s*!==\s*"OPERATIONAL"/);
  assert.match(repairSources, /getLiveDetails/);
  assert.match(repairSources, /Post-write/i);
  assert.match(activeNameRepairSource, /runActiveNameRepairTransaction(?:<[\s\S]*?>)?\(/);
  assert.match(activeNameRepairSource, /validate:\s*async/);
});

test("active name repair output is restricted to aggregate counts and the manifest hash", () => {
  assert.deepEqual(
    safeActiveNameRepairSummary({
      expected: 11,
      total: 11,
      pending: 3,
      alreadyRepaired: 8,
      updated: 0,
      eventsCreated: 0,
      manifestHash: "a".repeat(64),
      mode: "dry-run",
      ignored: "must-not-appear",
    }),
    {
      expected: 11,
      total: 11,
      pending: 3,
      alreadyRepaired: 8,
      updated: 0,
      eventsCreated: 0,
      manifestHash: "a".repeat(64),
      mode: "dry-run",
    },
  );
});

test("historical backfill provenance accepts its immutable context and rejects a mismatched Prospect", () => {
  const metadata = {
    action: "PUBLISHED_PROSPECT_LEAD_CREATED",
    version: 1,
    prospectId: "prospect-1",
    cycleId: "cycle-1",
  };
  assert.equal(
    hasPublishedProspectLeadCreatedMetadata(metadata, {
      prospectId: "prospect-1",
      cycleId: "cycle-1",
    }),
    true,
  );
  assert.equal(
    hasPublishedProspectLeadCreatedMetadata(metadata, {
      prospectId: "prospect-2",
      cycleId: "cycle-1",
    }),
    false,
  );
  assert.equal(
    hasPublishedProspectLeadCreatedMetadata({ ...metadata, cycleId: "" }, {
      prospectId: "prospect-1",
      cycleId: "cycle-1",
    }),
    false,
  );
  assert.equal(
    hasPublishedProspectLeadCreatedMetadata(
      { ...metadata, unexpected: true },
      { prospectId: "prospect-1", cycleId: "cycle-1" },
    ),
    false,
  );
});

test("active name repair requires an explicit, exact apply confirmation", () => {
  assert.equal(assertActiveNameRepairApplyConfirmation({}), false);
  assert.throws(
    () => assertActiveNameRepairApplyConfirmation({ APPLY: "1" }),
    /CONFIRM_ACTIVE_NAME_REPAIR/,
  );
  assert.equal(
    assertActiveNameRepairApplyConfirmation({
      APPLY: "1",
      CONFIRM_ACTIVE_NAME_REPAIR: "11",
    }),
    true,
  );
});

test("active name repair refuses any target count other than the audited eleven", () => {
  assert.equal(expectedActiveNameRepairTargetCount({}), 11);
  assert.equal(expectedActiveNameRepairTargetCount({ ACTIVE_NAME_REPAIR_TARGET_COUNT: "11" }), 11);
  assert.throws(
    () => expectedActiveNameRepairTargetCount({ ACTIVE_NAME_REPAIR_TARGET_COUNT: "0" }),
    /positive integer/,
  );
  assert.throws(
    () => assertActiveNameRepairTargetCount({ ACTIVE_NAME_REPAIR_TARGET_COUNT: "12" }),
    /must be exactly 11/,
  );
});

test("public Google business names are trimmed and bounded without becoming contact-person names", () => {
  assert.equal(validPublicPlaceCompanyName("  עסק  "), "עסק");
  assert.equal(validPublicPlaceCompanyName("x"), null);
  assert.equal(validPublicPlaceCompanyName("x".repeat(200)), "x".repeat(200));
  assert.equal(validPublicPlaceCompanyName("x".repeat(201)), null);
});

test("only an operational Google place can supply a repair company name", () => {
  assert.equal(
    assertOperationalPublicPlaceCompanyName({
      displayName: "  עסק פעיל  ",
      businessStatus: "OPERATIONAL",
    }),
    "עסק פעיל",
  );
  for (const businessStatus of ["CLOSED_TEMPORARILY", "CLOSED_PERMANENTLY", null, "UNKNOWN"]) {
    assert.throws(
      () => assertOperationalPublicPlaceCompanyName({ displayName: "עסק", businessStatus }),
      /operational/i,
    );
  }
});

test("Google snapshot must retain the linked Prospect cycle and batch identity", () => {
  const prospect = { placeId: "place-1", cycleId: "cycle-1", batchId: "batch-1" };
  const snapshot = { placeId: "place-1", cycleId: "cycle-1", batchId: "batch-1" };
  assert.equal(assertGoogleMapsProspectSnapshotIdentity(prospect, snapshot), undefined);
  assert.throws(
    () => assertGoogleMapsProspectSnapshotIdentity(prospect, { ...snapshot, cycleId: "cycle-2" }),
    /cycle/i,
  );
  assert.throws(
    () => assertGoogleMapsProspectSnapshotIdentity(prospect, { ...snapshot, batchId: "batch-2" }),
    /batch/i,
  );
});

test("repair event is exact about actor, stages and metadata", () => {
  const event = {
    type: "MIGRATED",
    actorType: "SYSTEM",
    actorUserId: null,
    fromStage: "NEW",
    toStage: "NEW",
    dedupeKey: "lead:lead-1:public-place-company-name-backfill:v1",
    metadata: {
      action: "PUBLIC_PLACE_COMPANY_NAME_BACKFILLED",
      provider: "GOOGLE_PLACES",
      version: 1,
    },
  };
  assert.equal(isExactActiveNameRepairEvent(event, "lead-1"), true);
  assert.equal(
    isExactActiveNameRepairEvent({ ...event, actorUserId: "user-1" }, "lead-1"),
    false,
  );
  assert.equal(
    isExactActiveNameRepairEvent({ ...event, toStage: "QUALIFIED" }, "lead-1"),
    false,
  );
  assert.equal(
    isExactActiveNameRepairEvent(
      { ...event, metadata: { ...event.metadata, extra: true } },
      "lead-1",
    ),
    false,
  );
  assert.equal(
    classifyActiveNameRepairState({ company: "עסק", events: [event], leadId: "lead-1" }),
    "alreadyRepaired",
  );
});

test("protected repair manifest preserves raw snapshots and ISO dates while excluding only repair writes", () => {
  const at = new Date("2026-07-23T12:34:56.000Z");
  const base = {
    id: "lead-1",
    company: null,
    sourceSnapshot: { auditedDomain: "Example.COM" },
    createdAt: at,
    prospect: { id: "prospect-1", placeId: "place-1", promotedLeadId: "lead-1", cycleId: "cycle-1", batchId: "batch-1" },
    notes: [{ id: "note-1" }],
    notifications: [{ id: "notification-1" }],
    agreements: [{ id: "agreement-1" }],
    interactions: [{ id: "interaction-1" }],
    followUps: [{ id: "follow-up-1" }],
    assignees: [{ id: "seller-1" }],
    events: [
      { id: "event-1", dedupeKey: "other", occurredAt: at, recordedAt: at },
      { id: "repair", dedupeKey: "lead:lead-1:public-place-company-name-backfill:v1" },
    ],
  };
  assert.equal(stableJson({ at }), '{"at":"2026-07-23T12:34:56.000Z"}');
  assert.notEqual(
    activeNameRepairManifestHash(protectedLeadState(base)),
    activeNameRepairManifestHash(
      protectedLeadState({ ...base, sourceSnapshot: { auditedDomain: "example.com" } }),
    ),
  );
  assert.deepEqual(protectedLeadState({ ...base, company: "changed" }), protectedLeadState(base));
  assert.equal(
    activeNameRepairManifestHash(protectedLeadState(base)),
    activeNameRepairManifestHash(protectedLeadState({ ...base, events: [base.events[0]] })),
  );
  assert.notEqual(
    activeNameRepairManifestHash(protectedLeadState(base)),
    activeNameRepairManifestHash(
      protectedLeadState({
        ...base,
        events: [...base.events, { id: "event-2", dedupeKey: "ordinary" }],
      }),
    ),
  );
  assert.notEqual(
    activeNameRepairManifestHash(protectedLeadState(base)),
    activeNameRepairManifestHash(
      protectedLeadState({ ...base, notes: [{ id: "note-2" }] }),
    ),
  );
});

test("repair transaction rolls back company and event when its in-transaction validator fails", async () => {
  type Memory = { company: string | null; events: string[] };
  let state: Memory = { company: null, events: [] };
  const runTransaction = async <T>(callback: (transaction: Memory) => Promise<T>): Promise<T> => {
    const before = structuredClone(state);
    try {
      return await callback(state);
    } catch (error) {
      state = before;
      throw error;
    }
  };
  const write = async (transaction: Memory) => {
    transaction.company = "עסק";
    transaction.events.push("repair");
    return "written";
  };

  await assert.rejects(
    runActiveNameRepairTransaction({
      runTransaction,
      write,
      validate: async () => {
        throw new Error("post-write failed");
      },
    }),
    /post-write failed/,
  );
  assert.deepEqual(state, { company: null, events: [] });

  assert.equal(
    await runActiveNameRepairTransaction({
      runTransaction,
      write,
      validate: async () => undefined,
    }),
    "written",
  );
  assert.deepEqual(state, { company: "עסק", events: ["repair"] });
});

test("post-write target guard rejects a changed target count or a pending target", () => {
  assert.throws(
    () => assertPostWriteActiveNameRepairTargets({ expectedTargetCount: 11, targetCount: 12, pendingCount: 0 }),
    /count/i,
  );
  assert.throws(
    () => assertPostWriteActiveNameRepairTargets({ expectedTargetCount: 11, targetCount: 11, pendingCount: 1 }),
    /pending/i,
  );
  assert.equal(
    assertPostWriteActiveNameRepairTargets({ expectedTargetCount: 11, targetCount: 11, pendingCount: 0 }),
    undefined,
  );
});

test("actual repair target selector isolates eleven active historical rows from fifty LOST rows", () => {
  const sourceSnapshot = (id: string) => ({
    territory: "test",
    cycleId: "cycle-1",
    batchId: "batch-1",
    weekStart: "2026-07-20T00:00:00.000Z",
    placeId: `place-${id}`,
    websiteStatus: "UNKNOWN",
    auditedDomain: null,
    internalBusinessCategory: "UNKNOWN",
    internalBusinessCategoryVersion: 1,
    qualityScore: 1,
    scoringVersion: 1,
    opportunitySummary: "הזדמנות עסקית תקינה",
    callAngles: [],
  });
  const lead = (id: string, stage = "NEW") => ({
    id,
    intentLevel: "OUTBOUND",
    sourceKey: "google_maps",
    stage,
    externalLeadId: `gplaces:place-${id}`,
    sourceSnapshot: sourceSnapshot(id),
    migrationReviewRequired: false,
    name: null,
    company: null,
    prospect: {
      id: `prospect-${id}`,
      placeId: `place-${id}`,
      promotedLeadId: id,
      cycleId: "cycle-1",
      batchId: "batch-1",
      batch: { id: "batch-1", cycleId: "cycle-1" },
    },
    events: [
      {
        type: "MIGRATED",
        actorType: "SYSTEM",
        actorUserId: null,
        fromStage: null,
        toStage: null,
        dedupeKey: `lead:${id}:prospect-created-by-backfill:v1`,
        metadata: {
          action: "PUBLISHED_PROSPECT_LEAD_CREATED",
          version: 1,
          prospectId: `prospect-${id}`,
          cycleId: "cycle-1",
        },
      },
    ],
    assignees: [], notes: [], notifications: [], agreements: [], interactions: [], followUps: [],
  });
  const active = Array.from({ length: 11 }, (_, index) => lead(`active-${index}`));
  const lost = Array.from({ length: 50 }, (_, index) => lead(`lost-${index}`, "LOST"));
  assert.equal(validatedRepairTargets([...active, ...lost] as never, 11).length, 11);
  assert.equal(repairTargetForLead(lost[0] as never), null);
  assert.throws(
    () => validatedRepairTargets([{ ...active[0], events: [{ ...active[0].events[0], actorUserId: "forged" }] }] as never, 1),
    /provenance/i,
  );
});
