import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  baselineNoteHistoryIsIntact,
  captureMigrationBaseline,
  missingBaselineLeadIds,
  parseMigrationBaseline,
  shouldCancelScheduledFollowUpDuringBackfill,
  shouldInvalidateLeadForSupersession,
  shouldRequireBackfillNoteSnapshot,
  stageAfterSupersession,
} from "../../../scripts/unified-lead-lifecycle-safety";

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

test("migration scripts route safety decisions through the tested helpers", () => {
  for (const helper of [
    "stageAfterSupersession",
    "shouldCancelScheduledFollowUpDuringBackfill",
    "captureMigrationBaseline",
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
