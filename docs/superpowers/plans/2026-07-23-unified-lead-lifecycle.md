# Unified Lead Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the split cold/incoming sales flows with one source-aware, exclusively owned lead lifecycle from publication or capture through first successful payment.

**Architecture:** Extend `ContactSubmission` as the canonical lead record while retaining `Prospect` as its one-to-one cold-research source through the existing `Prospect.promotedLeadId` foreign key. All writes pass through focused lead-domain services that atomically update the canonical stage, legacy compatibility fields, ownership, notes, follow-ups, agreements, commissions, and append-only events; source-specific seller views consume shared projections.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5 strict mode, Prisma 5 with Neon Postgres, NextAuth v5, Zod 4, Vercel Cron, Google Places API (live display data only), Tailwind CSS 4, `react-hot-toast`, and `tsx --test` with Node's built-in test runner.

## Global Constraints

- Work only on branch `fix/prospecting-sales-fit` in `/Users/eladnissim/Documents/Codex/2026-07-22/g/work/fuzion-cold-lead-pipeline`.
- The canonical Foundation code library and reference store were searched for `LeadEvent`, notification idempotency, lead ownership/follow-up, and commission-lifecycle primitives; no matching primitive exists as of this plan. Re-run that focused search before implementation if Foundation changed, and copy any new exact primitive instead of recreating it.
- Do not push, deploy, run production `prisma db push`, run an `APPLY=1` data script, or enable either feature flag while implementing this plan.
- At rollout time, additive schema, race-safety indexes, and an idempotent pre-cutover backfill precede deployment of code that writes the new columns; an immediate post-deploy catch-up pass closes the old-writer window. UI flags do not gate ingestion writes.
- The release-candidate `prisma/schema.prisma` remains in its additive form (nullable canonical fields and the legacy single-column external-ID unique) through preview and production hardening. The legacy `SellerCommission.agreementId` never receives a foreign key; the new nullable `agreementRefId` is the safe canonical relation. A separate schema-sync commit for Lead nullability/external-ID uniqueness is created only after every deployed database is hardened; otherwise an early `prisma db push` would apply final constraints before reconciliation.
- `UNIFIED_LEAD_LIFECYCLE_ENABLED=false` and `COLD_LEAD_PREPARATION_ENABLED=false` are server-only defaults; never expose them as `NEXT_PUBLIC_*`.
- The three intent levels are exactly `OUTBOUND`, `AD_RESPONSE`, and `INBOUND`; new channels extend `sourceKey`, not this enum.
- `intentLevel`, `sourceKey`, and `sourceSnapshot` are immutable in seller flows. Only an admin correction service may change them, with a reason and `SOURCE_CORRECTED` event containing the before/after non-PII values.
- `Prospect.promotedLeadId` remains the only physical Prospect↔Lead foreign key. Do not add `ContactSubmission.prospectId`.
- External idempotency is the pair `sourceKey + externalLeadId`; the existing physical column remains named `externalLeadId`.
- Google phone, address, category, and raw response data remain live by Place ID and are never persisted. The approved design intentionally persists only the public business display name as canonical `company`, superseding that narrow part of the older Place-ID-only decision; Task 14 records the supersession in `DECISIONS.md`. First-party or seller-confirmed contact data may be stored with provenance.
- Score `0`–`4` is eligible for cold publication; score `5` is excluded. A published cold Prospect creates its canonical Lead immediately.
- A Lead has at most one owner. Claiming must include `ownerId IS NULL AND eligibleSellerId = sellerId` in the atomic write predicate.
- `WON` is system-only and means the first payment succeeded. Agreement draft, sent, and signed are distinct stages.
- `ContactNote` is company CRM history. No product role or domain service may hard-delete Leads or notes.
- All follow-up reminders are due-time notifications with a unique dedupe key; scheduling must not send the reminder.
- New `INBOUND` and `AD_RESPONSE` Leads notify only their eligible seller. Their configurable response-SLA alerts are deduplicated and never fan out to every seller.
- `doNotContactAt` and entity suppressions cannot be cleared from product UI or ordinary domain APIs.
- Migration safety is fail-closed: additive schema defaults every legacy/old-writer row to `migrationReviewRequired=true`; only a canonical validated writer or the audited migration resolver may set it to `false`. Seller queries additionally require non-null canonical intent, source, and stage.
- Keep legacy `status`, `assignees`, `source`, `acquisitionChannel`, `closedAt`, and existing routes synchronized through compatibility adapters until rollback support is retired.
- Do not change `src/app/globals.css`, `src/app/admin/layout.tsx`, `src/app/seller/layout.tsx`, `AdminSidebar`, or `SellerSidebar`.
- Preserve the current Heebo runtime font in admin/seller layouts and existing local `font-birzia` overrides. Use only existing dark-backend classes and pink/cyan/gray tokens.
- Do not use the marketing-site `Button`, `Card`, or `Input` primitives in backend screens; their shapes, glow, white surfaces, and font rules change the existing design.
- There is no React Testing Library, Playwright, or database test harness. Use injected stores and pure functions for automated tests, then perform a browser smoke test against an isolated preview database.
- Follow TDD for domain logic: failing test, observed failure, minimal implementation, passing focused test, full relevant suite, commit.

## Planned File Map

### Canonical domain

- Create `src/lib/leads/types.ts` — shared domain inputs and actor types.
- Create `src/lib/leads/errors.ts` — typed domain errors and HTTP mapping.
- Create `src/lib/leads/config.ts` — server-only feature flags.
- Create `src/lib/leads/stage-machine.ts` — allowed transitions and legacy status projection.
- Create `src/lib/leads/legacy-compat.ts` — deterministic non-PII hash of legacy mirror state.
- Create `src/lib/leads/source.ts` — source validation and snapshots without Google live content.
- Create `src/lib/leads/authorization.ts` — row-level seller/admin rules.
- Create `src/lib/leads/events.ts` — append-only, deduplicated events.
- Create `src/lib/leads/lifecycle.ts` — create, claim, release, reassign, and transition.
- Create `src/lib/leads/interactions.ts` — structured outcomes and decision-maker tracking.
- Create `src/lib/leads/follow-ups.ts` — active task lifecycle.
- Create `src/lib/leads/follow-up-reminders.ts` — due-time reminder dispatch.
- Create `src/lib/leads/lead-sla.ts` — inbound/ad response SLA dispatch.
- Create `src/lib/leads/agreement-lifecycle.ts` — agreement and first-payment state changes.
- Create `src/lib/leads/projection.ts` — seller/admin list and detail contracts.
- Create `src/lib/leads/admin-query.ts` — server-side filtering and pagination.
- Create `src/lib/leads/analytics.ts` — cohort-based funnel metrics.
- Create `src/lib/leads/legacy-mapping.ts` — deterministic backfill mappings.
- Create `src/lib/leads/http.ts` — consistent domain-error responses.
- Create `src/lib/leads/corrections.ts` — audited source and contact corrections.
- Create `src/lib/leads/ui-state.ts` — one-primary-action mapping.

### UI

- Create `src/components/leads/LeadSourceBadge.tsx`.
- Create `src/components/leads/LeadContactActions.tsx`.
- Create `src/components/leads/LeadPrimaryAction.tsx`.
- Create `src/components/leads/LeadActivityTimeline.tsx`.
- Create `src/components/leads/LeadWorkspace.tsx`.
- Create `src/components/seller/leads/LeadPreparationPanel.tsx`.
- Create `src/components/seller/leads/LeadOutcomeSheet.tsx`.
- Create `src/components/admin/leads/LeadFilters.tsx`.
- Create `src/components/admin/leads/LeadTable.tsx`.
- Create `src/components/admin/leads/LeadOwnershipControls.tsx`.
- Create `src/components/admin/leads/LeadCorrectionControls.tsx`.
- Create `src/components/admin/leads/LeadMetrics.tsx`.
- Create legacy/unified admin and seller page components so server-only flags provide a real UI rollback.

### Operations

- Create `scripts/backfill-unified-lead-lifecycle.ts`.
- Create `scripts/reconcile-unified-lead-lifecycle.ts`.
- Create `scripts/apply-unified-lead-indexes.ts`.
- Create `scripts/apply-unified-lead-constraints.ts`.
- Create `docs/LEAD_LIFECYCLE_RUNBOOK.md`.
- Modify `prisma/schema.prisma`, `.env.example`, `package.json`, `vercel.json`, and the existing lead/prospect/agreement/payment routes listed in the tasks below.

---

### Task 1: Feature Flags, Canonical Enums, and Stage Machine

**Files:**

- Create: `src/lib/leads/config.ts`
- Create: `src/lib/leads/config.test.ts`
- Create: `src/lib/leads/stage-machine.ts`
- Create: `src/lib/leads/stage-machine.test.ts`
- Create: `src/lib/leads/legacy-compat.ts`
- Create: `src/lib/leads/legacy-compat.test.ts`
- Create: `src/lib/leads/types.ts`
- Create: `src/lib/leads/errors.ts`
- Modify: `prisma/schema.prisma:79-87,171-224,292-377,798-866`
- Modify: `.env.example`
- Modify: `src/lib/validations.ts:71-130`
- Modify: `src/app/api/contacts/route.ts`

**Interfaces:**

- Produces: `getLeadLifecycleConfig(env?): LeadLifecycleConfig`
- Produces: `canTransitionLeadStage(from, to, context): boolean`
- Produces: `assertLeadStageTransition(from, to, context): void`
- Produces: `legacyStatusForStage(stage): ContactStatus`
- Produces: `legacyLeadStateHash(input): string`
- Produces: Prisma enums/models consumed by every later task.

- [ ] **Step 1: Write failing feature-flag tests**

Create `src/lib/leads/config.test.ts`:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { getLeadLifecycleConfig } from "./config";

test("lead lifecycle flags are disabled by default", () => {
  assert.deepEqual(getLeadLifecycleConfig({}), {
    enabled: false,
    coldPreparationEnabled: false,
  });
});

test("flags require the exact string true", () => {
  assert.deepEqual(
    getLeadLifecycleConfig({
      UNIFIED_LEAD_LIFECYCLE_ENABLED: "true",
      COLD_LEAD_PREPARATION_ENABLED: "true",
    }),
    { enabled: true, coldPreparationEnabled: true },
  );
});
```

- [ ] **Step 2: Run the test and observe the missing module**

Run: `npx tsx --test src/lib/leads/config.test.ts`
Expected: FAIL with `Cannot find module './config'`.

- [ ] **Step 3: Implement the server-only flag reader**

Create `src/lib/leads/config.ts`:

```ts
export interface LeadLifecycleConfig {
  enabled: boolean;
  coldPreparationEnabled: boolean;
}

export function getLeadLifecycleConfig(
  env: Record<string, string | undefined> = process.env,
): LeadLifecycleConfig {
  return {
    enabled: env.UNIFIED_LEAD_LIFECYCLE_ENABLED === "true",
    coldPreparationEnabled: env.COLD_LEAD_PREPARATION_ENABLED === "true",
  };
}
```

Append to `.env.example`:

```dotenv
UNIFIED_LEAD_LIFECYCLE_ENABLED=false
COLD_LEAD_PREPARATION_ENABLED=false
```

- [ ] **Step 4: Write the complete failing transition table test**

Create `src/lib/leads/stage-machine.test.ts` and assert:

```ts
import assert from "node:assert/strict";
import test from "node:test";
import {
  assertLeadStageTransition,
  canTransitionLeadStage,
  legacyStatusForStage,
} from "./stage-machine";

test("manual actors cannot mark a lead won", () => {
  assert.equal(
    canTransitionLeadStage("AGREEMENT_SIGNED", "WON", {
      actorType: "USER",
      actorRole: "SELLER",
      intentLevel: "OUTBOUND",
    }),
    false,
  );
  assert.throws(
    () =>
      assertLeadStageTransition("AGREEMENT_SIGNED", "WON", {
        actorType: "USER",
        actorRole: "SELLER",
        intentLevel: "OUTBOUND",
      }),
    /system-only/,
  );
});

test("payment integration may move signed or lost leads to won", () => {
  const payment = {
    actorType: "INTEGRATION" as const,
    actorRole: null,
    intentLevel: "OUTBOUND" as const,
  };
  assert.equal(canTransitionLeadStage("AGREEMENT_SIGNED", "WON", payment), true);
  assert.equal(canTransitionLeadStage("LOST", "WON", payment), true);
});

test("only an admin may reopen a lost lead", () => {
  assert.equal(
    canTransitionLeadStage("LOST", "CONTACTING", {
      actorType: "USER",
      actorRole: "SELLER",
      intentLevel: "AD_RESPONSE",
    }),
    false,
  );
  assert.equal(
    canTransitionLeadStage("LOST", "CONTACTING", {
      actorType: "USER",
      actorRole: "ADMIN",
      intentLevel: "AD_RESPONSE",
    }),
    true,
  );
});

test("new-stage transitions respect the immutable intent level", () => {
  assert.equal(
    canTransitionLeadStage("NEW", "PREPARING", {
      actorType: "USER",
      actorRole: "SELLER",
      intentLevel: "OUTBOUND",
    }),
    true,
  );
  assert.equal(
    canTransitionLeadStage("NEW", "PREPARING", {
      actorType: "USER",
      actorRole: "SELLER",
      intentLevel: "INBOUND",
    }),
    false,
  );
});

test("spam is restricted to non-outbound leads", () => {
  assert.equal(
    canTransitionLeadStage("NEW", "SPAM", {
      actorType: "USER",
      actorRole: "ADMIN",
      intentLevel: "INBOUND",
    }),
    true,
  );
  assert.equal(
    canTransitionLeadStage("NEW", "SPAM", {
      actorType: "USER",
      actorRole: "ADMIN",
      intentLevel: "AD_RESPONSE",
    }),
    true,
  );
  assert.equal(
    canTransitionLeadStage("NEW", "SPAM", {
      actorType: "USER",
      actorRole: "ADMIN",
      intentLevel: "OUTBOUND",
    }),
    false,
  );
});

test("legacy status never reports closed before payment", () => {
  assert.equal(legacyStatusForStage("QUALIFIED"), "IN_PROGRESS");
  assert.equal(legacyStatusForStage("AGREEMENT_SIGNED"), "IN_PROGRESS");
  assert.equal(legacyStatusForStage("WON"), "CLOSED");
});
```

Add table-driven assertions for:

```text
NEW→PREPARING, NEW→CONTACTING, PREPARING→CONTACTING,
CONTACTING→QUALIFIED, QUALIFIED→AGREEMENT_DRAFT,
AGREEMENT_DRAFT→AGREEMENT_SENT, AGREEMENT_SENT→AGREEMENT_SIGNED,
any non-terminal→LOST, admin LOST→CONTACTING, and non-outbound
NEW/CONTACTING→SPAM.
```

Create `src/lib/leads/legacy-compat.test.ts` as a second failing contract. Assert the SHA-256 hash is stable across assignee ordering, changes for every mapped legacy status/source/attribution/contact/follow-up/closed input, rejects PII-bearing keys, and serializes dates/nulls deterministically.

- [ ] **Step 5: Run the stage-machine and compatibility tests and observe failure**

Run: `npx tsx --test src/lib/leads/stage-machine.test.ts src/lib/leads/legacy-compat.test.ts`
Expected: FAIL because both implementation modules are missing.

- [ ] **Step 6: Implement the state machine and shared types**

Create `src/lib/leads/stage-machine.ts` with the exact compatibility mapping, and create `src/lib/leads/legacy-compat.ts` with the deterministic non-PII SHA-256 helper. Every canonical writer imports this helper; Task 13's backfill reuses it rather than implementing another hash.

```ts
import type { ContactStatus, LeadStage } from "@prisma/client";
import type { LeadTransitionContext } from "./types";
import { LeadDomainError } from "./errors";

const forward: Record<LeadStage, readonly LeadStage[]> = {
  NEW: ["PREPARING", "CONTACTING", "LOST", "SPAM"],
  PREPARING: ["CONTACTING", "LOST"],
  CONTACTING: ["QUALIFIED", "LOST", "SPAM"],
  QUALIFIED: ["AGREEMENT_DRAFT", "LOST"],
  AGREEMENT_DRAFT: ["AGREEMENT_SENT", "QUALIFIED", "LOST"],
  AGREEMENT_SENT: ["AGREEMENT_SIGNED", "QUALIFIED", "LOST"],
  AGREEMENT_SIGNED: ["QUALIFIED", "LOST"],
  WON: [],
  LOST: [],
  SPAM: [],
};

export function canTransitionLeadStage(
  from: LeadStage,
  to: LeadStage,
  context: LeadTransitionContext,
): boolean {
  if (to === "WON") {
    return (
      context.actorType === "INTEGRATION" &&
      ["AGREEMENT_SIGNED", "LOST"].includes(from)
    );
  }
  if (from === "LOST") {
    return (
      context.actorType === "USER" &&
      context.actorRole === "ADMIN" &&
      to === "CONTACTING"
    );
  }
  if (from === "NEW" && to === "PREPARING") {
    return context.intentLevel === "OUTBOUND";
  }
  if (from === "NEW" && to === "CONTACTING") {
    return context.intentLevel !== "OUTBOUND";
  }
  if (to === "SPAM") {
    return (
      context.intentLevel !== "OUTBOUND" &&
      ["NEW", "CONTACTING"].includes(from)
    );
  }
  return forward[from].includes(to);
}

export function assertLeadStageTransition(
  from: LeadStage,
  to: LeadStage,
  context: LeadTransitionContext,
): void {
  if (!canTransitionLeadStage(from, to, context)) {
    const suffix = to === "WON" ? " (WON is system-only)" : "";
    throw new LeadDomainError("INVALID_TRANSITION", `${from} → ${to}${suffix}`);
  }
}

export function legacyStatusForStage(stage: LeadStage): ContactStatus {
  if (stage === "NEW") return "NEW";
  if (stage === "WON") return "CLOSED";
  if (stage === "LOST") return "LOST";
  if (stage === "SPAM") return "SPAM";
  return "IN_PROGRESS";
}
```

Create `src/lib/leads/errors.ts`:

```ts
export type LeadDomainErrorCode =
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "CONFLICT"
  | "INVALID_TRANSITION"
  | "VALIDATION";

export class LeadDomainError extends Error {
  constructor(
    readonly code: LeadDomainErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "LeadDomainError";
  }
}
```

Create `src/lib/leads/types.ts` with:

```ts
import type {
  ContactSubmission,
  LeadActorType,
  LeadIntentLevel,
  LeadInteractionChannel,
  LeadInteractionOutcome,
  LeadLossReason,
  LeadStage,
  Role,
} from "@prisma/client";

export type LeadRecord = ContactSubmission;

export interface LeadActor {
  type: LeadActorType;
  userId?: string;
  role?: Role;
  occurredAt?: Date;
}

export interface AuthenticatedLeadActor {
  userId: string;
  role: "ADMIN" | "SELLER";
}

export interface LeadTransitionContext {
  actorType: LeadActorType;
  actorRole: Role | null;
  intentLevel: LeadIntentLevel;
}

export interface CreateLeadFromSourceInput {
  intentLevel: LeadIntentLevel;
  sourceKey: string;
  externalLeadId?: string;
  sourceSnapshot: Record<string, unknown>;
  occurredAt?: Date;
  captureMode?: "LIVE" | "HISTORICAL_SYNC";
  notificationMode?: "ELIGIBLE_SELLER" | "NONE";
  eligibleSellerId?: string | null;
  forcedReviewReason?: "META_SOURCE_TIME_INVALID";
  name?: string;
  company?: string;
  email?: string;
  phone?: string;
  message?: string;
}

