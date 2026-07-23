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
  assertActiveNameRepairApplyConfirmation,
  assertActiveNameRepairTargetCount,
  expectedActiveNameRepairTargetCount,
  hasPublishedProspectLeadCreatedMetadata,
  safeActiveNameRepairSummary,
  validPublicPlaceCompanyName,
} from "../../../scripts/public-place-name-repair";

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
  assert.match(repairSources, /CLOSED_PERMANENTLY/);
  assert.match(repairSources, /getLiveDetails/);
  assert.match(repairSources, /post-check/i);
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
  assert.equal(hasPublishedProspectLeadCreatedMetadata(metadata, "prospect-1"), true);
  assert.equal(hasPublishedProspectLeadCreatedMetadata(metadata, "prospect-2"), false);
  assert.equal(
    hasPublishedProspectLeadCreatedMetadata({ ...metadata, cycleId: "" }, "prospect-1"),
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