export interface RecordLeadInteractionInput {
  leadId: string;
  actor: AuthenticatedLeadActor;
  channel: LeadInteractionChannel;
  outcome: LeadInteractionOutcome;
  decisionMakerReached: boolean;
  note?: string;
  followUpAction?: "SCHEDULE" | "END_AS_LOST";
  followUpAt?: Date;
  lossReason?: LeadLossReason;
  lossReasonDetails?: string;
  usedCallAngleIds: string[];
}

export interface CorrectLeadSourceInput {
  leadId: string;
  intentLevel: LeadIntentLevel;
  sourceKey: string;
  externalLeadId?: string;
  sourceSnapshot: Record<string, unknown>;
  reason: string;
  actor: AuthenticatedLeadActor;
}

export interface UpdateLeadContactDetailsInput {
  leadId: string;
  details: {
    name?: string;
    company?: string;
    email?: string;
    phone?: string;
  };
  confirmation: "SELLER_CONFIRMED" | "ADMIN_CONFIRMED";
  actor: AuthenticatedLeadActor;
}

export interface ResolveLeadMigrationReviewInput {
  leadId: string;
  intentLevel: LeadIntentLevel;
  sourceKey: string;
  externalLeadId?: string;
  sourceSnapshot: Record<string, unknown>;
  stage?: Exclude<LeadStage, "WON">;
  ownerId: string | null;
  eligibleSellerId: string;
  reason: string;
  version: 1;
  actor: AuthenticatedLeadActor;
}
```

- [ ] **Step 7: Extend Prisma additively**

Add these exact migration-phase enums:

```prisma
enum LeadIntentLevel {
  OUTBOUND
  AD_RESPONSE
  INBOUND
}

enum LeadStage {
  NEW
  PREPARING
  CONTACTING
  QUALIFIED
  AGREEMENT_DRAFT
  AGREEMENT_SENT
  AGREEMENT_SIGNED
  WON
  LOST
  SPAM
}

enum LeadPhoneProvenance {
  FIRST_PARTY_FORM
  SELLER_CONFIRMED
  ADMIN_CONFIRMED
  MIGRATED
}

enum LeadActorType {
  USER
  SYSTEM
  INTEGRATION
}

enum LeadEventType {
  CREATED
  PUBLISHED
  CLAIMED
  RELEASED
  REASSIGNED
  PREPARATION_STARTED
  CONTACT_ATTEMPTED
  DECISION_MAKER_REACHED
  CONTACT_DETAILS_UPDATED
  NOTE_ADDED
  FOLLOW_UP_SCHEDULED
  FOLLOW_UP_RESCHEDULED
  FOLLOW_UP_COMPLETED
  QUALIFIED
  AGREEMENT_CREATED
  AGREEMENT_SENT
  AGREEMENT_SIGNED
  AGREEMENT_CANCELLED
  PAYMENT_SUCCEEDED
  PAYMENT_FAILED
  WON
  LOST
  REOPENED
  SPAM_MARKED
  DO_NOT_CALL
  COMMISSION_CREDIT_CHANGED
  SOURCE_CORRECTED
  MIGRATED
}

enum LeadInteractionChannel {
  PHONE
  WHATSAPP
  EMAIL
  OTHER
}

enum LeadInteractionOutcome {
  NO_ANSWER
  CALLBACK
  NON_DECISION_MAKER
  INTERESTED
  NOT_INTERESTED
  WRONG_NUMBER
  DO_NOT_CALL
}

enum LeadLossReason {
  NO_INTEREST
  NO_BUDGET
  BAD_TIMING
  EXISTING_PROVIDER
  DECISION_MAKER_UNREACHABLE
  NOT_FIT
  BAD_CONTACT
  DUPLICATE
  BATCH_SUPERSEDED
  DO_NOT_CONTACT
  OTHER
}

enum LeadFollowUpStatus {
  SCHEDULED
  COMPLETED
  CANCELLED
}

enum CommissionAgreementLinkStatus {
  LINKED
  LEGACY_ORPHAN
}
```

Add nullable migration-phase fields to `ContactSubmission`:

```prisma
intentLevel              LeadIntentLevel?
sourceKey                String?
sourceSnapshot           Json?
phoneProvenance          LeadPhoneProvenance?
stage                    LeadStage?
ownerId                  String?
owner                    User?                @relation("LeadOwner", fields: [ownerId], references: [id])
eligibleSellerId         String?
eligibleSeller           User?                @relation("LeadEligibleSeller", fields: [eligibleSellerId], references: [id])
firstClaimedAt           DateTime?
ownerAssignedAt          DateTime?
firstContactedAt         DateTime?
decisionMakerReachedAt   DateTime?
qualifiedAt              DateTime?
wonAt                    DateTime?
lostAt                   DateTime?
lossReason               LeadLossReason?
lossReasonDetails        String?
doNotContactAt           DateTime?
slaAlertedAt             DateTime?
slaEscalatedAt           DateTime?
migrationReviewRequired  Boolean              @default(true)
migrationReviewReason    String?
legacyStateHash          String?
events                   LeadEvent[]
interactions             LeadInteraction[]
followUps                LeadFollowUp[]

@@index([eligibleSellerId, ownerId, stage, createdAt])
@@index([ownerId, stage, nextFollowUpAt])
@@index([intentLevel, sourceKey, stage, createdAt])
@@index([stage, ownerId, slaAlertedAt, createdAt])
@@unique([sourceKey, externalLeadId], map: "Lead_source_external_unique")
```

Keep the existing single-column `externalLeadId String? @unique` throughout the initial deploy and backfill while adding the named composite uniqueness. It closes the rollout window in which a legacy Meta row still has `sourceKey=null`. No implementation task removes it from Prisma before reconciliation; Task 13 drops the physical legacy unique index only after all legacy rows are classified and the composite index is verified, and the post-hardening schema-sync commit then removes `@unique`. Make `ContactSubmission.name` and `message` nullable. Add these exact history/task models (using existing project ID/default conventions):

```prisma
model LeadEvent {
  id          String        @id @default(cuid())
  leadId      String
  lead        ContactSubmission @relation(fields: [leadId], references: [id], onDelete: Restrict)
  type        LeadEventType
  actorType   LeadActorType
  actorUserId String?
  actorUser   User?         @relation(fields: [actorUserId], references: [id], onDelete: SetNull)
  fromStage   LeadStage?
  toStage     LeadStage?
  metadata    Json?
  dedupeKey   String?       @unique
  occurredAt  DateTime
  recordedAt  DateTime      @default(now())

  @@index([leadId, occurredAt, recordedAt])
  @@index([actorUserId, occurredAt])
}

model LeadInteraction {
  id                          String                 @id @default(cuid())
  leadId                      String
  lead                        ContactSubmission      @relation(fields: [leadId], references: [id], onDelete: Restrict)
  authorId                    String
  author                      User                   @relation(fields: [authorId], references: [id], onDelete: Restrict)
  channel                     LeadInteractionChannel
  outcome                     LeadInteractionOutcome
  decisionMakerReached        Boolean
  note                        String?
  nextFollowUpAt              DateTime?
  lossReason                  LeadLossReason?
  lossReasonDetails           String?
  usedCallAngleIds            String[]
  legacyProspectInteractionId String?                @unique
  occurredAt                  DateTime
  recordedAt                  DateTime               @default(now())

  @@index([leadId, occurredAt, recordedAt])
  @@index([authorId, occurredAt])
}

model LeadFollowUp {
  id             String             @id @default(cuid())
  leadId         String
  lead           ContactSubmission  @relation(fields: [leadId], references: [id], onDelete: Restrict)
  ownerId        String
  owner          User               @relation("LeadFollowUpOwner", fields: [ownerId], references: [id], onDelete: Restrict)
  createdById    String
  createdBy      User               @relation("LeadFollowUpCreator", fields: [createdById], references: [id], onDelete: Restrict)
  dueAt          DateTime
  reason         String
  status         LeadFollowUpStatus @default(SCHEDULED)
  reminderSentAt DateTime?
  completedAt    DateTime?
  cancelledAt    DateTime?
  createdAt      DateTime           @default(now())
  updatedAt      DateTime           @updatedAt

  @@index([status, dueAt, reminderSentAt])
  @@index([ownerId, status, dueAt])
  @@index([leadId, status])
}
```

Add `LEAD_REASSIGNED`, `PROSPECTING_BATCH_SHORTFALL`, `LEAD_SLA_BREACH`, `LEAD_SLA_ESCALATION`, `PAYMENT_FAILED`, and `PAYMENT_MISMATCH` to the existing `NotificationType` enum. Add `Notification.dedupeKey String? @unique`, `Agreement.creditedSellerId String?` with relation `"AgreementCreditedSeller"`, and the matching `User` relations (`ownedLeads`, `eligibleLeads`, `leadEvents`, `leadInteractions`, `ownedLeadFollowUps`, `createdLeadFollowUps`, `creditedAgreements`, and `reviewedCommissionLinks`). Add nullable `Prospect.businessShapeVersion Int?`; Task 4 owns its dedicated commerce-audit version and backfill.

The existing required `SellerCommission.agreementId` is an unenforced legacy scalar: the current pre-domain Agreement delete route may already have left values whose Agreement no longer exists. Do not attach a foreign key to that column. Add a safe nullable canonical link instead:

```prisma
agreementRefId            String?                       @unique
agreementRef              Agreement?                    @relation("SellerCommissionAgreement", fields: [agreementRefId], references: [id], onDelete: Restrict)
agreementLinkStatus       CommissionAgreementLinkStatus?
agreementLinkReviewedAt   DateTime?
agreementLinkReviewReason String?
agreementLinkReviewedById String?
agreementLinkReviewedBy   User?                         @relation("CommissionLinkReviewer", fields: [agreementLinkReviewedById], references: [id], onDelete: Restrict)
```

Add `Agreement.commission SellerCommission? @relation("SellerCommissionAgreement")`. New commissions write both the legacy scalar `agreementId` and canonical `agreementRefId` to the real Agreement ID with status `LINKED`. Task 13 links valid historical rows or explicitly classifies a proved deleted-record legacy orphan; no migration invents an Agreement, discards a commission, or adds an unsafe FK to the legacy scalar.

Change the existing `ContactNote.contact` and `Agreement.lead` foreign keys from `onDelete: Cascade/SetNull` to `onDelete: Restrict`; deleting a Lead must not erase or detach CRM/agreement history even outside the product routes.

Keep `stage`, `intentLevel`, and `sourceKey` nullable until Task 13 reconciliation proves there are no unresolved rows.

The `migrationReviewRequired=true` default is deliberate. It makes rows created by legacy code between additive schema and canonical-code deployment admin-only. Every canonical creation path must explicitly write `false` only after source, intent, stage, snapshot, and eligible seller validate; forced review, suppression, missing assignment, and legacy ambiguity stay `true` with a named reason.

`legacyStateHash` is a non-PII SHA-256 compatibility fingerprint over the legacy fields that old code can still mutate during cutover: status, sorted assignee IDs, source/acquisition channel, external attribution IDs, and contact/follow-up/closed timestamps. Pre-cutover backfill stores it after deriving canonical state; every canonical compatibility write refreshes it in the same transaction. The post-deploy catch-up reprocesses any row whose recomputed fingerprint differs, so an old-writer update to an already-backfilled Lead cannot leave canonical owner/stage/source stale.

Because `name` and `message` become nullable, make the existing contact notification fallback null-safe in this task (`company ?? name ?? "ליד"` and `message?.slice(...) ?? "פנייה חדשה"`). Task 3 later replaces the route's writer without reintroducing non-null assumptions.

- [ ] **Step 8: Add Zod request schemas**

In `src/lib/validations.ts`, add schemas for claim, reassignment, interaction, company note, contact correction (`confirmedBySeller`), source correction with reason, stage correction with reason, follow-up schedule/reschedule/complete, and loss:

```ts
export const leadInteractionSchema = z.object({
  channel: z.enum(["PHONE", "WHATSAPP", "EMAIL", "OTHER"]),
  outcome: z.enum([
    "NO_ANSWER",
    "CALLBACK",
    "NON_DECISION_MAKER",
    "INTERESTED",
    "NOT_INTERESTED",
    "WRONG_NUMBER",
    "DO_NOT_CALL",
  ]),
  decisionMakerReached: z.boolean(),
  note: z.string().trim().max(2_000).optional(),
  followUpAction: z.enum(["SCHEDULE", "END_AS_LOST"]).optional(),
  followUpAt: z.string().datetime({ offset: true }).optional(),
  lossReason: z.enum([
    "NO_INTEREST",
    "NO_BUDGET",
    "BAD_TIMING",
    "EXISTING_PROVIDER",
    "DECISION_MAKER_UNREACHABLE",
    "NOT_FIT",
    "BAD_CONTACT",
    "DUPLICATE",
    "OTHER",
  ]).optional(),
  lossReasonDetails: z.string().trim().max(500).optional(),
  usedCallAngleIds: z.array(z.string().min(1).max(100)).max(3).default([]),
});
```

Add refinements with these exact invariants:

- `CALLBACK` requires `followUpAction=SCHEDULE` and a future `followUpAt`.
- `NO_ANSWER` and `NON_DECISION_MAKER` require an explicit `followUpAction`; `SCHEDULE` requires a future `followUpAt`, while `END_AS_LOST` requires `lossReason`.
- `INTERESTED` and `NOT_INTERESTED` require `decisionMakerReached=true`.
- `NON_DECISION_MAKER` requires `decisionMakerReached=false`.
- `NOT_INTERESTED` requires a loss reason.
- `OTHER` requires `lossReasonDetails`.
- `DO_NOT_CALL` and `WRONG_NUMBER` cannot schedule a follow-up.

- [ ] **Step 9: Validate and commit**

Run: `npx prisma format`
Expected: Prisma formats the schema.

Run: `npx prisma validate`
Expected: Prisma reports a valid schema.

Run: `npx tsx --test src/lib/leads/config.test.ts src/lib/leads/stage-machine.test.ts src/lib/leads/legacy-compat.test.ts`
Expected: PASS.

Run: `npx prisma generate`
Expected: PASS.

Run: `npx tsc --noEmit`
Expected: PASS.

Run: `npm test`
Expected: the complete existing suite passes.

Commit:

```bash
git add .env.example prisma/schema.prisma src/lib/validations.ts src/lib/leads src/app/api/contacts/route.ts
git commit -m "feat: add canonical lead domain foundation"
```

---

### Task 2: Source Contracts, Authorization, Events, and Exclusive Ownership

**Files:**

- Create: `src/lib/leads/source.ts`
- Create: `src/lib/leads/source.test.ts`
- Create: `src/lib/leads/authorization.ts`
- Create: `src/lib/leads/authorization.test.ts`
- Create: `src/lib/leads/events.ts`
- Create: `src/lib/leads/lifecycle.ts`
- Create: `src/lib/leads/lifecycle.test.ts`
- Create: `src/lib/leads/corrections.ts`
- Create: `src/lib/leads/corrections.test.ts`
- Create: `src/lib/leads/http.ts`
- Modify: `src/lib/notifications.ts`
- Create: `src/lib/notifications.test.ts`

**Interfaces:**

- Consumes: Task 1 enums, `LeadActor`, and stage machine.
- Produces: `validateSourceSnapshot(sourceKey, value)`
- Produces: `websiteAttributionFromReferrer(referrer)`
- Produces: `sellerLeadScope(sellerId)`
- Produces: `createLeadFromSource(input, deps?)`
- Produces: `createLeadInTransaction(tx, input)`
- Produces: `claimLead(input: ClaimLeadInput, deps?): Promise<LeadRecord>`
- Produces: `claimLeadInTransaction(tx, input: ClaimLeadInput): Promise<LeadRecord>`
- Produces: `markLeadRead(input)` and admin-only `markLeadsRead(input)`
- Produces: `releaseOrReassignLead(input: OwnershipMutationInput, deps?): Promise<LeadRecord>`
- Produces: `transitionLeadStage(input: TransitionLeadStageInput, deps?): Promise<LeadRecord>`
- Produces: `appendLeadEventOnce(tx, input)`
- Produces: `correctLeadSource(input: CorrectLeadSourceInput, deps?)`
- Produces: `updateLeadContactDetails(input: UpdateLeadContactDetailsInput, deps?)`
- Produces: `resolveLeadMigrationReview(input: ResolveLeadMigrationReviewInput, deps?)`
- Produces: `createNotificationOnce(input)`
- Produces: `createNotificationOnceInTransaction(tx, input)`

Define exact authenticated mutation inputs in `types.ts`:

```ts
interface ClaimLeadInput {
  leadId: string;
  sellerId: string; // always derived from the authenticated session
}

type OwnershipMutationInput =
  | {
      action: "REASSIGN";
      leadId: string;
      sellerId: string;
      reason: string;
      actor: AuthenticatedLeadActor;
    }
  | {
      action: "RELEASE";
      leadId: string;
      replacementEligibleSellerId?: string;
      cancelFollowUps?: boolean;
      reason: string;
      actor: AuthenticatedLeadActor;
    };

interface TransitionLeadStageInput {
  leadId: string;
  toStage: LeadStage;
  reason?: string;
  lossReason?: LeadLossReason;
  lossReasonDetails?: string;
  actor: AuthenticatedLeadActor | LeadActor;
}
```

HTTP adapters construct IDs/actors from session or verified integration context; request bodies never supply actor identity or role.

- [ ] **Step 1: Write failing source and access tests**

Assert:

```ts
assert.equal(intentForSource("google_maps"), "OUTBOUND");
assert.equal(intentForSource("meta_lead_ads"), "AD_RESPONSE");
assert.equal(intentForSource("website"), "INBOUND");
assert.equal(intentForSource("google_search_ads"), "INBOUND");
assert.equal(intentForSource("manual_outbound"), "OUTBOUND");
assert.equal(intentForSource("direct_contact"), "INBOUND");
assert.equal(canSellerReadLead("seller-1", {
  ownerId: null,
  eligibleSellerId: "seller-1",
  migrationReviewRequired: false,
  intentLevel: "OUTBOUND",
  sourceKey: "google_maps",
  stage: "NEW",
}), true);
assert.equal(canSellerReadLead("seller-2", {
  ownerId: "seller-1",
  eligibleSellerId: "seller-2",
  migrationReviewRequired: false,
  intentLevel: "OUTBOUND",
  sourceKey: "google_maps",
  stage: "CONTACTING",
}), false);
assert.equal(canSellerReadLead("seller-1", {
  ownerId: null,
  eligibleSellerId: "seller-1",
  migrationReviewRequired: false,
  intentLevel: null,
  sourceKey: null,
  stage: null,
}), false);
```

Validate that a `google_maps` snapshot containing `phone`, `address`, `category`, or `rawPayload` is rejected. Validate that call angles are `{ id, text, version }` objects.

Add correction tests proving:

```ts
await assert.rejects(
  correctLeadSource({ ...sourceCorrection, actor: sellerActor }, { store }),
  /admin/,
);
await correctLeadSource({ ...sourceCorrection, actor: adminActor }, { store });
assert.equal(store.events.at(-1)?.type, "SOURCE_CORRECTED");
assert.deepEqual(store.events.at(-1)?.metadata, {
  reason: "Meta webhook mapped the wrong form",
  before: { intentLevel: "AD_RESPONSE", sourceKey: "meta_lead_ads" },
  after: { intentLevel: "INBOUND", sourceKey: "website" },
});
```

Also prove that a seller-confirmed number is stored with `SELLER_CONFIRMED`, while a request claiming `GOOGLE` provenance is rejected. Add an explicit correction test proving `OUTBOUND/PREPARING → INBOUND/CONTACTING`, and that correcting any later stage never regresses it.

Add migration-resolution tests proving an admin can clear `migrationReviewRequired` only after supplying a complete valid source snapshot, safe stage resolution, and unambiguous owner/eligible seller; a seller, a duplicate source key pair, or an incomplete resolution is rejected and leaves the row review-required. A row with verified first payment preserves/derives server-side `WON` as read-only even when its source required review; a request may never manufacture `WON` without payment proof.

In `src/lib/notifications.test.ts`, race two identical `dedupeKey` creates and assert one persisted row, one `{ created: true }`, and one `{ created: false }` result that both identify the same notification.

- [ ] **Step 2: Run the focused tests**

Run: `npx tsx --test src/lib/leads/source.test.ts src/lib/leads/authorization.test.ts src/lib/leads/corrections.test.ts src/lib/notifications.test.ts`
Expected: FAIL because the new modules/exports are missing.

- [ ] **Step 3: Implement source and row-level access**

`source.ts` must export:

```ts
export const sourceIntent = {
  google_maps: "OUTBOUND",
  meta_lead_ads: "AD_RESPONSE",
  website: "INBOUND",
  google_search_ads: "INBOUND",
  manual_outbound: "OUTBOUND",
  direct_contact: "INBOUND",
} as const;

export function intentForSource(sourceKey: keyof typeof sourceIntent) {
  return sourceIntent[sourceKey];
}
```

Implement a strict Zod registry:

```text
google_maps:
  territory, cycleId, batchId, weekStart, placeId,
  websiteStatus, auditedDomain (normalized string or explicit null),
  internalBusinessCategory ("UNKNOWN"|"SERVICE"|"RETAIL"|"ECOMMERCE"),
  internalBusinessCategoryVersion integer >=1,
  qualityScore integer 0–4, scoringVersion integer >=1, opportunitySummary,
  callAngles[0..3] of { id, text, version }

meta_lead_ads:
  accountId?, campaignId?, campaignName?, adSetId?, adSetName?,
  adId?, adName?, formId?, formName?, externalLeadId,
  nonContactAnswers[], receivedAt

website:
  landingPage, service?, referrer?, utmSource?, utmMedium?,
  utmCampaign?, utmContent?, utmTerm?, receivedAt

google_search_ads:
  campaignId?, campaignName?, adGroupId?, adGroupName?,
  searchTerm?, landingPage, utmSource?, utmMedium?,
  utmCampaign?, utmContent?, utmTerm?, receivedAt

manual_outbound:
  origin ("legacy_manual"|"admin_entry"), context?, receivedAt

direct_contact:
  channel ("phone"|"email"|"whatsapp"|"in_person"), context?, receivedAt
```

Every object is `.strict()`. Optional string/ID fields are omitted when absent rather than serialized as `null`; the one semantic nullable field is `google_maps.auditedDomain`, where `null` is valid only with a no-usable-site status. `google_maps` explicitly forbids live Google phone, formatted address, Google category, `websiteUri`, and raw payload. The already-audited canonical `auditedDomain` and `websiteStatus` are allowed and remain the outage fallback. Form contact answers are stripped from snapshots and stored only in canonical Lead columns. `manual_outbound` and `direct_contact` exist so evidence-backed historical manual records can be resolved truthfully without inventing a fourth intent. Ambiguous `MANUAL/OTHER` rows remain review-required until the admin chooses the evidenced channel; if neither fits, implementation must add a named strict registry entry and intent mapping before hardening. An unregistered `sourceKey` is rejected.

`websiteAttributionFromReferrer` accepts only a valid `http:`/`https:` URL, returns a pathname landing page, origin/path referrer, and the five allow-listed UTM parameters, and drops every other query parameter. Invalid/missing input returns `{ landingPage: "/contact" }`; absent optional fields are omitted, not set to `null`.

`authorization.ts` must export:

```ts
import type { Prisma } from "@prisma/client";
import { LeadDomainError } from "./errors";

export function sellerLeadScope(sellerId: string): Prisma.ContactSubmissionWhereInput {
  return {
    OR: [
      { ownerId: sellerId },
      { ownerId: null, eligibleSellerId: sellerId },
    ],
    migrationReviewRequired: false,
    intentLevel: { not: null },
    sourceKey: { not: null },
    stage: { not: null },
  };
}

export function canSellerReadLead(
  sellerId: string,
  lead: {
    ownerId: string | null;
    eligibleSellerId: string | null;
    migrationReviewRequired: boolean;
    intentLevel: LeadIntentLevel | null;
    sourceKey: string | null;
    stage: LeadStage | null;
  },
): boolean {
  if (
    lead.migrationReviewRequired ||
    lead.intentLevel === null ||
    lead.sourceKey === null ||
    lead.stage === null
  ) {
    return false;
  }
  return (
    lead.ownerId === sellerId ||
    (lead.ownerId === null && lead.eligibleSellerId === sellerId)
  );
}

export function assertSellerOwnsLead(
  sellerId: string,
  lead: {
    ownerId: string | null;
    migrationReviewRequired: boolean;
    intentLevel: LeadIntentLevel | null;
    sourceKey: string | null;
    stage: LeadStage | null;
  },
): void {
  if (
    lead.migrationReviewRequired ||
    lead.intentLevel === null ||
    lead.sourceKey === null ||
    lead.stage === null
  ) {
    throw new LeadDomainError("FORBIDDEN", "Lead requires admin review");
  }
  if (lead.ownerId !== sellerId) {
    throw new LeadDomainError("FORBIDDEN", "Lead is not owned by this seller");
  }
}

export function assertCommercialLeadReady(lead: {
  migrationReviewRequired: boolean;
  intentLevel: LeadIntentLevel | null;
  sourceKey: string | null;
  stage: LeadStage | null;
}): asserts lead is {
  migrationReviewRequired: false;
  intentLevel: LeadIntentLevel;
  sourceKey: string;
  stage: LeadStage;
} {
  if (
    lead.migrationReviewRequired ||
    lead.intentLevel === null ||
    lead.sourceKey === null ||
    lead.stage === null
  ) {
    throw new LeadDomainError("FORBIDDEN", "Lead requires admin review");
  }
}
```

- [ ] **Step 4: Write failing lifecycle-store tests**

Use an injected store and assert:

```ts
test("claim succeeds once and is idempotent for the same owner", async () => {
  const store = fakeClaimStore({ ownerId: null, eligibleSellerId: "seller-1" });
  assert.equal((await claimLead({ leadId: "lead-1", sellerId: "seller-1" }, { store })).ownerId, "seller-1");
  assert.equal((await claimLead({ leadId: "lead-1", sellerId: "seller-1" }, { store })).ownerId, "seller-1");
  assert.equal(store.events.filter((event) => event.type === "CLAIMED").length, 1);
});

test("ineligible or second seller loses the claim race", async () => {
  const store = fakeClaimStore({ ownerId: null, eligibleSellerId: "seller-1" });
  await assert.rejects(
    claimLead({ leadId: "lead-1", sellerId: "seller-2" }, { store }),
    /not eligible|already claimed/,
  );
});
```

Also assert a review-required or do-not-contact Lead cannot be claimed, a released `QUALIFIED`/agreement-stage Lead keeps its stage when reclaimed, a terminal Lead is rejected, and `PREPARATION_STARTED` is emitted only for the first `NEW OUTBOUND` claim.

Run: `npx tsx --test src/lib/leads/lifecycle.test.ts`
Expected: FAIL because the lifecycle service is missing.

- [ ] **Step 5: Implement event and lifecycle services**

`events.ts` must provide `appendLeadEvent` and `appendLeadEventOnce`, recursively reject metadata keys `phone`, `email`, `rawPayload`, and persist `occurredAt` separately from `recordedAt`.

Export `CreateNotificationInput`, add `dedupeKey?: string`, and implement `createNotificationOnce` plus `createNotificationOnceInTransaction` in `src/lib/notifications.ts` now, before any ingestion task consumes them. Both return `{ created, notificationId }`. With a dedupe key, the transaction primitive uses `createMany({ skipDuplicates: true })`, then reads the unique row: count `1` means created, count `0` means idempotent reuse, and a missing row is an error. Without a dedupe key it performs an ordinary create. This avoids recovering from a unique violation inside an already-aborted Postgres transaction and never swallows unrelated database errors. The transaction primitive persists only and never sends push; the outer wrapper owns its transaction. Refactor the existing `createNotification` compatibility wrapper to call the outer helper and send push only for a newly created row.

Split Lead creation into an inner transaction primitive and outer wrapper:

```ts
export interface LeadPostCommitEffect {
  kind: "NOTIFICATION";
  input: CreateNotificationInput;
}

createLeadInTransaction(
  tx: Prisma.TransactionClient,
  input: CreateLeadFromSourceInput,
): Promise<{ lead: LeadRecord; effects: LeadPostCommitEffect[] }>;

createLeadFromSource(
  input: CreateLeadFromSourceInput,
  deps?: { store?: LeadCreationStore },
): Promise<LeadRecord>;
```

The inner primitive validates, creates/returns the idempotent Lead, and appends `CREATED` inside the supplied transaction. For a non-null external ID, it first reads by the composite pair. During the transitional unique-index window, it also performs a `findFirst({ externalLeadId })` fallback only when the pair is absent:

- a legacy row with `sourceKey=null` is reused, never duplicated; if persisted legacy evidence proves the same source, set its canonical source/intent snapshot, preserve its current commercial/ownership fields, set review for every unresolved stage/assignee ambiguity, and append versioned `MIGRATED`;
- a canonical row with a different non-null `sourceKey` returns a named rollout `CONFLICT` until Task 13 drops the old global index;
- no matching row uses `createMany({ skipDuplicates: true })`, then fetches by the composite pair; count `1` is a creation and count `0` must resolve through one of the two checks above.

A source with no external ID uses ordinary create. The primitive never sends notifications or opens a nested transaction. The outer wrapper opens one transaction, commits, then executes returned effects. A caller that owns a larger transaction, such as the Prospect publisher, calls the inner primitive and runs/filters the returned effects only after its outer commit.

Define the minimal `LeadCreationStore` operations used by the wrapper and provide a Prisma default; tests inject the fake store through `deps` without importing Prisma or a database.

The Prisma claim store must execute this transaction at `Serializable` isolation. Reject a nullable/terminal stage, `migrationReviewRequired=true`, or `doNotContactAt!=null` before the write. Preserve any released active stage beyond `NEW`; claiming is an ownership action, not a funnel reset:

```ts
const targetStage =
  existing.stage === "NEW"
    ? existing.intentLevel === "OUTBOUND"
      ? "PREPARING"
      : "CONTACTING"
    : existing.stage;

const result = await tx.contactSubmission.updateMany({
  where: {
    id: input.leadId,
    ownerId: null,
    eligibleSellerId: input.sellerId,
    migrationReviewRequired: false,
    doNotContactAt: null,
    stage: existing.stage,
  },
  data: {
    ownerId: input.sellerId,
    ownerAssignedAt: now,
    firstClaimedAt: existing.firstClaimedAt ?? now,
    stage: targetStage,
    status: legacyStatusForStage(targetStage),
  },
});
```

Because `updateMany` cannot update a relation, the guarded call contains scalar fields only, as shown. Verify `count === 1`, then perform a same-transaction `update` with `assignees.set`. If the guarded write returns zero, fetch the Lead: return it without another event only when `ownerId === sellerId` and it is still non-review; otherwise throw `CONFLICT`. Put this logic in `claimLeadInTransaction`; `claimLead` is the outer wrapper. The outer wrapper retries a Prisma serialization/deadlock error a bounded two times, then reloads current ownership and returns the deterministic idempotent/conflict result; post-commit effects are never executed for a rolled-back attempt. Append `CLAIMED`; append `PREPARATION_STARTED` only when this claim changed a `NEW OUTBOUND` Lead to `PREPARING`. Mark that seller's actionable new-lead/SLA notifications for this Lead read without deleting notification history.

Every ordinary commercial mutation reloads the Lead inside its transaction and calls `assertCommercialLeadReady` before writing. This includes claim, release/reassign, manual stage transition, interaction, company note, contact correction, follow-up mutation, and agreement creation. A direct API call therefore cannot bypass disabled UI capabilities on a review row. The only exceptions are `resolveLeadMigrationReview` and externally verified signature/payment truth: they may persist the external fact without clearing review or rewriting unresolved attribution/ownership. A verified first payment may derive `WON` because payment truth is authoritative; signature keeps a null/unresolved stage unchanged when no safe canonical transition exists. Add service-level tests for every mutation family, not only projection tests.

`releaseOrReassignLead` is admin-only and rejects review-required or canonically incomplete Leads through the shared guard. It receives an authenticated server-side actor, rejects any actor whose persisted role is not `ADMIN`, and never trusts a role or actor ID from an HTTP body. Add tests proving a seller is rejected even when they own the Lead. The service must move active follow-up ownership with the Lead, or reject release until the admin supplies `cancelFollowUps: true`. Reassign sets both owner and eligible seller to the new seller. Release clears owner while retaining the current eligible seller unless the admin explicitly supplies a replacement eligible seller; there is no open seller pool. A future scheduled reminder moves with the task. If the old owner's reminder was already emitted, mark that old notification read, move the task, clear `reminderSentAt`, and let the dispatcher create the new owner's recipient-scoped reminder. Mark every still-actionable new-lead/SLA/follow-up notification for the old owner read in the ownership transaction; immutable notification history remains. Notify a newly assigned owner after commit with `LEAD_REASSIGNED` and `dedupeKey=<newOwnerId>:lead-reassigned:<leadId>:<ownerAssignedAt ISO>`. Every mutation updates `ownerId`, `ownerAssignedAt`, legacy `assignees`, `legacyStateHash`, and the matching event in one transaction.

`transitionLeadStage` rejects review-required/canonically incomplete Leads, then constructs `LeadTransitionContext` from the authenticated actor role and the Lead's immutable intent. It never accepts `actorRole` or `intentLevel` from an HTTP body.

`transitionLeadStage` requires structured loss data for `LOST`, a reason for every admin reopen, and a non-OUTBOUND Lead for `SPAM`. Reopening appends `REOPENED` with the reason and before/after stage; marking spam appends `SPAM_MARKED`. Both happen with the legacy status mirror and refreshed `legacyStateHash` in the stage transaction.

`markLeadRead` and `markLeadsRead` are technical compatibility mutations for the legacy inbox badge. They change only `isRead`, enforce seller scope or admin authorization, and never accept stage/owner/source fields. All single/bulk contact-read routes delegate here; bulk delete remains forbidden.

Implement `corrections.ts`:

- `correctLeadSource` requires an authenticated admin and non-empty reason, validates the new source snapshot, checks the composite source/external key for collision, updates `intentLevel/sourceKey/sourceSnapshot` plus legacy source mirrors and `legacyStateHash`, and appends `SOURCE_CORRECTED` with before/after values in the same transaction. It is the only source writer for an already-canonical non-review Lead; the migration resolver below is the bounded exception for unresolved legacy rows. If an OUTBOUND `PREPARING` Lead is corrected to another intent, it advances to `CONTACTING`; other progressed stages never regress.
- `updateLeadContactDetails` requires the current owner or an admin and a commercially ready Lead. The route derives `confirmation` from the authenticated actor: a seller must submit the explicit `confirmedBySeller=true` acknowledgement and becomes `SELLER_CONFIRMED`; an admin becomes `ADMIN_CONFIRMED`. The request body never supplies a provenance enum. First-party form provenance is written only by canonical ingestion. The service sets `phoneProvenance`, appends `CONTACT_DETAILS_UPDATED`, and never accepts Google live data as persistence provenance.
- `resolveLeadMigrationReview` is admin-only and requires a reason plus a complete, registry-valid intent/source/source-required-external-ID/snapshot/stage/ownership resolution. It resolves duplicate or multi-assignee ownership explicitly; an owned resolution requires `eligibleSellerId=ownerId` and exactly that legacy assignee, while an unowned resolution requires no legacy assignee. The service queries verified first-payment truth: when present it derives/preserves `WON`, `wonAt`, legacy `CLOSED/closedAt`, and treats stage as read-only; without payment proof it rejects requested `WON` and requires a safe non-`WON` stage. It synchronizes every legacy mirror and `legacyStateHash`, clears `migrationReviewRequired` and `migrationReviewReason` only after all required fields validate, and appends `MIGRATED` once with dedupe key `lead:<id>:migration-review-resolved:<version>` and metadata `{ action: "MIGRATION_REVIEW_RESOLVED", reason, version, before, after }`; `before/after` contain only enum/source/stage/owner identifiers, never contact PII. It rejects ambiguous ownership and source-key collisions.
- None of the correction/resolution services writes phone/email into event metadata.

- [ ] **Step 6: Add consistent HTTP errors**

Create `leadDomainErrorResponse(error)` in `http.ts` with:

```text
NOT_FOUND→404, FORBIDDEN→403, CONFLICT→409,
INVALID_TRANSITION→422, VALIDATION→400, unknown→500.
```

- [ ] **Step 7: Run and commit**

Run: `npx tsx --test src/lib/leads/source.test.ts src/lib/leads/authorization.test.ts src/lib/leads/lifecycle.test.ts src/lib/leads/corrections.test.ts src/lib/notifications.test.ts`
Expected: PASS.

Run: `npx tsc --noEmit`
Expected: PASS.

Run: `npm test`
Expected: the complete existing suite passes.

Commit:

```bash
git add src/lib/leads src/lib/notifications.ts src/lib/notifications.test.ts
git commit -m "feat: enforce lead ownership and audit events"
```

---

### Task 3: Canonical Website and Meta Ingestion

**Files:**

- Create: `src/lib/leads/assignment.ts`
- Create: `src/lib/leads/ingestion.test.ts`
- Modify: `src/lib/leads/lifecycle.ts`
- Modify: `src/app/api/contacts/route.ts:1-50`
- Modify: `src/app/api/webhooks/facebook/route.ts:54-115`
- Modify: `src/app/api/integrations/facebook/sync/route.ts:60-107`
- Modify: `src/app/api/cron/facebook-sync/route.ts:58-103`
- Modify: `src/lib/notifications.ts`

**Interfaces:**

- Consumes: `createLeadFromSource` and source validation.
- Produces: `resolveEligibleSellerId(db): Promise<string | null>`
- Produces: idempotent `createLeadFromSource` for `website` and `meta_lead_ads`.

- [ ] **Step 1: Write failing ingestion tests**

Test that:

```ts
const website = await createLeadFromSource(websiteInput, { store });
assert.equal(website.intentLevel, "INBOUND");
assert.equal(website.sourceKey, "website");

const first = await createLeadFromSource(metaInput, { store });
const retry = await createLeadFromSource(metaInput, { store });
assert.equal(first.id, retry.id);
assert.equal(store.createdCount, 1);
assert.equal(store.notifications[0]?.recipientId, "seller-1");
```

Also assert that direct contact fields are removed from `sourceSnapshot` and stored only in canonical columns.

Assert a retry with the same `{ sourceKey, externalLeadId }` but a different `intentLevel` throws `CONFLICT` instead of silently rewriting immutable attribution.

Assert an inbound/ad response matching a permanent phone/domain suppression is still preserved as a Lead but receives `doNotContactAt`, is hidden from seller contact queues, and creates an admin review notification instead of a seller contact notification.

For Meta, assert `lead.created_time` becomes both the canonical Lead `createdAt` and the `CREATED.occurredAt`, while `LeadEvent.recordedAt` is ingestion time. Assert a `HISTORICAL_SYNC` creates no seller notification or overdue SLA flood. On an idempotent retry, assert only previously missing canonical `name/company/email/phone/message` fields are filled; no non-empty or seller/admin-confirmed value and no original `sourceSnapshot` field is overwritten. When fields are filled, append one `CONTACT_DETAILS_UPDATED` whose metadata lists field names only.

Assert an invalid or missing Meta `created_time` passes the typed `forcedReviewReason: "META_SOURCE_TIME_INVALID"`, persists that reason in the same creation transaction, remains hidden from seller scope, and sends only the admin-review effect. Assert an ordinary fully validated canonical Lead explicitly persists `migrationReviewRequired=false`; omitting that explicit write in the fake store must make the test fail closed.

Seed a legacy Meta row with the same `externalLeadId` and `sourceKey=null`, then ingest its webhook. Assert the existing ID is reused, canonical source fields are upgraded only from proven Meta evidence, unresolved legacy stage/assignee data is marked for admin review, and no second Lead is created. Seed a canonical different-source row with the same raw ID and assert a named transitional conflict rather than duplication.

- [ ] **Step 2: Run and observe failure**

Run: `npx tsx --test src/lib/leads/ingestion.test.ts`
Expected: FAIL because the source-specific creation behavior is absent.

- [ ] **Step 3: Implement default assignment and canonical creation**

`resolveEligibleSellerId` reads `sales:defaultSellerId`, falls back to `prospecting:defaultSellerId`, and returns `null` if neither user exists. Missing assignment must still create the Lead, set `migrationReviewRequired=true`, and notify admins rather than notifying every seller.

`createLeadFromSource` must:

```text
1. validate intent/source agreement;
2. sanitize sourceSnapshot;
3. resolve by the composite `{ sourceKey, externalLeadId }` when an external ID is present (`gplaces:<placeId>` remains the Google Maps compatibility format), returning the existing Lead only when its immutable intent matches;
4. create stage NEW, ownerId null, and eligibleSellerId; explicitly set `migrationReviewRequired=false` only when the full canonical input and eligible seller are valid;
5. mirror legacy source/acquisitionChannel and persist the matching legacyStateHash;
6. append CREATED with dedupeKey lead:<id>:created;
7. set `FIRST_PARTY_FORM` phone provenance for a submitted website/Meta phone;
8. check `forcedReviewReason`, missing assignment, and hashed phone/domain suppression; any match keeps `migrationReviewRequired=true`, persists its named reason, and collects only an admin-review effect;
9. otherwise collect one eligible-seller notification effect for execution after commit, except in `HISTORICAL_SYNC`;
10. use `occurredAt ?? now` for canonical `createdAt` and `CREATED.occurredAt`, while database `recordedAt` remains now;
11. for `HISTORICAL_SYNC`, initialize `slaAlertedAt` and `slaEscalatedAt` to recorded time so dispatchers do not emit stale alerts;
12. on an idempotent retry, merge only canonical contact fields that are still null/blank, never overwrite an existing or confirmed value, never mutate the immutable source snapshot, and append a PII-free `CONTACT_DETAILS_UPDATED` only when a merge occurred.
```

- [ ] **Step 4: Route every website/Meta writer through the service**

Website contact uses:

```ts
const attribution = websiteAttributionFromReferrer(
  request.headers.get("referer"),
);

await createLeadFromSource({
  intentLevel: "INBOUND",
  sourceKey: "website",
  sourceSnapshot: {
    ...attribution,
    ...(parsed.data.service ? { service: parsed.data.service } : {}),
    receivedAt: now.toISOString(),
  },
  eligibleSellerId,
  name: parsed.data.name,
  email: parsed.data.email,
  phone: parsed.data.phone,
  company: parsed.data.company,
  message: parsed.data.message,
});
```

All three Meta writers parse `lead.created_time` once and pass it as `occurredAt`; the same instant is stored as snapshot `receivedAt`. They use `externalLeadId`, `AD_RESPONSE`, `meta_lead_ads`, account/campaign/ad-set/ad/form identifiers, and non-contact answers. The webhook passes `captureMode: "LIVE"`. The manual sync route always passes `HISTORICAL_SYNC`. The scheduled cron passes `LIVE` only when `created_time` is within its current sync window and no older than 30 minutes; older recovered records pass `HISTORICAL_SYNC`. For an invalid/missing source time, use ingestion time only as the technical `receivedAt`, force `HISTORICAL_SYNC`, and pass the typed `forcedReviewReason: "META_SOURCE_TIME_INVALID"` into `createLeadFromSource`; that service persists review state and reason atomically and does not present it as a fresh response. Remove all `notifyAllSellers` calls.

For a newly created `INBOUND` Lead, send one immediate priority notification to `eligibleSellerId`. For `AD_RESPONSE`, send one new-lead notification to the same recipient. Both use `dedupeKey=<recipientId>:lead-created:<leadId>`; retries that return the existing Lead send nothing. Build the action URL server-side from feature flags: unified detail when enabled, otherwise `/seller/leads?focus=<leadId>`. Task 6 adds the separate response-SLA reminders.

- [ ] **Step 5: Verify writer behavior and commit**

Run: `npx tsx --test src/lib/leads/ingestion.test.ts`
Expected: PASS.

Run: `rg -n "notifyAllSellers|contactSubmission\\.(create|upsert)" src/app/api/contacts src/app/api/webhooks/facebook src/app/api/integrations/facebook src/app/api/cron/facebook-sync`
Expected: no matching writer/fan-out calls in those paths.

Run: `npx tsc --noEmit`
Expected: PASS.

Run: `npm test`
Expected: the complete existing suite passes.

Commit:

```bash
git add src/lib/leads src/app/api/contacts src/app/api/webhooks/facebook src/app/api/integrations/facebook src/app/api/cron/facebook-sync src/lib/notifications.ts
git commit -m "feat: unify website and meta lead ingestion"
```

---

### Task 4: Publish Cold Prospects as Canonical Leads

**Files:**

- Modify: `prisma/schema.prisma`
- Modify: `src/lib/leads/ingestion.test.ts`
- Modify: `src/lib/prospecting/commerce-audit.ts`
- Modify: `src/lib/prospecting/commerce-audit.test.ts`
- Modify: `src/lib/prospecting/worker.ts`
- Modify: `src/lib/prospecting/worker.test.ts`
- Modify: `src/lib/prospecting/publisher.ts:1-220`
- Modify: `src/lib/prospecting/publisher.test.ts`
- Modify: `src/lib/prospecting/promotion.ts`
- Modify: `src/lib/prospecting/promotion.test.ts`
- Modify: `src/lib/prospecting/replacement.ts`
- Modify: `src/lib/prospecting/replacement.test.ts`
- Modify: `src/app/api/seller/cold-leads/[id]/promote/route.ts`

**Interfaces:**

- Consumes: `createLeadInTransaction`, `appendLeadEventOnce`, and exclusive ownership.
- Produces: `publishProspectAsLead(tx, input): Promise<{ leadId: string; created: boolean }>`
- Produces: compatibility-only `getPublishedLeadForProspect`.

- [ ] **Step 1: Write failing publication-idempotency tests**

Add tests that publish the same selected Prospect twice and assert:

```ts
assert.equal(store.leads.length, 1);
assert.equal(store.prospects[0]?.promotedLeadId, store.leads[0]?.id);
assert.equal(store.leads[0]?.intentLevel, "OUTBOUND");
assert.equal(store.leads[0]?.sourceKey, "google_maps");
assert.equal(store.leads[0]?.company, "סטודיו נועה");
assert.equal(store.leads[0]?.name, null);
assert.equal(store.leads[0]?.phone, null);
assert.equal(store.events.filter((event) => event.type === "PUBLISHED").length, 1);
```

Assert score 5, missing live phone, chain, duplicate client/lead, and active Place ID/phone-hash/domain-hash suppression are still excluded before publication.

Assert `auditCommerce` exports `COMMERCE_AUDIT_VERSION=1`, every newly audited Prospect persists it to `businessShapeVersion`, and the published snapshot always contains non-null integer `internalBusinessCategoryVersion` and `scoringVersion`. Historical nullable values fall back to version `1`; generated call-angle IDs remain stable across a retry. `salesFitVersion` must never populate `internalBusinessCategoryVersion`.

Assert an eligible `NO_WEBSITE` Prospect with both `auditedDomain=null` and legacy `businessShape=null` publishes successfully with `auditedDomain: null`, `internalBusinessCategory: "UNKNOWN"`, and `internalBusinessCategoryVersion: 1`; absent optional snapshot fields are omitted and strict validation still passes.

Add a selector test proving canonical lookup identity is the `{ sourceKey, externalLeadId }` pair. Keep the real cross-source duplicate-ID database test for Task 14 after preview hardening drops the transitional single-column unique index.

- [ ] **Step 2: Run the focused prospecting tests**

Run: `npx tsx --test src/lib/prospecting/publisher.test.ts src/lib/prospecting/promotion.test.ts src/lib/prospecting/replacement.test.ts src/lib/leads/ingestion.test.ts`
Expected: FAIL because publication does not create a Lead.

- [ ] **Step 3: Create the Lead inside the publication transaction**

For every selected Prospect, carry the validated live `displayName` from the same publication fetch; a missing/blank name is a publication shortfall, not an anonymous Lead. Use `externalLeadId=gplaces:<placeId>` and this snapshot:

```ts
{
  territory: approvedProposal.displayName,
  cycleId,
  batchId: batch.id,
  weekStart: cycle.weekStart.toISOString(),
  placeId: prospect.placeId,
  websiteStatus: prospect.websiteStatus,
  auditedDomain: prospect.auditedDomain,
  internalBusinessCategory: prospect.businessShape ?? "UNKNOWN",
  internalBusinessCategoryVersion: prospect.businessShapeVersion ?? 1,
  qualityScore: prospect.qualityScore,
  scoringVersion: prospect.scoringVersion ?? 1,
  opportunitySummary: prospect.opportunitySummary,
  callAngles: prospect.callAngles.map((text, index) => ({
    id: `${prospect.scoringVersion ?? 1}:${index + 1}`,
    text,
    version: prospect.scoringVersion ?? 1,
  })),
}
```

Do not include live phone, formatted address, Google category, live `websiteUri`, or raw Google data. The normalized domain produced by Fuzion's own audit is persisted as `auditedDomain` and is the safe website fallback; `auditedDomain=null` is valid for an explicit no-usable-site status. Persist the live public business display name captured at publication as canonical `company`, while `name/email/phone/message` remain null until first-party or confirmed contact data exists. Set `eligibleSellerId=sellerId`, `ownerId=null`, `stage=NEW`, and update `Prospect.promotedLeadId` in the same transaction.

Export `COMMERCE_AUDIT_VERSION` beside `auditCommerce`; whenever the worker persists `businessShape`, persist that dedicated version in the same update. This version describes only the deterministic commerce/business-shape classifier and is independent of `SALES_FIT_VERSION` and website `scoringVersion`. Historical `null` means the current pre-versioned classifier and maps to version `1`, never to `salesFitVersion`.

Call `createLeadInTransaction(tx, { ...input, notificationMode: "NONE" })` from Task 2 and append `PUBLISHED` with dedupe key `lead:<leadId>:published:<cycleId>`. The publisher never opens a nested transaction or emits a notification before the batch transaction commits. Only after the outer commit may it send the batch-ready notification.

- [ ] **Step 4: Replace late promotion and update replacement semantics**

`promotion.ts` becomes a read-only compatibility adapter:

```ts
export async function getPublishedLeadForProspect(
  prospectId: string,
  sellerId: string,
): Promise<{ leadId: string }> {
  const prospect = await prisma.prospect.findFirst({
    where: { id: prospectId, assignedSellerId: sellerId },
    select: { promotedLeadId: true },
  });
  if (!prospect?.promotedLeadId) {
    throw new LeadDomainError("NOT_FOUND", "Published lead not found");
  }
  return { leadId: prospect.promotedLeadId };
}
```

The old promote route returns this linked ID and never writes Google phone data.

`replacement.ts` treats a Lead as untouched only when it is `NEW`, has no owner, and has no `LeadInteraction`. Superseding an untouched published Prospect calls the canonical transition service to mark its Lead `LOST` with `BATCH_SUPERSEDED`; claimed/contacted Leads remain active.

After all Meta and Prospecting lookups use `sourceKey_externalLeadId`, keep the transitional single-column `externalLeadId @unique` in Prisma through deploy/backfill. New code must not depend on its unique selector. Task 13 removes the physical legacy index only after reconciliation; Task 14 verifies the real same-ID/different-source case after that hardening.

- [ ] **Step 5: Deduplicate the batch notification**

Create the post-commit notification with:

```ts
dedupeKey: `prospecting-batch:${cycleId}:${sellerId}`
```

The body uses the actual valid count and the approved territory and links directly to `/seller/cold-leads`. An incomplete batch keeps scanning when work remains; if the cycle closes short, it sends each admin `PROSPECTING_BATCH_SHORTFALL` with `dedupeKey=<adminId>:prospecting-shortfall:<cycleId>` and does not claim that 50 Leads are ready.

- [ ] **Step 6: Verify and commit**

Run: `npx tsx --test src/lib/prospecting/publisher.test.ts src/lib/prospecting/promotion.test.ts src/lib/prospecting/replacement.test.ts src/lib/leads/ingestion.test.ts`
Expected: PASS.

Run: `npx prisma format`
Expected: PASS.

Run: `npx prisma validate`
Expected: PASS.

Run: `npx prisma generate`
Expected: PASS.

Run: `npx tsc --noEmit`
Expected: PASS.

Run: `npm test`
Expected: the complete existing suite passes.

Commit:

```bash
git add prisma/schema.prisma src/lib/leads/ingestion.test.ts src/lib/prospecting src/app/api/seller/cold-leads
git commit -m "feat: publish cold prospects as canonical leads"
```

---

### Task 5: Structured Interactions, Company Notes, and Follow-Ups

**Files:**

- Create: `src/lib/leads/interactions.ts`
- Create: `src/lib/leads/interactions.test.ts`
- Create: `src/lib/leads/follow-ups.ts`
- Create: `src/lib/leads/follow-ups.test.ts`
- Modify: `src/lib/leads/lifecycle.ts`
- Create: `src/app/api/seller/leads/[id]/interactions/route.ts`
- Create: `src/app/api/seller/leads/[id]/claim/route.ts`
- Create: `src/app/api/seller/leads/[id]/follow-ups/route.ts`
- Create: `src/app/api/leads/[id]/follow-ups/route.ts`
- Create: `src/app/api/seller/leads/[id]/contact/route.ts`
- Modify: `src/app/api/seller/leads/[id]/notes/route.ts`
- Modify: `src/app/api/seller/cold-leads/[id]/interactions/route.ts`
- Modify: `src/app/api/leads/[id]/notes/route.ts`
- Modify: `src/app/api/leads/[id]/route.ts`
- Modify: `src/components/seller/CallOutcomeSheet.tsx`
- Modify: `src/components/seller/cold-lead-types.ts`

**Interfaces:**

- Produces: `planInteraction(currentStage, input): InteractionPlan`
- Produces: `recordInteraction(input: RecordLeadInteractionInput, deps?): Promise<LeadInteractionResult>`
- Produces: `recordInteractionInTransaction(tx, input: RecordLeadInteractionInput): Promise<LeadInteractionResult>`
- Produces: `recordLegacyColdInteraction(input: LegacyColdInteractionInput, deps?): Promise<LeadInteractionResult>`
- Produces: `addLeadNote(input: AddLeadNoteInput, deps?): Promise<ContactNote>`
- Produces: `scheduleFollowUp(input: ScheduleFollowUpInput, deps?): Promise<LeadFollowUp>`
- Produces: `rescheduleFollowUp(input: RescheduleFollowUpInput, deps?): Promise<LeadFollowUp>`
- Produces: `completeFollowUp(input: CompleteFollowUpInput, deps?): Promise<LeadFollowUp>`
- Produces: transaction-aware `cancelActiveFollowUps(tx, input): Promise<number>`

```ts
interface ScheduleFollowUpInput {
  leadId: string;
  dueAt: Date;
  reason: string;
  actor: AuthenticatedLeadActor;
}

interface RescheduleFollowUpInput {
  leadId: string;
  followUpId: string;
  dueAt: Date;
  reason: string;
  actor: AuthenticatedLeadActor;
}

interface CompleteFollowUpInput {
  leadId: string;
  followUpId: string;
  actor: AuthenticatedLeadActor;
  occurredAt?: Date;
}

interface AddLeadNoteInput {
  leadId: string;
  body: string;
  actor: AuthenticatedLeadActor;
}

interface LegacyColdInteractionInput {
  prospectId: string;
  actor: AuthenticatedLeadActor;
  interaction: Omit<RecordLeadInteractionInput, "leadId" | "actor">;
}
```

Seller actors must own the Lead; admin actors may operate any commercially ready Lead. `recordInteraction` persists `authorId=input.actor.userId`; no interaction input contains a separately mutable seller/author ID. The legacy seller route constructs `actor` from its authenticated session and rejects non-seller sessions. Owner/author IDs are never accepted separately from the HTTP body.

- [ ] **Step 1: Write failing outcome-matrix tests**

Use a table with exact base-stage expectations:

```ts
const cases = [
  { outcome: "NO_ANSWER", from: "CONTACTING", to: "CONTACTING" },
  { outcome: "CALLBACK", from: "QUALIFIED", to: "QUALIFIED" },
  { outcome: "NON_DECISION_MAKER", from: "AGREEMENT_SENT", to: "AGREEMENT_SENT" },
  { outcome: "INTERESTED", from: "CONTACTING", to: "QUALIFIED" },
  { outcome: "NOT_INTERESTED", from: "CONTACTING", to: "LOST", loss: "NO_INTEREST" },
  { outcome: "WRONG_NUMBER", from: "CONTACTING", to: "LOST", loss: "BAD_CONTACT" },
  { outcome: "DO_NOT_CALL", from: "CONTACTING", to: "LOST", loss: "DO_NOT_CONTACT" },
] as const;
```

Add actor tests proving an owner seller interaction records that seller as `authorId`, an admin interaction records the admin as `authorId`, an unowned/non-owner seller is rejected, and no request-body `sellerId` or `authorId` can influence authorship. Every case rejects a review-required or canonically incomplete Lead before writing an interaction, note, or follow-up.

Assert:

- callback requires `SCHEDULE` plus a future time;
- no-answer and non-decision-maker require either a scheduled future action or explicit `END_AS_LOST` with reason;
- `OTHER` requires details;
- interested/not-interested require decision-maker reached;
- interested records decision-maker reached;
- the first recorded contact from `PREPARING` advances to `CONTACTING` before applying its outcome;
- no-answer never regresses a qualified/agreement stage;
- a `doNotContactAt` Lead rejects calls, WhatsApp, contact updates, and new follow-ups.
- scheduling appends exactly one `FOLLOW_UP_SCHEDULED`; rescheduling appends exactly one `FOLLOW_UP_RESCHEDULED`; completing appends exactly one `FOLLOW_UP_COMPLETED`; all are visible immediately in the canonical timeline.
- the legacy cold route auto-claims an eligible unowned canonical Lead and records its interaction atomically, producing one `CLAIMED` and one interaction; it conflicts for another owner and never writes `ProspectInteraction`.
- the legacy outcome UI submits the canonical structured outcomes and never maps ambiguous `CONNECTED` into a fabricated decision-maker result or invents a `+24 hours` follow-up.

- [ ] **Step 2: Run and observe failure**

Run: `npx tsx --test src/lib/leads/interactions.test.ts src/lib/leads/follow-ups.test.ts`
Expected: FAIL because the modules are missing.

- [ ] **Step 3: Implement the interaction transaction**

`recordInteractionInTransaction` performs the following inside a caller-supplied transaction; `recordInteraction` is the Serializable outer wrapper:

```text
call assertCommercialLeadReady; verify a seller actor owns the Lead or an
admin actor is authorized, and require doNotContactAt is null;
validate call-angle IDs against sourceSnapshot;
create LeadInteraction with the chosen nextFollowUpAt snapshot;
advance PREPARING to CONTACTING on the first actual contact;
update firstContactedAt/lastContactedAt/decisionMakerReachedAt/qualifiedAt/lostAt;
preserve later stages for NO_ANSWER/CALLBACK/NON_DECISION_MAKER;
create or cancel the active LeadFollowUp;
create permanent Place/phone/domain suppression for DO_NOT_CALL and bad-phone suppression for WRONG_NUMBER;
mirror stage→legacy status and nextFollowUpAt, then refresh legacyStateHash;
append CONTACT_ATTEMPTED plus DECISION_MAKER_REACHED/QUALIFIED/LOST/DO_NOT_CALL events.
```

`NO_ANSWER` or `NON_DECISION_MAKER` with `END_AS_LOST` transitions to `LOST` using the supplied reason and cancels follow-ups. No outcome may invent a `+24 hours` follow-up.

For cold Leads, the route resolves live Google details before opening the transaction and passes the phone only as trusted server-side dependency data, never from the request body. The service derives Place ID and audited domain from the linked Prospect, hashes the trusted identifiers, and stores only suppression hashes. If Google is unavailable, Place ID/domain suppression still succeeds.

- [ ] **Step 4: Implement company notes and active follow-ups**

`addLeadNote` verifies owner or admin, creates `ContactNote`, appends `NOTE_ADDED`, and returns author/time. Seller GET returns all company notes after ownership is verified. Seller and admin note DELETE return `405`; Lead DELETE and bulk-delete actions also return `405`.

Only one `SCHEDULED` follow-up may exist for a Lead. The follow-up service exposes transaction-aware inner primitives so an interaction or ownership change can reuse the caller's transaction without nesting:

```text
schedule: create the task, update nextFollowUpAt, append FOLLOW_UP_SCHEDULED;
reschedule: cancel the old task, create the replacement, update the cache,
            append FOLLOW_UP_RESCHEDULED with old/new task IDs and due times;
complete: set COMPLETED/completedAt, clear nextFollowUpAt,
          append FOLLOW_UP_COMPLETED;
terminal Lead transition or DO_NOT_CALL: cancel the active task and clear
          the cache in the same transaction; the terminal event records
          the cancelled task ID.
```

Every event is written in the same transaction as its follow-up mutation and uses a deterministic dedupe key. Reassignment moves active task ownership in the ownership transaction.

The admin `/api/leads/[id]/follow-ups` route exposes the same schedule/reschedule/complete services with admin authorization; it does not duplicate business rules.

`POST /api/seller/leads/[id]/contact` delegates to `updateLeadContactDetails`, records seller-confirmed name/phone/email with provenance, and is unavailable when `doNotContactAt` is set. Persisting a phone requires `confirmedBySeller=true`; a Google live phone is never persisted merely because it was displayed.

- [ ] **Step 5: Convert APIs to adapters**

`POST /api/seller/leads/[id]/claim` takes no seller ID from the body, derives it from the authenticated session, and calls `claimLead`. The legacy cold interaction route still receives a Prospect ID, resolves `Prospect.promotedLeadId`, and calls `recordLegacyColdInteraction`: one Serializable transaction invokes `claimLeadInTransaction` when the Lead is eligible and unowned, then `recordInteractionInTransaction`. It proceeds idempotently when already owned by the same seller and conflicts for another owner. This compatibility path does not call the new-preparation UI endpoint, so disabling `COLD_LEAD_PREPARATION_ENABLED` restores the old flow without bypassing ownership invariants. It never creates `ProspectInteraction` after cutover.

Replace the legacy `CONNECTED` option with the same explicit canonical decision-maker outcomes used by the new sheet. Preserve the current sheet classes/colors/fonts, but require the approved follow-up action/time, decision-maker, loss reason, and details fields before submit; remove the old automatic `+24 hours`. The legacy route validates `leadInteractionSchema`, not `prospectInteractionSchema`. Existing `/api/leads/[id]` and `/api/seller/leads/[id]` routes delegate notes/follow-ups/transitions to domain services. Seller routes expose claim, interaction, note, contact, and follow-up actions only; release/reassign is absent and any compatibility attempt returns `403`/`405`.

The legacy `status=CLOSED` adapter never writes a stage directly. It requires the authenticated current owner and handles only a Lead already in `CONTACTING` by recording the legacy qualification through the domain service, appending `QUALIFIED` with metadata `{ legacyRequestedClosed: true }`, and moving to `QUALIFIED`. If already `QUALIFIED` or later it is idempotent and never regresses. For `NEW`, `PREPARING`, unowned, `LOST`, `SPAM`, or `WON`, return `409`/`422` and require the canonical action; it is never mapped to `WON`.

- [ ] **Step 6: Verify and commit**

Run: `npx tsx --test src/lib/leads/interactions.test.ts src/lib/leads/follow-ups.test.ts`
Expected: PASS.

Run: `npx tsc --noEmit`
Expected: PASS.

Run: `npm test`
Expected: the complete existing suite passes.

Commit:

```bash
git add src/lib/leads src/app/api/seller/leads src/app/api/seller/cold-leads src/app/api/leads src/components/seller/CallOutcomeSheet.tsx src/components/seller/cold-lead-types.ts
git commit -m "feat: add structured lead activity and follow-ups"
```

---

### Task 6: Due-Time Notification Dispatcher and Seller Bell

**Files:**

- Create: `src/lib/leads/follow-up-reminders.ts`
- Create: `src/lib/leads/follow-up-reminders.test.ts`
- Create: `src/lib/leads/lead-sla.ts`
- Create: `src/lib/leads/lead-sla.test.ts`
- Create: `src/app/api/cron/lead-followups/route.ts`
- Modify: `src/lib/notifications.ts`
- Modify: `src/components/admin/NotificationBell.tsx`
- Modify: `src/app/seller/(dashboard)/layout.tsx:1-52`
- Modify: `src/middleware.ts:100-149`
- Modify: `src/app/api/push/test/route.ts`
- Modify: `public/sw.js`
- Modify: `vercel.json`
- Modify: `.env.example`

**Interfaces:**

- Consumes: `createNotificationOnce` and `createNotificationOnceInTransaction` from Task 2.
- Produces: `dispatchDueFollowUps(now?, deps?): Promise<{ scanned: number; created: number }>`
- Produces: `dispatchLeadSlaAlerts(now?, deps?): Promise<{ scanned: number; created: number }>`

- [ ] **Step 1: Write failing dedupe tests**

Assert:

```ts
await dispatchDueFollowUps(now, { store });
await dispatchDueFollowUps(now, { store });
assert.equal(store.notifications.length, 1);
assert.equal(store.notifications[0]?.dedupeKey, "seller-1:lead-followup:followup-1");
assert.equal(store.followUps[0]?.reminderSentAt?.toISOString(), now.toISOString());
```

Also assert a future task creates zero notifications and scheduling itself creates zero notifications.

In `lead-sla.test.ts`, assert:

```ts
assert.deepEqual(getLeadSlaMinutes({}), {
  INBOUND: 5,
  AD_RESPONSE: 15,
});
```

Assert an unclaimed `INBOUND` Lead breaches before an `AD_RESPONSE` Lead created at the same time; a claimed/non-`NEW` Lead creates no alert; repeated workers create one seller breach and one admin escalation per recipient.

- [ ] **Step 2: Run and observe failure**

Run: `npx tsx --test src/lib/leads/follow-up-reminders.test.ts src/lib/leads/lead-sla.test.ts`
Expected: FAIL because both dispatcher modules are missing.

- [ ] **Step 3: Use create-once and implement the dispatchers**

Consume Task 2's notification helpers. For each candidate, open one short transaction, re-read its current owner/stage/status, persist the deduplicated notification with `createNotificationOnceInTransaction`, and update the matching sent/SLA marker in that transaction. Send push only after commit and only when `{ created: true }`; a claim, reassignment, completion, or cancellation that wins the race prevents a stale notification.

`dispatchDueFollowUps` selects `SCHEDULED`, `dueAt <= now`, `reminderSentAt=null`, and an active owner. For each task, create:

```ts
{
  recipientId: followUp.ownerId,
  type: "LEAD_FOLLOWUP",
  title: `פולואפ: ${followUp.lead.company ?? followUp.lead.name ?? "ליד"}`,
  body: followUp.reason,
  leadId: followUp.leadId,
  url: sellerLeadActionUrl(followUp.lead),
  dedupeKey: `${followUp.ownerId}:lead-followup:${followUp.id}`,
}
```

Set `reminderSentAt` only when the notification row exists, whether created now or by a racing worker, and only while the task is still scheduled for the same owner.

Implement `lead-sla.ts` with server-only defaults configurable through:

```dotenv
INBOUND_LEAD_SLA_MINUTES=5
AD_RESPONSE_LEAD_SLA_MINUTES=15
```

`dispatchLeadSlaAlerts` considers only `NEW`, unowned, non-review Leads with an eligible seller. Seller breach candidates require `slaAlertedAt=null`; escalation candidates require `slaEscalatedAt=null`. At the intent-specific threshold it creates the eligible seller notification with `dedupeKey=<recipient>:lead-sla:<leadId>:v1`, then sets `slaAlertedAt` in the same transaction after that row exists and the Lead still matches. At twice the threshold, if the Lead is still unclaimed, it creates a deduplicated row for every admin and sets `slaEscalatedAt` only after all rows exist in that transaction. Bound each scan and order oldest-first. It never handles `OUTBOUND`.

Use the `LEAD_SLA_BREACH` and `LEAD_SLA_ESCALATION` notification types added in Task 1.

- [ ] **Step 4: Add the authenticated cron**

`/api/cron/lead-followups` uses `isCronAuthorized`, runs both the follow-up and SLA dispatchers every minute, and returns separate counts. Add to `vercel.json`:

```json
{
  "path": "/api/cron/lead-followups",
  "schedule": "* * * * *"
}
```

- [ ] **Step 5: Make notifications available to sellers**

Move the `/api/notifications` middleware exception before the admin blanket and allow only `SELLER` or `ADMIN`. Mount the existing `NotificationBell` in the seller dashboard header without changing `src/app/seller/layout.tsx`.

Make `targetUrlFor` trust `actionUrl` first. Push test URLs must use `/seller` for seller sessions and `/admin` for admin sessions.

`leadActionUrlFor({ audience, lead, config })` is the server-only URL authority. For a seller it returns unified detail only when the unified flag is on and, for `OUTBOUND`, cold preparation is also on; otherwise it returns the matching legacy seller list/focus URL. For an admin it returns unified detail only when the unified flag is on, otherwise `/admin/leads?focus=<id>`. Keep `sellerLeadActionUrl` as a typed seller wrapper if convenient. Use the audience-aware helper for ingestion, reassignment, SLA, follow-up, and payment/admin-mismatch notifications so disabling UI flags never leaves a broken or wrong-role deep link.

- [ ] **Step 6: Verify and commit**

Run: `npx tsx --test src/lib/leads/follow-up-reminders.test.ts src/lib/leads/lead-sla.test.ts`
Expected: PASS.

Run: `npx tsc --noEmit`
Expected: PASS.

Run: `npm test`
Expected: the complete existing suite passes.

Commit:

```bash
git add .env.example src/lib/notifications.ts src/lib/leads src/app/api/cron/lead-followups src/components/admin/NotificationBell.tsx 'src/app/seller/(dashboard)/layout.tsx' src/middleware.ts src/app/api/push/test/route.ts public/sw.js vercel.json
git commit -m "feat: deliver due lead follow-up notifications"
```

---

### Task 7: Agreement, Signature, Payment, and Commission Lifecycle

**Files:**

- Create: `src/lib/leads/agreement-lifecycle.ts`
- Create: `src/lib/leads/agreement-lifecycle.test.ts`
- Modify: `src/app/api/seller/agreements/route.ts:54-142`
- Modify: `src/app/api/agreements/route.ts:35-150`
- Modify: `src/app/api/agreements/[id]/route.ts`
- Create: `src/app/api/agreements/[id]/sent/route.ts`
- Create: `src/app/api/agreements/[id]/credit/route.ts`
- Modify: `src/app/api/agreements/sign/[token]/route.ts:72-191`
- Modify: `src/app/api/payments/webhook/route.ts:89-260`
- Modify: `src/app/seller/(dashboard)/agreements/new/page.tsx:43-153`

**Interfaces:**

- Produces: `createAgreementForLead(input: CreateAgreementForLeadInput, deps?): Promise<Agreement>`
- Produces: `applyAgreementEvent(input: ApplyAgreementEventInput, deps?): Promise<AgreementLeadResult>`
- Produces: `applyAgreementEventInTransaction(tx, input: ApplyAgreementEventInput): Promise<AgreementLeadResult>`
- Produces: `applyPaymentSuccess(tx, input: PaymentSuccessInput): Promise<PaymentLeadResult>`
- Produces: `applyPaymentFailure(tx, input: PaymentFailureInput): Promise<PaymentLeadResult>`
- Produces: `changeAgreementCredit(input: ChangeAgreementCreditInput, deps?): Promise<Agreement>`

Use the shared server-derived `AuthenticatedLeadActor` from Task 1:

```ts
interface CreateAgreementForLeadInput {
  leadId: string;
  actor: AuthenticatedLeadActor;
  agreement: ValidatedAgreementDraft;
}

interface ChangeAgreementCreditInput {
  agreementId: string;
  creditedSellerId: string;
  reason: string;
  actor: AuthenticatedLeadActor;
}

interface ApplyAgreementEventInput {
  agreementId: string;
  type: "SENT" | "SIGNED" | "CANCELLED";
  actor: AuthenticatedLeadActor | LeadActor;
  reason?: string;
}

interface PaymentSuccessInput {
  agreementId: string;
  providerTransactionId: string;
  paidAt: Date;
  paidAmount: number;
  actor: LeadActor; // verified INTEGRATION context
}

interface PaymentFailureInput {
  agreementId: string;
  providerAttemptId: string;
  occurredAt: Date;
  actor: LeadActor; // verified INTEGRATION context
}

interface AgreementLeadResult {
  agreementId: string;
  leadId: string | null;
  stage: LeadStage | null;
  effects: LeadPostCommitEffect[];
}

interface PaymentLeadResult extends AgreementLeadResult {
  commissionCreated: boolean;
}
```

Routes construct `actor` from the authenticated session and never accept it, a seller ID, or a role from the request body.

- [ ] **Step 1: Write failing lifecycle/payment tests**

Assert:

```ts
await assert.rejects(
  createAgreementForLead({ leadId: "lead-1", actor: seller2Actor, agreement: validAgreement }, { store }),
  /owned/,
);
await assert.rejects(
  createAgreementForLead({ leadId: "lead-1", actor: seller1Actor, agreement: validAgreement }, { storeWithActiveAgreement }),
  /active agreement/,
);
const created = await createAgreementForLead({ leadId: "lead-1", actor: seller1Actor, agreement: validAgreement }, { store });
assert.equal(created.creditedSellerId, "seller-1");
```

Race two active-agreement creates for the same Lead and make the injected store simulate the partial-index `P2002`; assert the service returns one Agreement and one conflict. The real index race is verified on the preview database in Task 14. Assert an admin cannot create a seller Agreement for an unowned Lead; the Lead must first be assigned. Assert agreement creation rejects a review-required or canonically incomplete Lead even for an admin. For payment retry, assert exactly one `PAYMENT_SUCCEEDED`, one `WON`, and one `SellerCommission`. Reassign after agreement creation and assert commission stays with `creditedSellerId`. Assert payment from `LOST` produces `WON` plus an admin mismatch signal.

Add truth-exception tests: a verified signature linked to a review row updates the Agreement and records the fact but does not clear review or invent a missing Lead stage; a verified first payment linked to a review row atomically records payment and derives server-side `WON` while preserving review/source fields. Neither path grants seller visibility until the migration resolver clears review.

Assert only an admin can change `creditedSellerId`, a reason is mandatory, the existing commission seller is updated in the same transaction when present, and one `COMMISSION_CREDIT_CHANGED` event records before/after seller IDs.

For a failed first-payment attempt, assert one recipient-independent Lead event with `dedupeKey=lead:<leadId>:payment-failed:<providerAttemptId>`, one seller notification with recipient-scoped dedupe, no fake follow-up, no stage/WON change, and projected `nextAction={ kind: "RECOVER_FIRST_PAYMENT", agreementId }`. A later successful attempt removes that next action through projection state.

Replay agreement creation/sent/signature and the same successful payment callback. Assert exactly one event for each transition using:

```text
lead:<leadId>:agreement-created:<agreementId>
lead:<leadId>:agreement-sent:<agreementId>
lead:<leadId>:agreement-signed:<agreementId>
lead:<leadId>:agreement-cancelled:<agreementId>
lead:<leadId>:payment-succeeded:<providerTransactionId>
lead:<leadId>:won
```

The replay returns the already-current Agreement/Lead result and never duplicates stage events, notifications, or commission.

- [ ] **Step 2: Run and observe failure**

Run: `npx tsx --test src/lib/leads/agreement-lifecycle.test.ts`
Expected: FAIL because the module is missing.

- [ ] **Step 3: Implement agreement creation and sending**

`createAgreementForLead` first calls `assertCommercialLeadReady`, then requires Lead stage `QUALIFIED`, a non-null owner, and either that owner or an admin actor. It authorizes only `input.actor`, never an input seller/credit ID. It checks no `DRAFT|SENT|SIGNED` agreement in the transaction and relies on the partial unique index as the race-safe final guard. It creates the Agreement with `creditedSellerId=lead.ownerId`, appends `AGREEMENT_CREATED` with `lead:<leadId>:agreement-created:<agreementId>`, and moves the Lead to `AGREEMENT_DRAFT`.

Before creation, validate all fields required by the existing agreement template. Cold Leads may have `name/email/phone=null`; the seller form must collect missing contract data and persist seller-confirmed contact values through `updateLeadContactDetails` before the Agreement transaction.

`POST /api/agreements/[id]/sent` verifies the actor may access the Agreement, updates `DRAFT→SENT`, moves the Lead to `AGREEMENT_SENT`, and appends `AGREEMENT_SENT` in one transaction. Repeating the same sent action is idempotent via `lead:<leadId>:agreement-sent:<agreementId>`.

Opening the WhatsApp composer or copying a link does not prove delivery and must not call this endpoint. Provide an explicit existing-style “סמן כנשלח” action after the seller actually sends the link. A future delivery-confirming integration may call the same domain event.

`applyAgreementEvent(input, deps?)` is the outer wrapper: it opens and commits one transaction by calling `applyAgreementEventInTransaction(tx, input)`, then executes returned notification effects. `applyAgreementEventInTransaction` is the only primitive called by signature/payment routes that already own a transaction; it never opens a nested transaction or sends a notification.

- [ ] **Step 4: Connect signature and cancellation**

Signing updates Agreement and Client as today, then in the same database transaction calls:

```ts
await applyAgreementEventInTransaction(tx, {
  agreementId: existing.id,
  type: "SIGNED",
  actor: { type: "INTEGRATION", occurredAt: signedAt },
});
```

If a legacy/copied `DRAFT` link is signed before a recorded send action, `applyAgreementEventInTransaction(SIGNED)` first records `AGREEMENT_SENT` and advances through `AGREEMENT_SENT`, then records `AGREEMENT_SIGNED` at the signature time. The sent/signed events use the stable agreement-scoped keys listed in Step 1. A genuine signature must not fail solely because the earlier legacy UI omitted the sent event, and a signature replay returns the signed state without another event.

For a linked review-required/canonically incomplete Lead, a verified integration signature is the bounded exception to `assertCommercialLeadReady`: update the Agreement status and append the idempotent signed fact, but do not clear review, change attribution/ownership, or invent/advance a null unsafe Lead stage. User-triggered sent/cancel actions remain blocked until review resolution. Verified first-payment processing likewise always preserves provider truth; it may set canonical/legacy `WON` because payment is authoritative, but leaves review and unresolved source/ownership untouched for the admin resolver.

Cancellation before first payment preserves the Agreement, requires a reason, emits `AGREEMENT_CANCELLED` with `lead:<leadId>:agreement-cancelled:<agreementId>`, and returns the Lead to `QUALIFIED`. A paid Agreement cannot use this pre-payment cancellation path. Remove hard deletion of Lead-linked agreements.

`POST /api/agreements/[id]/credit` requires admin and `{ creditedSellerId, reason }`. `changeAgreementCredit` updates the Agreement and any existing `SellerCommission.sellerId` in one transaction and appends `COMMISSION_CREDIT_CHANGED`; ordinary reassignment never calls this service.

- [ ] **Step 5: Make first payment atomic with WON and commission**

Inside the existing first-charge transaction:

```text
update Agreement payment fields;
update Client/Product mirrors;
append PAYMENT_SUCCEEDED once with
  lead:<leadId>:payment-succeeded:<providerTransactionId>;
transition linked Lead to WON even from LOST;
append WON once with lead:<leadId>:won;
set wonAt and legacy CLOSED/closedAt;
refresh legacyStateHash from the resulting compatibility fields;
cancel active follow-ups;
create SellerCommission from creditedSellerId with legacy agreementId and
canonical agreementRefId both set to the Agreement ID, agreementLinkStatus=LINKED,
and uniqueness on both identifiers.
```

During compatibility rollout, if an existing seller Agreement has `creditedSellerId=null`, resolve the valid seller from its legacy `createdBy/isSellerDeal`, freeze `creditedSellerId` in the same transaction, and then create commission. If no valid seller can be proven, do not guess; complete the payment truth, leave credit null for the reconciliation report, and alert admins. An Agreement with no linked Lead keeps its existing payment/client behavior and creates no false Lead event; reconciliation reports seller Agreements that should have had a Lead link.

`PaymentLeadResult` returns whether a commission was newly created plus post-commit notification effects; the webhook executes those effects only after its database transaction commits. Derive `providerAttemptId` from the immutable Cardcom attempt/LowProfile identifier already persisted for that charge; never substitute a timestamp or random value, and reject an unidentifiable callback for reconciliation. A payment failure appends one Lead `PAYMENT_FAILED` event with recipient-independent `dedupeKey=lead:<leadId>:payment-failed:<providerAttemptId>`. After commit it sends the credited seller one notification with `dedupeKey=<recipient>:payment-failed:<agreementId>:<providerAttemptId>` and `sellerLeadActionUrl(lead)`; if no credited seller can be proven, it alerts admins instead of guessing. A valid payment after `LOST` uses `PAYMENT_MISMATCH` with `dedupeKey=<adminId>:payment-mismatch:<agreementId>:<providerTransactionId>`. Do not exit a retry solely because `paymentStatus=COMPLETED`; first verify the WON event and commission both exist and repair either missing side effect.

Failed first payment keeps the Agreement and Lead stage unchanged, creates no synthetic `LeadFollowUp`, and never sets `WON`. `LeadDetail.nextAction` derives `{ kind: "RECOVER_FIRST_PAYMENT", agreementId }` from the latest failed first-payment attempt until a later successful payment or cancellation supersedes it.

- [ ] **Step 6: Verify and commit**

Run: `npx tsx --test src/lib/leads/agreement-lifecycle.test.ts`
Expected: PASS.

Run: `npx tsc --noEmit`
Expected: PASS.

Run: `npm test`
Expected: the complete existing suite passes.

Commit:

```bash
git add prisma/schema.prisma src/lib/leads src/app/api/agreements src/app/api/seller/agreements src/app/api/payments/webhook/route.ts 'src/app/seller/(dashboard)/agreements/new/page.tsx'
git commit -m "feat: connect agreements and payments to lead lifecycle"
```

---

### Task 8: Canonical Seller/Admin Projections and API Boundaries

**Files:**

- Create: `src/lib/leads/projection.ts`
- Create: `src/lib/leads/projection.test.ts`
- Create: `src/lib/leads/admin-query.ts`
- Create: `src/lib/leads/admin-query.test.ts`
- Modify: `src/lib/prospecting/seller-view.ts`
- Modify: `src/app/api/seller/leads/route.ts`
- Modify: `src/app/api/seller/leads/[id]/route.ts`
- Modify: `src/app/api/seller/cold-leads/route.ts`
- Modify: `src/app/api/seller/cold-leads/[id]/route.ts`
- Modify: `src/app/api/leads/route.ts`
- Modify: `src/app/api/leads/[id]/route.ts`

**Interfaces:**

- Produces: `LeadListItem`, `LeadDetail`, and `LeadCapabilities` JSON contracts.
- Produces: `getSellerLeadList(input: SellerLeadListInput): Promise<CursorPage<LeadListItem>>`
- Produces: `getSellerLeadDetail(input: { id: string; sellerId: string }): Promise<LeadDetail>`
- Produces: `getLeadIntentForSeller(id: string, sellerId: string): Promise<LeadIntentLevel>`
- Produces: `getAdminLeadList(filters: AdminLeadFilters): Promise<AdminLeadPage>`
- Produces: `getAdminLeadDetail(id: string): Promise<AdminLeadDetail>`

```ts
interface SellerLeadListInput {
  sellerId: string;
  intents: readonly LeadIntentLevel[];
  cursor?: string;
  limit?: number;
}

interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}
```

`AdminLeadFilters` is the exact validated filter object listed in Step 4; raw query strings are parsed before reaching the query service. Seller IDs come from the session in route adapters.

- [ ] **Step 1: Write failing projection and filter tests**

Assert an eligible seller sees only their unowned/owned Leads, never another owner's Lead. Assert cold projection overlays live Google phone/category/address while retaining audited website fallback during outage.

Assert every seller list/detail item contains non-null canonical:

```ts
{
  intentLevel,
  sourceKey,
  sourceLabel,
  sourceContext,
  stage,
  owner,
  phone,
  website,
  mapUrl,
  nextAction,
  capabilities,
}
```

Admin projections additionally expose `migrationReviewRequired` and `migrationReviewReason`. Only an admin review row may carry nullable `intentLevel/sourceKey/stage`; seller projections exclude every review-required row before reading PII. Review rows have all commercial capabilities disabled until resolved.

Test admin filters for intent, source, owner, stage, created/last-activity date, territory, internal business category, quality score, overdue follow-up, and `reviewRequired`.

- [ ] **Step 2: Run and observe failure**

Run: `npx tsx --test src/lib/leads/projection.test.ts src/lib/leads/admin-query.test.ts src/lib/prospecting/seller-view.test.ts`
Expected: FAIL because the canonical projection/query modules are missing.

- [ ] **Step 3: Implement contracts and timeline**

`LeadDetail` includes company notes, `LeadInteraction`, `LeadFollowUp`, `LeadEvent`, Prospect audit/call-angle snapshot, and Agreements merged into one timeline ordered by `occurredAt`, then `recordedAt`. It exposes `doNotContactAt`; when set, all contact/follow-up capabilities are false. It derives the failed-payment recovery next action defined in Task 7 without modifying or replacing an existing scheduled follow-up.

Define `lastActivityAt` as the maximum recorded timestamp across Lead events, interactions, notes, follow-up updates, and Agreement updates. `dateField=lastActivityAt` uses that definition consistently in filters and rows.

Capabilities are server-computed:

```ts
export interface LeadCapabilities {
  canClaim: boolean;
  canPrepare: boolean;
  canContact: boolean;
  canRecordInteraction: boolean;
  canAddNote: boolean;
  canUpdateContact: boolean;
  canScheduleFollowUp: boolean;
  canCompleteFollowUp: boolean;
  canCreateAgreement: boolean;
  canReassign: boolean;
  canCorrectSource: boolean;
  canChangeCommissionCredit: boolean;
  canMarkLost: boolean;
  canMarkSpam: boolean;
  canReopen: boolean;
}
```

- [ ] **Step 4: Replace broad seller queries**

`GET /api/seller/leads` returns only `AD_RESPONSE|INBOUND` within `sellerLeadScope`. `GET /api/seller/cold-leads` returns (a) eligible unowned `NEW` OUTBOUND Leads from the seller's current published cycle and (b) every non-terminal OUTBOUND Lead already owned by that seller. An untouched Lead superseded by replacement is `LOST/BATCH_SUPERSEDED` and never appears. No seller API returns 300 global Leads.

Both detail endpoints enforce owner/eligible scope before fetching PII. Google details are batched on lists and fetched once on detail.

When the corresponding server-side feature flag is false, these routes map the canonical projection back to the exact legacy JSON keys consumed by `LegacyIncomingLeadsPage` and `LegacyColdLeadsPage`. The legacy shape is an adapter only: authorization remains scoped and every write still uses the canonical domain.

- [ ] **Step 5: Move admin filtering server-side**

`GET /api/leads` accepts:

```text
intent, source, owner, stage, from, to, territory, minScore,
maxScore, businessCategory, dateField (createdAt|lastActivityAt),
overdue, reviewRequired, search, cursor, limit (default 50, max 100).
```

Return `{ leads, nextCursor, stats }`. Keep `?all=true` and `?focus=` compatibility until Task 14.

When unified admin UI is disabled, `/api/leads` returns the legacy response contract from the same scoped canonical query so `LegacyAdminLeadsPage` remains functional.

- [ ] **Step 6: Verify and commit**

Run: `npx tsx --test src/lib/leads/projection.test.ts src/lib/leads/admin-query.test.ts src/lib/prospecting/seller-view.test.ts`
Expected: PASS.

Run: `npx tsc --noEmit`
Expected: PASS.

Run: `npm test`
Expected: the complete existing suite passes.

Commit:

```bash
git add src/lib/leads src/lib/prospecting/seller-view.ts src/app/api/seller src/app/api/leads
git commit -m "feat: expose scoped canonical lead projections"
```

---

### Task 9: Shared Lead Workspace Components

**Files:**

- Create: `src/lib/leads/ui-state.ts`
- Create: `src/lib/leads/ui-state.test.ts`
- Create: `src/components/leads/LeadSourceBadge.tsx`
- Create: `src/components/leads/LeadContactActions.tsx`
- Create: `src/components/leads/LeadPrimaryAction.tsx`
- Create: `src/components/leads/LeadActivityTimeline.tsx`
- Create: `src/components/leads/LeadWorkspace.tsx`
- Create: `src/components/seller/leads/LeadPreparationPanel.tsx`
- Create: `src/components/seller/leads/LeadOutcomeSheet.tsx`

**Interfaces:**

- Consumes: Task 8 `LeadDetail` and capabilities.
- Produces: `primaryLeadAction(input): LeadPrimaryActionKind`
- Produces: reusable workspace for seller and admin detail pages.

- [ ] **Step 1: Write failing one-CTA tests**

Assert:

```ts
assert.equal(primaryLeadAction(outboundNewEligible), "START_PREPARATION");
assert.equal(primaryLeadAction(inboundNewEligible), "CLAIM_AND_CALL");
assert.equal(primaryLeadAction(ownedPreparing), "CALL");
assert.equal(primaryLeadAction(ownedQualified), "CREATE_AGREEMENT");
assert.equal(primaryLeadAction(wonLead), "NONE");
```

Assert no state returns two primary actions.

- [ ] **Step 2: Run and observe failure**

Run: `npx tsx --test src/lib/leads/ui-state.test.ts`
Expected: FAIL because `ui-state.ts` is missing.

- [ ] **Step 3: Implement the pure UI-state mapping**

Create `ui-state.ts` with the exact action union:

```ts
export type LeadPrimaryActionKind =
  | "START_PREPARATION"
  | "CLAIM_AND_CALL"
  | "CALL"
  | "RECORD_OUTCOME"
  | "CREATE_AGREEMENT"
  | "VIEW_AGREEMENT"
  | "NONE";
```

Use capabilities from the server as a hard ceiling; the client mapping may hide actions but may never invent permission.

- [ ] **Step 4: Build source and contact components**

`LeadSourceBadge` renders the three approved Hebrew intent labels plus channel/context.

`LeadContactActions` renders:

```text
tel: link, copy button with toast “הועתק”, WhatsApp when permitted,
website target=_blank rel=noopener noreferrer, and Google Maps.
```

When `doNotContactAt` is set, render a clear non-interactive חסימת פניות state and no call, copy-phone, WhatsApp, or follow-up control. Test this in `ui-state.test.ts`.

Use the existing backend classes:

```text
bg-gray-900 border border-gray-700 rounded-2xl
bg-pink hover:bg-pink-dark text-white rounded-xl
bg-cyan/20 text-cyan rounded-xl
```

Do not introduce inline hex colors or font classes.

- [ ] **Step 5: Build workspace, timeline, preparation, and outcome sheet**

`LeadWorkspace` has tabs “פעילות והערות”, “הכנה ואבחון”, and “חוזה ומכירה”. It displays one primary action, next action, source, ownership, and contact actions above the tabs. All save operations use the existing toast behavior for success/failure and refresh the canonical projection immediately.

The preparation panel renders live area/address/category/map context, the audited existing-site link or “אין אתר”, any available screenshot/information, the existing Fuzion SEO/speed/mobile/maintenance-visual/e-commerce findings, the opportunity summary, and up to three versioned call angles. Google outage renders “המידע לא זמין זמנית” without erasing the audited domain or website status. The outcome sheet requires the structured fields from Task 5 and submits selected call-angle IDs.

Reuse the existing bottom-sheet `safe-pb`, RTL, rounded-xl controls, focus borders, and `react-hot-toast`.

- [ ] **Step 6: Verify and commit**

Run: `npx tsx --test src/lib/leads/ui-state.test.ts`
Expected: PASS.

Run: `npx tsc --noEmit`
Expected: PASS.

Run: `npm test`
Expected: the complete existing suite passes.

Commit:

```bash
git add src/lib/leads/ui-state.ts src/lib/leads/ui-state.test.ts src/components/leads src/components/seller/leads
git commit -m "feat: add shared lead workspace components"
```

---

### Task 10: Seller Cold, Incoming, Detail, and Contract UX

**Files:**

- Modify: `src/app/seller/(dashboard)/cold-leads/page.tsx`
- Modify: `src/components/seller/ColdLeadCard.tsx`
- Modify: `src/components/seller/CallOutcomeSheet.tsx`
- Modify: `src/components/seller/cold-lead-types.ts`
- Modify: `src/app/seller/(dashboard)/leads/page.tsx`
- Create: `src/app/seller/(dashboard)/leads/[id]/page.tsx`
- Modify: `src/app/seller/(dashboard)/page.tsx`
- Modify: `src/app/seller/(dashboard)/sales/page.tsx`
- Create: `src/components/seller/leads/LegacyColdLeadsPage.tsx`
- Create: `src/components/seller/leads/UnifiedColdLeadsPage.tsx`
- Create: `src/components/seller/leads/LegacyIncomingLeadsPage.tsx`
- Create: `src/components/seller/leads/UnifiedIncomingLeadsPage.tsx`

**Interfaces:**

- Consumes: canonical seller APIs and Task 9 components.
- Produces: prep-first OUTBOUND queue and priority INBOUND/AD_RESPONSE queue.

- [ ] **Step 1: Preserve real server-side rollback wrappers**

Move the current client implementations into `LegacyColdLeadsPage.tsx` and `LegacyIncomingLeadsPage.tsx` without changing their visual language. Apply only the behavior corrections required by the canonical domain: scoped data, atomic claim, company-note counts/history, no note deletion or seller release, structured loss/follow-up input, and contract actions only when the server capability allows them. The old “סגור עסקה → חוזה” control becomes the valid legacy qualification adapter and never marks `WON`. Build the new clients in the matching `Unified*` files. The route files become server wrappers:

```tsx
const config = getLeadLifecycleConfig();
return config.enabled
  ? <UnifiedIncomingLeadsPage />
  : <LegacyIncomingLeadsPage />;
```

The cold route selects unified UI only when both `config.enabled` and `config.coldPreparationEnabled` are true. Do not expose either flag to the browser. Legacy components still write through the canonical compatibility adapters from Tasks 3–7. Both legacy pages implement `?focus=<canonicalLeadId>`: fetch only within seller scope, scroll/focus and visibly highlight the matching row, and return a normal not-found state for an unauthorized/missing ID so rollback notification links still open the exact Lead.

- [ ] **Step 2: Convert cold cards to canonical Lead IDs**

The list response includes `leadId`. `ColdLeadCard` shows, without expansion:

```text
business, live category, Google Maps/territory/week,
“פנייה קרה”, score 0–5, opportunity summary,
click/copy phone, clickable website or “אין אתר”, ownership, one CTA.
```

`התחל הכנה` posts to `/api/seller/leads/<leadId>/claim`, then routes to `/seller/leads/<leadId>`. Remove late promotion, research approval, and research-rejection UI from the unified client.

- [ ] **Step 3: Replace regular seller cards with the incoming queue**

`/seller/leads` requests only `INBOUND|AD_RESPONSE`. Sort all `INBOUND` first, oldest unhandled first, then `AD_RESPONSE`, oldest unhandled first. Show source-specific context, elapsed response time, SLA state, contact actions, owner, and one primary CTA.

In the unified queue, remove all direct status selectors, personal-note deletion, global Lead visibility, and “סגור עסקה → חוזה”. The legacy queue receives the safety corrections from Step 1 while preserving its existing classes and layout.

- [ ] **Step 4: Add the canonical seller detail page**

The new page is a thin wrapper:

```tsx
import LeadWorkspace from "@/components/leads/LeadWorkspace";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function SellerLeadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const config = getLeadLifecycleConfig();
  const intentLevel = await getLeadIntentForSeller(id, session.user.id);
  if (!config.enabled) {
    redirect(
      intentLevel === "OUTBOUND"
        ? `/seller/cold-leads?focus=${id}`
        : `/seller/leads?focus=${id}`,
    );
  }
  if (intentLevel === "OUTBOUND" && !config.coldPreparationEnabled) {
    redirect(`/seller/cold-leads?focus=${id}`);
  }
  return <LeadWorkspace leadId={id} audience="seller" />;
}
```

`getLeadIntentForSeller` applies seller scope before returning the minimal field. The claim endpoint also rejects OUTBOUND preparation while `COLD_LEAD_PREPARATION_ENABLED=false`; incoming claim remains available. The workspace claims before revealing preparation actions, records outcomes, company notes, contact corrections, and follow-ups, and links to agreement creation only when `canCreateAgreement=true`. Keep `?focus=<id>` compatibility as the legacy fallback.

- [ ] **Step 5: Surface next actions and agreement state**

Add due/overdue follow-ups to the seller dashboard. Add Lead stage/source to `/seller/sales`. Keep post-payment report/brief pages unchanged.

- [ ] **Step 6: Browser-check seller UX and commit**

In the local app, verify desktop and narrow viewport:

```text
source visible; phone copies with “הועתק”; site and map open;
claim locks once; cold preparation appears after claim;
outcome requirements block invalid submission; notes persist;
follow-up appears as next action; only qualified owner sees contract action;
missing cold-contact fields can be confirmed before contract creation;
do-not-contact removes communication/follow-up actions;
flags false render the old screens while writes keep canonical invariants;
keyboard focus is visible; RTL and safe areas remain correct.
```

Run: `npx tsc --noEmit`
Expected: PASS.

Run: `npm test`
Expected: the complete existing suite passes.

Commit:

```bash
git add src/app/seller src/components/seller
git commit -m "feat: complete seller lead workflow"
```

---

### Task 11: Unified Admin CRM and Actionable Prospect Table

**Files:**

- Modify: `src/app/admin/(dashboard)/leads/page.tsx`
- Create: `src/app/admin/(dashboard)/leads/[id]/page.tsx`
- Create: `src/components/admin/leads/LeadFilters.tsx`
- Create: `src/components/admin/leads/LeadTable.tsx`
- Create: `src/components/admin/leads/LeadOwnershipControls.tsx`
- Create: `src/components/admin/leads/LeadCorrectionControls.tsx`
- Create: `src/components/admin/leads/LeadMigrationReviewControls.tsx`
- Create: `src/components/admin/leads/LegacyAdminLeadsPage.tsx`
- Create: `src/components/admin/leads/UnifiedAdminLeadsPage.tsx`
- Create: `src/app/api/leads/[id]/ownership/route.ts`
- Create: `src/app/api/leads/[id]/source/route.ts`
- Create: `src/app/api/leads/[id]/contact/route.ts`
- Create: `src/app/api/leads/[id]/stage/route.ts`
- Create: `src/app/api/leads/[id]/migration-resolution/route.ts`
- Modify: `src/app/api/prospecting/cycles/[id]/route.ts`
- Modify: `src/components/admin/prospecting/types.ts`
- Modify: `src/components/admin/prospecting/ProspectTable.tsx`

**Interfaces:**

- Consumes: Task 8 admin query/detail and Task 2 reassignment.
- Produces: server-filtered admin CRM and research→Lead navigation.

- [ ] **Step 1: Preserve the admin rollback path and split responsibility**

Move the current client page into `LegacyAdminLeadsPage.tsx`. Build `UnifiedAdminLeadsPage.tsx` as data/filter orchestration and move filters, table rows, and ownership/correction controls to the named components. Remove “מחק פנייה”, bulk Lead/note deletion, and arbitrary direct status writes from both clients; history and state-machine rules remain enforced when the legacy UI flag is active. Replace legacy mutations with the same reasoned ownership/stage/correction services, without changing summary-card/card/table classes or the admin shell. The route becomes a server wrapper that reads `getLeadLifecycleConfig()` and chooses legacy or unified UI.

- [ ] **Step 2: Add the approved filters and detail page**

Filters serialize to URL search parameters:

```text
intent, source, owner, stage, from, to, territory,
minScore, maxScore, businessCategory,
dateField (createdAt|lastActivityAt), overdue, reviewRequired, search.
```

Rows show intent/source, owner, stage, next action, copyable phone, clickable website, and link to `/admin/leads/<id>`. Review-required rows show the existing-style “דורש סיווג” badge instead of fabricated source/stage values. The detail page checks the server flag: when unified UI is off it redirects to `/admin/leads?focus=<id>`; otherwise it uses `LeadWorkspace audience="admin"` and supports company notes, follow-up changes, contact correction, and reassign/release controls. `LegacyAdminLeadsPage` implements scoped `?focus=<id>` and may render the existing-style migration-resolution control for that row even while the full unified UI is off; this is required to clear backfill exceptions before feature enablement. A review-required detail renders `LeadMigrationReviewControls` and disables claim/contact/follow-up/agreement actions until resolution succeeds.

- [ ] **Step 3: Add atomic admin ownership actions**

`POST /api/leads/[id]/ownership` accepts:

```ts
{
  action: "reassign" | "release";
  sellerId?: string;
  reason: string;
  cancelFollowUps?: boolean;
}
```

It requires admin, calls `releaseOrReassignLead`, and returns 409 when release would orphan an active follow-up.

`POST /api/leads/[id]/source` accepts the new intent/source/external ID/snapshot plus a mandatory reason and delegates only to `correctLeadSource`. `POST /api/leads/[id]/contact` delegates to `updateLeadContactDetails` with admin-confirmed provenance. `LeadCorrectionControls` exposes these audited corrections without making source fields editable inline.

`POST /api/leads/[id]/stage` exposes admin `mark-lost`, non-OUTBOUND `mark-spam`, and `reopen-lost` actions. Loss/reopen reasons are mandatory, and all three delegate to `transitionLeadStage`. The admin workspace uses `/api/leads/[id]/follow-ups` for schedule/reschedule/complete.

`POST /api/leads/[id]/migration-resolution` accepts `{ intentLevel, sourceKey, externalLeadId?, sourceSnapshot, stage?, ownerId?, eligibleSellerId, reason }`, derives the admin actor from the session, and delegates only to `resolveLeadMigrationReview`. The UI requires an explicit choice when legacy assignees disagree, validates the selected source schema before submit, never offers manual `WON`, and shows verified-payment `WON` as a read-only server-derived stage. For every unpaid row, `stage` is required and cannot be `WON`. Refresh the canonical detail after success. This is the only product path that clears `migrationReviewRequired`.

In the agreement area, an admin-only credit correction action calls `/api/agreements/[id]/credit`, requires a new seller and reason, and clearly states that normal Lead reassignment does not change commission credit.

- [ ] **Step 4: Make ProspectTable actionable**

Extend `ProspectView` with `promotedLeadId`, `liveStatus`, live phone, audited-domain/live website projection, and map URL. Render:

```text
tel/copy phone, website link, map link, and “פתח ליד”.
```

For live outage render “המידע לא זמין זמנית”, never “אין טלפון”. Link `promotedLeadId` to `/admin/leads/<id>`.

- [ ] **Step 5: Browser-check admin UX and commit**

Verify filters persist on refresh, deep links work, reassign updates owner/timeline, admin notes/follow-ups work, source/contact/commission corrections require reasons and appear in the timeline, migration-review resolution changes “דורש סיווג” into a fully actionable canonical Lead without losing history, and Prospect phone/site actions work. Compare typography/colors/sidebar/header against the current production screenshot.

Run: `npx tsc --noEmit`
Expected: PASS.

Run: `npm test`
Expected: the complete existing suite passes.

Commit:

```bash
git add 'src/app/admin/(dashboard)/leads' src/components/admin/leads src/app/api/leads src/app/api/prospecting/cycles src/components/admin/prospecting
git commit -m "feat: add unified admin lead management"
```

---

### Task 12: Funnel Analytics and Source Performance

**Files:**

- Create: `src/lib/leads/analytics.ts`
- Create: `src/lib/leads/analytics.test.ts`
- Create: `src/app/api/leads/analytics/route.ts`
- Create: `src/components/admin/leads/LeadMetrics.tsx`
- Modify: `src/components/admin/leads/UnifiedAdminLeadsPage.tsx`

**Interfaces:**

- Produces: `calculateLeadMetrics(rows, cohort): LeadMetrics`
- Produces: admin-only `/api/leads/analytics`.

- [ ] **Step 1: Write failing metric-definition tests**

Use a fixed cohort and assert:

```ts
assert.equal(metrics.created, 10);
assert.equal(metrics.claimed, 8);
assert.equal(metrics.contacted, 7);
assert.equal(metrics.decisionMakerReached, 5);
assert.equal(metrics.qualified, 4);
assert.equal(metrics.agreementCreated, 3);
assert.equal(metrics.agreementSent, 3);
assert.equal(metrics.agreementSigned, 2);
assert.equal(metrics.paid, 1);
assert.equal(metrics.revenue, 599);
assert.equal(metrics.averageDealSize, 599);
```

Assert time-to-claim/contact uses event `occurredAt`, loss reasons total correctly, and cold breakdown keys by territory, internal business category, score, and used call-angle ID.

Assert `INBOUND`/`AD_RESPONSE` within-SLA counts use the same configured thresholds as Task 6 and never include `OUTBOUND`.

- [ ] **Step 2: Run and observe failure**

Run: `npx tsx --test src/lib/leads/analytics.test.ts`
Expected: FAIL because `analytics.ts` is missing.

- [ ] **Step 3: Implement cohort-based analytics**

The cohort is Leads whose `createdAt` falls in the requested range. Later events count conversion for that cohort even when the event occurs after the range. Never mix “events during period” with “Leads created during period”.

Return counts, rates, medians in minutes, within-SLA rates, first-payment revenue, average first-month deal size, loss reasons, and breakdowns by intent/source/seller. Activity-stage metrics use the owner/event actor at the time; paid revenue and deal credit use frozen `Agreement.creditedSellerId`, so later reassignment does not rewrite seller performance. Query cold attributes through Prospect/cycle and versioned source snapshot, not Google live category.

- [ ] **Step 4: Add API and existing-style metric cards**

The API requires admin and supports the same source/intent/date filters. `LeadMetrics` uses the current summary-card visual language and a compact funnel table; do not add a charting dependency.

- [ ] **Step 5: Verify and commit**

Run: `npx tsx --test src/lib/leads/analytics.test.ts`
Expected: PASS.

Run: `npx tsc --noEmit`
Expected: PASS.

Run: `npm test`
Expected: the complete existing suite passes.

Commit:

```bash
git add src/lib/leads/analytics.ts src/lib/leads/analytics.test.ts src/app/api/leads/analytics src/components/admin/leads/LeadMetrics.tsx src/components/admin/leads/UnifiedAdminLeadsPage.tsx
git commit -m "feat: add lead funnel analytics"
```

---

### Task 13: Idempotent Backfill, Reconciliation, and Database Constraints

**Files:**

- Create: `src/lib/leads/legacy-mapping.ts`
- Create: `src/lib/leads/legacy-mapping.test.ts`
- Create: `scripts/backfill-unified-lead-lifecycle.ts`
- Create: `scripts/reconcile-unified-lead-lifecycle.ts`
- Create: `scripts/resolve-unified-lead-exceptions.ts`
- Create: `scripts/fixtures/unified-lead-resolutions.empty.json`
- Create: `scripts/apply-unified-lead-indexes.ts`
- Create: `scripts/apply-unified-lead-constraints.ts`
- Modify: `src/lib/leads/agreement-lifecycle.ts`
- Modify: `src/lib/leads/agreement-lifecycle.test.ts`
- Modify: `package.json`

**Interfaces:**

- Consumes: Task 1 `legacyLeadStateHash`.
- Produces: `mapLegacyLeadSource`, `deriveLegacyLeadStage`, and `mapLegacyProspectInteraction`.
- Produces: script-only `cancelDuplicateAgreementForMigrationInTransaction(tx, input)`, `linkHistoricalCommissionInTransaction(tx, input)`, and `classifyLegacyOrphanCommissionInTransaction(tx, input)`.
- Produces dry-run/apply backfill, exception-resolution, reconciliation, and hardening scripts.

```ts
interface CancelDuplicateAgreementForMigrationInput {
  agreementId: string;
  retainedAgreementId: string;
  reason: string;
  actor: AuthenticatedLeadActor;
}

interface LinkHistoricalCommissionInput {
  commissionId: string;
  agreementId: string;
  reason: string;
  actor: AuthenticatedLeadActor;
}

interface ClassifyLegacyOrphanCommissionInput {
  commissionId: string;
  reason: string;
  actor: AuthenticatedLeadActor;
}
```

The resolver derives `actor` exclusively from `OPERATOR_USER_ID` after loading that user and confirming the persisted role is `ADMIN`; resolution JSON never contains actor ID or role.

- [ ] **Step 1: Write failing legacy mapping tests**

Assert:

```ts
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
assert.deepEqual(mapLegacyLeadSource({ acquisitionChannel: "GOOGLE_PROSPECTING" }), {
  intentLevel: "OUTBOUND",
  sourceKey: "google_maps",
});
assert.equal(
  mapLegacyLeadSource({ acquisitionChannel: "MANUAL", source: "OTHER" }),
  null,
);
assert.equal(deriveLegacyLeadStage({ paidAt: new Date(), status: "LOST" }), "WON");
assert.equal(deriveLegacyLeadStage({ paidAt: null, status: "CLOSED" }), null);
```

`null` means migration review, never a guessed intent/stage.

Also assert that an existing Lead linked through `Prospect.promotedLeadId` maps to `OUTBOUND/google_maps` even when its legacy acquisition fields are empty.

Assert `legacyLeadStateHash` is stable across assignee ordering, contains no name/email/phone/note input, and changes when any mapped legacy status, assignee, attribution, contact, follow-up, or closed field changes. Simulate a pre-cutover backfill, mutate an existing row's legacy status and assignees through an old-writer fake, run catch-up, and assert canonical stage/owner plus the stored fingerprint are refreshed; a second catch-up is a no-op. Simulate a canonical post-deploy write that refreshes legacy mirrors and the hash atomically, then prove catch-up does not regress it. Add an interleaved race test in which catch-up and a canonical mutation target the same Lead; the row lock/serialization retry must yield the canonical mutation as final truth with a matching hash, never a stale catch-up overwrite.

- [ ] **Step 2: Run and observe failure**

Run: `npx tsx --test src/lib/leads/legacy-mapping.test.ts`
Expected: FAIL because `legacy-mapping.ts` is missing.

- [ ] **Step 3: Implement deterministic mappings**

Priority for stage:

```text
verified first payment → WON;
active Agreement status → matching agreement stage;
Prospect QUALIFIED/FOLLOW_UP/contact history → QUALIFIED/CONTACTING;
legacy NEW/IN_PROGRESS/LOST/SPAM → matching safe stage;
CLOSED without payment → migration review.
```

Map Prospect interactions to canonical outcomes and preserve original `createdAt` as `occurredAt`.

- [ ] **Step 4: Build the dry-run-first backfill**

`scripts/backfill-unified-lead-lifecycle.ts` must:

```text
print mode and counts;
process one Lead/Prospect per bounded Serializable transaction with retry;
for an existing Lead, lock its ContactSubmission row first with a parameterized
SELECT ... FOR UPDATE, then read legacy fields and assignees inside that same
transaction; never derive from a pre-lock snapshot;
recompute legacyLeadStateHash for every existing Lead and rederive canonical
state whenever the stored hash is null or differs, including rows already
backfilled before cutover; write the new hash only after the same transaction
successfully synchronizes canonical and legacy state;
backfill source/intent/stage;
build the safest validated historical sourceSnapshot available from
legacy campaign/form/website fields without inventing missing facts;
set a single assignee as owner+eligible seller, assign the configured
eligible seller to safe unowned incoming Leads, or mark multi-assignee review;
keep ambiguous source/intent Leads review-required and admin-only;
set migrationReviewRequired=false only after that row has a registry-valid
source snapshot, safe non-null stage, and unambiguous owner/eligible seller;
create/link every published Prospect Lead by gplaces:<placeId>;
populate eligibleSellerId, google_maps snapshot, and safe derived stage
for every published Prospect;
copy ProspectInteraction using legacyProspectInteractionId uniqueness;
create active follow-up from legacy FOLLOW_UP;
create an active follow-up for legacy IN_PROGRESS with a future nextFollowUpAt;
restore doNotContactAt and suppression hashes from legacy DO_NOT_CALL evidence;
for a Prospect with interactions, assign its seller, set firstClaimedAt
from the earliest interaction, and derive stage from the latest safe outcome;
leave an untouched published Prospect NEW and unowned but eligible;
mark a published/replaced Prospect LOST with BATCH_SUPERSEDED;
backfill creditedSellerId from commission or valid seller creator;
for each historical commission whose legacy agreementId resolves, set
agreementRefId to that Agreement and agreementLinkStatus=LINKED idempotently;
leave a non-resolving legacy commission unclassified for explicit admin
resolution—never synthesize an Agreement or silently accept it;
append MIGRATED with a versioned dedupe key;
write only when APPLY=1.
```

The catch-up never performs “read outside transaction, write later”. Its per-row transaction acquires the row lock before deriving state and holds it through canonical fields, legacy mirrors, assignees, events, and `legacyStateHash`. Retry serialization/deadlock failures a bounded two times, then report the row unresolved and exit non-zero. A concurrent canonical service either commits before the lock (so catch-up sees its matching hash and does nothing) or waits and commits afterward with its own refreshed hash; catch-up cannot overwrite a newer canonical mutation.

Historical snapshots use explicit, source-specific minimum mappings:

```text
meta_lead_ads:
  externalLeadId from the persisted Meta ID (required);
  formId/formName/campaignId/adId from the matching legacy columns when present;
  nonContactAnswers=[];
  receivedAt=ContactSubmission.createdAt;
  omit account/ad-set/names that were never stored rather than inventing them.

website:
  landingPage from a safely parseable legacy first-party URL, otherwise "/contact";
  service from ContactSubmission.service when present;
  referrer and each UTM only when a persisted value can be parsed and allow-listed;
  receivedAt=ContactSubmission.createdAt.

google_maps:
  rebuild only from the linked Prospect and approved cycle/batch;
  include territory, cycleId, batchId, weekStart, placeId,
  websiteStatus, auditedDomain,
  internalBusinessCategory=(businessShape ?? "UNKNOWN"),
  internalBusinessCategoryVersion=(businessShapeVersion ?? 1),
  qualityScore, scoringVersion
  (scoringVersion ?? 1), opportunitySummary, and stable versioned call angles;
  never copy live Google phone/address/category/websiteUri.
```

If the minimum required context for the inferred source—including Google cycle, batch, or week—is unavailable or contradictory, do not synthesize a valid-looking snapshot: leave the canonical source fields unresolved, set `migrationReviewRequired=true` with a named reason, and keep the row admin-only until the Task 11 resolution path succeeds.

`ContactNote` rows stay in their existing table; do not copy or rewrite them. Reconciliation proves the original count, author IDs, and timestamps remain intact.

- [ ] **Step 5: Build read-only reconciliation**

Exit code 1 for any of:

```text
published Prospect without exactly one outbound Lead;
duplicate sourceKey+externalLeadId pair or legacy interaction;
Lead without intent/source/stage;
Lead with migrationReviewRequired still true;
Lead whose stored legacyStateHash differs from its current compatibility fields;
multi-assignee ownership unresolved;
CLOSED/WON without successful first payment;
active duplicate agreements or follow-ups;
seller Agreement that should have a Lead but has an invalid/missing relation;
SellerCommission with no link classification, LINKED without a valid
agreementRefId, or LEGACY_ORPHAN without reviewer/time/reason evidence;
note/interaction count mismatch;
missing credited seller on seller deal.
```

The Lead-count invariant is:

```text
post-backfill canonical Leads
= pre-backfill ContactSubmission rows
+ published Prospects that had neither promotedLeadId nor a matching
  canonical Lead before backfill
```

No pre-existing ContactSubmission may disappear.

The reconciliation report prints a remediation class for every failure; there is no “ignore” switch:

```text
SOURCE_OR_OWNERSHIP_REVIEW → resolve through Task 11 migration-resolution UI;
ACTIVE_AGREEMENT_DUPLICATE → cancel the invalid duplicate through the
  agreement lifecycle, preserving history and reason;
ACTIVE_FOLLOW_UP_DUPLICATE → cancel/reschedule through the follow-up service;
MISSING_AGREEMENT_CREDIT → use the audited commission-credit service;
ORPHAN_SELLER_AGREEMENT → provide an explicit Agreement↔Lead decision through
  resolve-unified-lead-exceptions;
ORPHAN_SELLER_COMMISSION → link to a proved Agreement, or explicitly classify
  an irrecoverable deleted-Agreement legacy orphan with admin/reason/time audit;
  never delete, synthesize an Agreement, or guess;
COUNT_OR_HISTORY_MISMATCH → rerun the idempotent importer and investigate;
  never force or waive the invariant.
```

`scripts/resolve-unified-lead-exceptions.ts` is dry-run by default and accepts only a versioned JSON resolution file plus `OPERATOR_USER_ID` for a persisted admin. Its discriminated actions are:

```text
LINK_AGREEMENT_TO_LEAD { agreementId, leadId, reason }
CANCEL_DUPLICATE_AGREEMENT { agreementId, retainedAgreementId, reason }
CANCEL_DUPLICATE_FOLLOW_UP { followUpId, reason }
SET_AGREEMENT_CREDIT { agreementId, sellerId, reason }
LINK_COMMISSION_TO_AGREEMENT { commissionId, agreementId, reason }
CLASSIFY_LEGACY_ORPHAN_COMMISSION { commissionId, reason }
```

Commit `scripts/fixtures/unified-lead-resolutions.empty.json` as `{ "version": 1, "actions": [] }` for parser/dry-run verification. Real resolution files contain production/preview IDs, must be stored outside Git, and are referenced by explicit path at operation time.

Each ordinary action calls the same transaction-aware domain primitive used by the application. Link verifies the Agreement is currently unlinked, the Lead exists, no active-agreement collision is created, contact/client evidence is compatible, and the reason is non-empty; on apply it links atomically and appends a PII-free `MIGRATED` audit event. If the Agreement already has verified first payment, the same transaction invokes the payment lifecycle repair so the Lead/commission become consistent rather than merely attaching the row. Follow-up cancellation and credit correction use the ordinary services.

Duplicate Agreement cleanup is the bounded migration exception: `cancelDuplicateAgreementForMigrationInTransaction` requires the persisted operator to be admin, a non-empty reason, an unpaid Agreement, and evidence that another explicitly selected Agreement is the retained active record. It marks only the duplicate Agreement `CANCELLED`, never deletes it, never changes Lead stage/source/owner, and appends a PII-free `MIGRATED` event when a linked Lead exists. This is safe before backfill when canonical stage may be null; it is callable only from the resolver script and is included in the writer-boundary allow-list by exact function name, never from a product route.

`LINK_COMMISSION_TO_AGREEMENT` uses script-only `linkHistoricalCommissionInTransaction`: require an unclassified historical commission, a real paid Agreement with no other canonical commission link, matching seller/payment evidence, persisted admin actor, and a reason. It leaves the original legacy `agreementId` untouched as evidence, sets `agreementRefId`, `agreementLinkStatus=LINKED`, reviewer/time/reason fields, and appends a PII-free `MIGRATED` event when the target Agreement has a Lead.

When the original Agreement was actually deleted and no real Agreement can be proved, `CLASSIFY_LEGACY_ORPHAN_COMMISSION` uses `classifyLegacyOrphanCommissionInTransaction`. It requires an unclassified commission, confirms its legacy `agreementId` has no matching Agreement, requires persisted admin plus a non-empty evidence-based reason, leaves `agreementRefId=null`, sets `agreementLinkStatus=LEGACY_ORPHAN` and reviewer/time/reason, and preserves every financial field and the original identifier. This is an explicit durable classification, not an ignore switch; new lifecycle code never associates that row with a new sale. Any ambiguous candidate remains unresolved.

In `agreement-lifecycle.test.ts`, prove linking rejects an unpaid/mismatched/already-linked Agreement; classification rejects a seller, blank reason, or any commission whose legacy Agreement still exists; a genuine deleted-record orphan is classified without changing amount, seller, status, paidAt, createdAt, or legacy agreementId; and rerunning either identical action is idempotent while a conflicting second resolution fails.

- [ ] **Step 6: Add pre-deploy indexes and post-backfill hardening**

`scripts/apply-unified-lead-indexes.ts` runs a focused read-only preflight for duplicate active Agreements and duplicate scheduled follow-ups, then requires `APPLY=1` before executing these static indexes:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS "Agreement_one_active_per_lead"
ON "Agreement" ("leadId")
WHERE "leadId" IS NOT NULL AND "status" IN ('DRAFT', 'SENT', 'SIGNED');

CREATE UNIQUE INDEX IF NOT EXISTS "LeadFollowUp_one_scheduled_per_lead"
ON "LeadFollowUp" ("leadId")
WHERE "status" = 'SCHEDULED';
```

This index phase runs after the additive schema exists but before lifecycle-writing code is deployed, so agreement/follow-up race guards exist from the first request.

`scripts/apply-unified-lead-constraints.ts` runs a dedicated nullability preflight in the same process and requires `APPLY=1` before executing only the post-backfill hardening:

```sql
ALTER TABLE "ContactSubmission"
  ALTER COLUMN "intentLevel" SET NOT NULL,
  ALTER COLUMN "sourceKey" SET NOT NULL,
  ALTER COLUMN "stage" SET NOT NULL;

DROP INDEX IF EXISTS "ContactSubmission_externalLeadId_key";
```

It refuses to act unless every Lead has non-null intent/source/stage, `migrationReviewRequired=false`, and a matching recomputed `legacyStateHash`; every SellerCommission is either canonically `LINKED` through its already-enforced nullable `agreementRefId` relation or explicitly audited as `LEGACY_ORPHAN`; the composite source index exists; and no legacy external-ID collision would be exposed by dropping the old index. The old scalar `SellerCommission.agreementId` is preserved as evidence and never receives a foreign key. This narrow preflight protects the DDL operation; the broader `leads:reconcile` must still return zero before any UI flag or production rollout proceeds. Because this repository has no Prisma migration baseline, do not create a partial `prisma/migrations` directory.

The constraint process imports and runs the dedicated preflight in the same process immediately before SQL execution; it does not trust a report file or a previously successful command. It verifies the Prisma-created `"Lead_source_external_unique"` composite index exists before hardening nullability and dropping the transitional single-column unique index. Do not update the release-candidate Prisma schema at this task: it must remain additive while any deployed database is still pre-hardening. After both preview and production succeed, Task 14's runbook requires a separate schema-sync commit that makes `intentLevel/sourceKey/stage` required and removes the old single-column `@unique`; the safe nullable `agreementRefId` relation was already part of the additive schema.

- [ ] **Step 7: Add package scripts and verify dry runs**

Add:

```json
"leads:backfill": "tsx scripts/backfill-unified-lead-lifecycle.ts",
"leads:resolve": "tsx scripts/resolve-unified-lead-exceptions.ts",
"leads:reconcile": "tsx scripts/reconcile-unified-lead-lifecycle.ts",
"leads:indexes": "tsx scripts/apply-unified-lead-indexes.ts",
"leads:constraints": "tsx scripts/apply-unified-lead-constraints.ts"
```

Run against an isolated preview database:

```bash
npm run leads:backfill
npm run leads:resolve -- --file scripts/fixtures/unified-lead-resolutions.empty.json
npm run leads:reconcile
npm run leads:indexes
```

Expected: all are read-only; backfill/resolver/indexes say `DRY RUN`, reconciliation prints named invariants.

- [ ] **Step 8: Commit**

Run: `npx tsx --test src/lib/leads/legacy-mapping.test.ts`
Expected: PASS.

Run: `npx tsc --noEmit`
Expected: PASS.

Run: `npm test`
Expected: the complete existing suite passes.

```bash
git add src/lib/leads/legacy-mapping.ts src/lib/leads/legacy-mapping.test.ts src/lib/leads/agreement-lifecycle.ts src/lib/leads/agreement-lifecycle.test.ts scripts package.json
git commit -m "feat: add unified lead backfill and reconciliation"
```

---

### Task 14: Compatibility Boundary, Runbook, and Full Verification

**Files:**

- Create: `src/lib/leads/writer-boundary.test.ts`
- Create: `docs/LEAD_LIFECYCLE_RUNBOOK.md`
- Modify: legacy Lead/Contact routes identified by the boundary test.
- Modify: `DECISIONS.md`

**Interfaces:**

- Consumes: all previous tasks.
- Produces: a reversible, verified release candidate with no direct legacy Lead writes.

- [ ] **Step 1: Write the failing writer-boundary test**

Recursively scan every `route.ts` under `src/app/api` and fail when any receiver (`prisma`, `tx`, `db`, or an alias) calls:

```text
.contactSubmission.create/update/updateMany/upsert/delete/deleteMany
.contactNote.create/update/updateMany/upsert/delete/deleteMany
.leadEvent.create/update/updateMany/upsert/delete/deleteMany
.leadInteraction.create/update/updateMany/upsert/delete/deleteMany
.leadFollowUp.create/update/updateMany/upsert/delete/deleteMany
```

Match the model/method token sequence rather than the literal prefix `prisma`, so transaction aliases cannot bypass the test. The only allowed route-level calls are reads. Mutations must live under `src/lib/leads`.

The same test scans all non-test files under `src` and enforces these model-level boundaries:

```text
ContactSubmission: delete/deleteMany forbidden everywhere;
                   create/update/updateMany/upsert allowed only in the exact
                   canonical writers lifecycle.ts, interactions.ts,
                   follow-ups.ts, corrections.ts, and agreement-lifecycle.ts.
LeadEvent: update/updateMany/upsert/delete/deleteMany forbidden everywhere;
           create/createMany allowed only in src/lib/leads/events.ts.
LeadInteraction: update/updateMany/upsert/delete/deleteMany forbidden everywhere;
                 create/createMany allowed only in src/lib/leads/interactions.ts.
ContactNote: update/updateMany/upsert/delete/deleteMany forbidden everywhere;
             create/createMany allowed only in the addLeadNote implementation
             in src/lib/leads/interactions.ts.
LeadFollowUp: delete/deleteMany forbidden everywhere; create/update/updateMany/upsert
              allowed only in src/lib/leads/follow-ups.ts and lifecycle ownership
              helpers that reuse its transaction primitive.
Agreement: delete/deleteMany forbidden everywhere; lifecycle status mutation and
           creation allowed only in src/lib/leads/agreement-lifecycle.ts.
SellerCommission: create/update/updateMany/upsert allowed only in
                  src/lib/leads/agreement-lifecycle.ts; delete/deleteMany
                  forbidden everywhere.
```

The scanner matches model/method tokens through common Prisma client aliases, has an explicit path allow-list rather than a blanket `src/lib/leads` exemption, and fails when a new writer appears. It checks that legacy `isRead` single/bulk routes call `markLeadRead/markLeadsRead` rather than gaining a writer exemption. Backfill scripts are outside `src`, reviewed separately, and remain idempotent append-only importers. Add route assertions that Lead/note/Agreement `DELETE` and bulk-delete requests return `405`.

Add targeted lifecycle-boundary assertions for:

```text
/api/agreements, /api/seller/agreements,
/api/agreements/[id], /api/agreements/[id]/sent,
/api/agreements/sign/[token], and /api/payments/webhook.
```

Those routes may not directly create/delete an Agreement, change its lifecycle status, create a SellerCommission, or change a linked Lead stage; they must call `src/lib/leads/agreement-lifecycle.ts`. Cardcom repair/reconciliation and recurring-payment routes may continue direct technical payment-field updates, but any first-payment lifecycle effect must call the same domain service.

Also scan imports: `cancelDuplicateAgreementForMigrationInTransaction`, `linkHistoricalCommissionInTransaction`, and `classifyLegacyOrphanCommissionInTransaction` may be imported only by `scripts/resolve-unified-lead-exceptions.ts`; no file under `src/app` may import or re-export any migration-only primitive.

- [ ] **Step 2: Run and convert every remaining direct writer**

Run: `npx tsx --test src/lib/leads/writer-boundary.test.ts`
Expected before conversion: FAIL and list exact route paths.

Convert:

```text
/api/contacts/[id], /api/contacts/bulk,
/api/leads/[id], /api/leads/[id]/notes,
/api/seller/leads/[id], /api/seller/leads/[id]/notes,
/api/contacts, /api/webhooks/facebook,
/api/cron/facebook-sync, /api/integrations/facebook/sync,
/api/seller/cold-leads/[id]/interactions,
/api/seller/leads/[id]/interactions,
/api/seller/leads/[id]/follow-ups,
/api/seller/leads/[id]/contact,
/api/leads/[id]/ownership, /api/leads/[id]/source,
/api/leads/[id]/contact, and /api/leads/[id]/migration-resolution.
```

Also convert any non-route direct writer reported by the model-level scan into the exact allow-listed domain service; do not broaden the allow-list to make the test pass. Run again. Expected: PASS.

- [ ] **Step 3: Verify compatibility mirrors**

For every lifecycle write, assert in tests:

```text
ownerId equals the only legacy assignee;
no owner means assignees is empty;
stage maps through legacyStatusForStage;
legacyStateHash equals the deterministic fingerprint of the just-written
legacy mirrors and sorted assignees;
closedAt is written only with WON;
valid owner legacy CLOSED request from CONTACTING becomes QUALIFIED,
while every other base stage follows the explicit adapter rules and never WON;
feature flags switch UI only, not write invariants.
```

- [ ] **Step 4: Write the operational runbook**

Document exact gates:

```text
1. from the release branch, apply the additive prisma db push to preview
   before deploying code that writes the new columns;
2. run leads:indexes dry-run, resolve duplicate active Agreements or
   scheduled follow-ups if any through an audited leads:resolve file,
   then run APPLY=1 npm run leads:indexes on preview;
3. while the old application is still serving, run dry-run backfill, then
   APPLY=1 backfill on preview; repeat it to prove idempotency. A row is
   changed to migrationReviewRequired=false only when its intent, source,
   snapshot, stage, and ownership/eligible seller are all resolved;
4. deploy code with both UI flags false to preview;
5. immediately run APPLY=1 backfill again as a catch-up pass for rows the
   old writers created or changed during the schema/backfill/deploy window;
   compare legacyStateHash on every existing row and rederive any mismatch,
   then repeat once and run reconciliation. Canonical writers now refresh the
   hash and explicitly create resolved rows as false, so no new gap remains;
6. verify the legacy-UI seller queues still contain their expected resolved
   rows before continuing; any material count drop blocks rollout;
7. resolve every reported exception through the admin flow or the audited
   resolution-file actions, run reconciliation to zero, then
   APPLY=1 npm run leads:constraints on preview;
8. enable UNIFIED_LEAD_LIFECYCLE_ENABLED in preview, verify admin
   and incoming-seller screens, then enable COLD_LEAD_PREPARATION_ENABLED;
9. complete browser/payment smoke tests;
10. in production and only after approval: repeat the same additive schema,
    indexes, pre-cutover backfill, flags-false code deploy, immediate catch-up
    backfill, seller-queue count gate, reconciliation/hardening, and staged
    UI enablement in that order;
11. only after production hardening succeeds and every deployed database
    (preview and production) is confirmed hardened, create and verify a
    separate schema-sync commit that makes intentLevel/sourceKey/stage
    required and removes the transitional externalLeadId @unique; keep the
    additive nullable SellerCommission.agreementRef relation and deploy
    that commit before any later db push;
12. rollback UI by flags while compatibility adapters remain active;
    never roll code back to a version that does not understand the schema.
```

Include recovery for a partial backfill, duplicate webhook, missing seller assignment, live Google outage, and disabling the prospecting kill switch independently.

Update the existing “Unify the commercial lead lifecycle” entry in `DECISIONS.md` with the implemented operational decisions: composite source idempotency, append-only writer allow-list, server-only UI rollback flags with always-canonical writes, historical Meta sync suppression, manual migration-review resolution, and the two-phase index/nullability hardening. Explicitly record that the approved canonical-Lead design supersedes only the older no-storage rule for Google's public `displayName`: it is persisted as `ContactSubmission.company` so a Lead retains its business identity and outage fallback, while Google phone, address, category, opening hours, ratings, and raw payload remain live/non-persisted. Do not add a contradictory duplicate decision.

- [ ] **Step 5: Run the complete automated verification**

Run:

```bash
npx prisma format
npx prisma validate
npx prisma generate
npm test
npx tsc --noEmit
npm run lint
npm run build
git diff --check
```

Expected: all commands exit 0. If lint reports pre-existing warnings, record them separately; no new warning may originate from changed files.

- [ ] **Step 6: Run preview browser and race smoke tests**

Against an isolated preview database:

```text
publish one Prospect twice → one Lead;
ingest one Meta external ID twice → one Lead;
after hardening, ingest the same raw external ID once under meta_lead_ads
  and once under google_search_ads → two Leads keyed by source pair;
ingest an old Meta record through historical sync → original occurredAt,
  no fresh-lead notification, and no SLA flood;
ingest and exercise one OUTBOUND, one AD_RESPONSE, and one INBOUND Lead;
claim the same eligible Lead from two sessions → one owner;
seller B cannot read/mutate seller A Lead;
source/phone/site/map visible in admin and seller;
note survives reassignment;
follow-up sends once on the next one-minute cron tick;
seller bell opens the exact due Lead;
do-not-contact hides contact/follow-up actions and blocks the APIs;
two concurrent Agreement creates → one active Agreement;
sent/sign/payment transitions appear in timeline;
payment retry creates one WON and one commission;
failed first payment creates one recovery next action without a fake follow-up;
payment after LOST moves to WON and alerts admin;
resolve one migration-review Lead as admin → canonical fields become required,
  timeline records the resolution, and seller access starts only afterward;
ProspectTable phone copy/site/map/open-Lead actions work;
feature flags off return legacy UI without corrupting canonical data;
direct seller/admin unified-detail URLs redirect to legacy focus views,
  OUTBOUND claim is rejected while cold preparation is off, and every
  notification action URL resolves to an enabled screen;
desktop/narrow RTL visuals retain current Heebo shell and existing colors.
```

- [ ] **Step 7: Request code review and commit final adjustments**

Use `superpowers:requesting-code-review`. Fix every confirmed P0/P1 issue, rerun Step 5, and commit:

```bash
git add src scripts docs package.json prisma/schema.prisma vercel.json .env.example DECISIONS.md
git commit -m "feat: complete unified lead lifecycle"
```

Do not push or deploy until the user explicitly approves the verified release candidate.
