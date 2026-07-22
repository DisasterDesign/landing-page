# Cold Lead Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a disabled-by-default weekly cold-prospecting pipeline that publishes at most 50 scored prospects to Degaron's existing seller area and promotes interested prospects into the current lead/agreement flow.

**Architecture:** Two bounded AI calls sit around a deterministic pipeline: Agent 1 proposes a territory, admins approve it, and a chunked Postgres-backed worker discovers Places IDs, safely audits websites, calculates a versioned 0–5 score, and publishes a seller batch. Google business details are fetched live; only Place IDs and Fuzion-derived audit evidence are durable.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma 5/Neon Postgres, NextAuth v5, Zod 4, Vercel Cron, Google Places API (New), PageSpeed Insights API, Anthropic Messages API, Tailwind CSS 4, `tsx --test` with Node's built-in test runner.

## Global Constraints

- Work only on branch `feat/cold-lead-pipeline` in the isolated worktree.
- Do not push, deploy, apply `prisma db push`, or connect schema changes to production.
- `PROSPECTING_ENABLED` defaults to false and every cron must no-op when disabled.
- Degaron sees only published prospects assigned to him; he never approves territories or edits scoring.
- Quality score is 0–5; scores 0–4 are eligible and score 5 is excluded.
- Publish at most 50 prospects per weekly batch.
- No automated outreach of any kind; only a human seller calls.
- Never scrape Google Maps HTML; only store Google Place IDs durably.
- Never persist raw Google responses, website HTML, or screenshots.
- All arbitrary website fetches must pass SSRF protection before every request and redirect.
- Follow TDD for pure domain logic and provider parsers.

---

### Task 1: Test harness, configuration, and Prisma domain

**Files:**

- Modify: `package.json`
- Modify: `.env.example`
- Modify: `prisma/schema.prisma`
- Create: `src/lib/prospecting/config.ts`
- Create: `src/lib/prospecting/types.ts`
- Create: `src/lib/prospecting/config.test.ts`
- Modify: `src/lib/validations.ts`

**Interfaces:**

- Produces: `getProspectingConfig(): ProspectingConfig`
- Produces: `isProspectingEnabled(): boolean`
- Produces Prisma models and enums named in the approved design.

- [ ] **Step 1: Add the test script and write a failing configuration test**

Add to `package.json` scripts:

```json
"test": "tsx --test 'src/**/*.test.ts'"
```

Create `src/lib/prospecting/config.test.ts`:

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { getProspectingConfig } from "./config";

test("prospecting is disabled unless explicitly true", () => {
  const config = getProspectingConfig({});
  assert.equal(config.enabled, false);
  assert.equal(config.weeklyTarget, 50);
  assert.equal(config.maxDiscoveredPerCycle, 250);
});

test("invalid numeric limits fall back to safe defaults", () => {
  const config = getProspectingConfig({
    PROSPECTING_MAX_DISCOVERED_PER_CYCLE: "-1",
    PROSPECTING_MAX_ESTIMATED_COST_USD: "not-a-number",
  });
  assert.equal(config.maxDiscoveredPerCycle, 250);
  assert.equal(config.maxEstimatedCostUsd, 25);
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm test -- --test-name-pattern="prospecting"`  
Expected: FAIL because `./config` does not exist.

- [ ] **Step 3: Implement typed configuration**

Create `src/lib/prospecting/config.ts` with an injectable environment parameter and safe integer/float parsers. Required shape:

```ts
export interface ProspectingConfig {
  enabled: boolean;
  weeklyTarget: number;
  maxDiscoveredPerCycle: number;
  maxPlacesCallsPerCycle: number;
  maxAiCallsPerCycle: number;
  maxEstimatedCostUsd: number;
  placesApiKey: string;
  pageSpeedApiKey: string;
  aiApiKey: string;
  aiModel: string;
  hashSecret: string;
}

export function getProspectingConfig(
  env: Record<string, string | undefined> = process.env
): ProspectingConfig;

export function isProspectingEnabled(): boolean;
```

Clamp `weeklyTarget` to 50 and throw descriptive errors for missing credentials only when `enabled === true`.

- [ ] **Step 4: Extend Prisma schema additively**

Add the approved enums and models from the design. Extend:

```prisma
enum NotificationType {
  // existing values
  PROSPECTING_APPROVAL
  PROSPECTING_BATCH_READY
}

model Notification {
  // existing fields
  actionUrl String?
}

model ContactSubmission {
  email              String?
  acquisitionChannel AcquisitionChannel?
  prospect            Prospect?   @relation("PromotedProspect")
  agreements          Agreement[]
}

model Agreement {
  leadId String?
  lead   ContactSubmission? @relation(fields: [leadId], references: [id], onDelete: SetNull)
  @@index([leadId])
}
```

Add corresponding `User` relations with explicit names. Do not run `db push`.

- [ ] **Step 5: Add validation schemas**

Add Zod schemas for territory approval/rejection, prospect interaction, promotion, and prospecting settings. Extend `createAgreementSchema` with `leadId: z.string().optional()`.

- [ ] **Step 6: Document environment variables**

Append the exact variables from design section 17 to `.env.example`, all blank except `PROSPECTING_ENABLED=false` and numeric defaults.

- [ ] **Step 7: Validate and run tests**

Run: `npx prisma format`  
Expected: schema formatted.

Run: `npx prisma validate`  
Expected: `The schema at prisma/schema.prisma is valid` without requiring a production connection.

Run: `npm test`  
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add package.json .env.example prisma/schema.prisma src/lib/prospecting/config.ts src/lib/prospecting/types.ts src/lib/prospecting/config.test.ts src/lib/validations.ts
git commit -m "feat: add prospecting domain foundation"
```

---

### Task 2: Versioned scoring engine and website classification

**Files:**

- Create: `src/lib/prospecting/score.ts`
- Create: `src/lib/prospecting/score.test.ts`
- Create: `src/lib/prospecting/classify-website.ts`
- Create: `src/lib/prospecting/classify-website.test.ts`

**Interfaces:**

- Consumes: `WebsiteStatus` and audit evidence types from Task 1.
- Produces: `calculateWebsiteScore(input): WebsiteScoreResult`
- Produces: `classifyWebsiteUrl(url): "SOCIAL_ONLY" | "ACTIVE" | "UNKNOWN"`
- Produces: `looksParked(input): boolean`

- [ ] **Step 1: Write failing score boundary tests**

Cover raw boundaries 19/20, 39/40, 54/55, 69/70, and 84/85. Also assert:

```ts
assert.deepEqual(
  calculateWebsiteScore({ websiteStatus: "NO_WEBSITE" }),
  expectScore(0, 0)
);
assert.throws(() => calculateWebsiteScore({ websiteStatus: "BLOCKED" }));
```

Use valid dimension fixtures whose sum equals the requested raw score.

- [ ] **Step 2: Verify tests fail**

Run: `npm test -- --test-name-pattern="score"`  
Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the only scoring function**

`calculateWebsiteScore` must:

- Apply hard overrides for no website, social-only, parked, and confirmed unreachable.
- Refuse `BLOCKED` and `UNKNOWN`.
- Validate dimension ranges: 20/20/20/15/15/10.
- Sum to raw 0–100.
- Map to 0–5 with approved boundaries.
- Return `scoringVersion: 1`.
- Return a frozen score breakdown to prevent mutation after persistence.

- [ ] **Step 4: Write failing classification tests**

Test Facebook, Instagram, TikTok, Linktree, WhatsApp, Waze, `http://example.com`, malformed URLs, registrar phrases, and normal Hebrew business HTML.

- [ ] **Step 5: Implement deterministic classification**

Normalize hosts, strip `www.`, use an explicit social/directory host set, and detect parked pages using title/body phrases without relying on copyright year alone.

- [ ] **Step 6: Run tests and commit**

Run: `npm test`  
Expected: PASS.

```bash
git add src/lib/prospecting/score.ts src/lib/prospecting/score.test.ts src/lib/prospecting/classify-website.ts src/lib/prospecting/classify-website.test.ts
git commit -m "feat: add explainable website scoring"
```

---

### Task 3: SSRF-safe fetcher and deterministic technical audit

**Files:**

- Create: `src/lib/prospecting/network-safety.ts`
- Create: `src/lib/prospecting/network-safety.test.ts`
- Create: `src/lib/prospecting/safe-fetch.ts`
- Create: `src/lib/prospecting/technical-audit.ts`
- Create: `src/lib/prospecting/technical-audit.test.ts`
- Create: `src/lib/prospecting/commerce-audit.ts`

**Interfaces:**

- Produces: `isPublicIp(address: string): boolean`
- Produces: `safeFetchHtml(url, options): Promise<SafeHtmlResult>`
- Produces: `auditHtml(input): DeterministicAuditEvidence`

- [ ] **Step 1: Write network safety tests first**

Reject `127.0.0.1`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `0.0.0.0`, `::1`, `fc00::/7`, `fe80::/10`, IPv4-mapped private IPv6, and metadata hosts. Accept public Google and Cloudflare sample IPs.

- [ ] **Step 2: Implement IP and redirect guards**

Use `node:dns/promises` lookup with `{ all: true }`. Validate every resolved address before fetch and repeat validation for each redirect location. Export dependency injection points for DNS and fetch so tests never access the network.

- [ ] **Step 3: Implement bounded fetch**

Rules in code constants:

```ts
const CONNECT_TIMEOUT_MS = 5_000;
const TOTAL_TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 5;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const MAX_ANALYSIS_CHARS = 100_000;
```

Abort oversized streams, accept only HTML for crawl analysis, and return typed failure codes rather than throwing generic errors.

- [ ] **Step 4: Write technical audit fixtures**

Fixtures must cover indexable/non-indexable, missing title/meta/H1/canonical, valid JSON-LD Product, cart and checkout links, broken image/link lists, viewport, and an explicit stale date.

- [ ] **Step 5: Implement technical and commerce evidence**

Use bounded parsing helpers. Do not add a browser dependency. The result contains facts and counts only; no final score calculation occurs outside `score.ts`.

- [ ] **Step 6: Run tests and commit**

Run: `npm test`  
Expected: PASS.

```bash
git add src/lib/prospecting/network-safety.ts src/lib/prospecting/network-safety.test.ts src/lib/prospecting/safe-fetch.ts src/lib/prospecting/technical-audit.ts src/lib/prospecting/technical-audit.test.ts src/lib/prospecting/commerce-audit.ts
git commit -m "feat: add safe deterministic website audit"
```

---

### Task 4: External provider adapters with strict parsers

**Files:**

- Create: `src/lib/prospecting/places.ts`
- Create: `src/lib/prospecting/places.test.ts`
- Create: `src/lib/prospecting/pagespeed.ts`
- Create: `src/lib/prospecting/pagespeed.test.ts`
- Create: `src/lib/prospecting/ai.ts`
- Create: `src/lib/prospecting/ai.test.ts`
- Create: `src/lib/prospecting/__fixtures__/places-search.json`
- Create: `src/lib/prospecting/__fixtures__/pagespeed.json`

**Interfaces:**

- Implements: `PlacesProspectingProvider`
- Produces: `runPageSpeed(url): PageSpeedAudit`
- Produces: `proposeTerritory(input): TerritoryProposalOutput`
- Produces: `assessWebsiteVisuals(input): VisualAssessment`

- [ ] **Step 1: Write Places parser tests**

Test page-token pagination, dedupe by `placeId`, 60-result query cap, global configured cap, field-mask header, and no persistence-facing raw response type.

- [ ] **Step 2: Implement Places provider**

Use `https://places.googleapis.com/v1/places:searchText` for discovery with IDs-only field mask. Use live Place Details for website audit and seller display. Build category queries from a fixed taxonomy. Stop before any configured per-cycle limit.

- [ ] **Step 3: Write and implement PageSpeed parser**

Parse performance category score, LCP, CLS, TBT, SEO audits, best-practice evidence, and the `final-screenshot` data URL. Treat absent CrUX metrics as normal.

- [ ] **Step 4: Write AI response tests**

Test valid JSON, Markdown-fenced JSON, malformed fields, out-of-range visual score, missing exactly-three call angles, and website prompt-injection text.

- [ ] **Step 5: Implement two bounded AI calls**

Call the Anthropic Messages API through injected `fetch`. Both calls have no tools. Parse the first text block as JSON and validate through Zod. Store token usage returned by the API. Never log API keys, screenshots, or raw site text.

- [ ] **Step 6: Run tests and commit**

Run: `npm test`  
Expected: PASS with no external requests.

```bash
git add src/lib/prospecting/places.ts src/lib/prospecting/places.test.ts src/lib/prospecting/pagespeed.ts src/lib/prospecting/pagespeed.test.ts src/lib/prospecting/ai.ts src/lib/prospecting/ai.test.ts src/lib/prospecting/__fixtures__
git commit -m "feat: add prospecting provider adapters"
```

---

### Task 5: Weekly cycle, worker, cost guard, and publication

**Files:**

- Create: `src/lib/prospecting/territory.ts`
- Create: `src/lib/prospecting/territory.test.ts`
- Create: `src/lib/prospecting/worker.ts`
- Create: `src/lib/prospecting/publisher.ts`
- Create: `src/lib/prospecting/publisher.test.ts`
- Create: `src/lib/prospecting/suppression.ts`
- Create: `src/lib/prospecting/suppression.test.ts`
- Modify: `src/lib/notifications.ts`

**Interfaces:**

- Produces: `createWeeklyProposal(now): Promise<CycleResult>`
- Produces: `processNextProspectingWork(): Promise<WorkerResult>`
- Produces: `selectPublishableProspects(input): SelectedProspect[]`
- Produces: `hashSuppressionValue(value, secret): string`

- [ ] **Step 1: Test coverage-key normalization and repeat rejection**

Normalize Hebrew/English whitespace, punctuation, street abbreviations, city casing, and territory kind into a stable SHA-256 coverage key.

- [ ] **Step 2: Test publication policy**

Assert score 5 exclusion, 50 maximum, score/confidence ordering, do-not-call exclusion, existing-client domain exclusion, missing-phone backfill, and overflow preservation.

- [ ] **Step 3: Implement cycle and atomic lock transitions**

Use `updateMany` with status and stale-lock predicates. Each worker invocation claims one bounded unit. Never hold a database transaction across an external network call.

- [ ] **Step 4: Implement audit orchestration**

For one prospect: fetch live Places website data, classify, safe-fetch, PageSpeed, deterministic evidence, Agent 2, score, immutable audit row, and denormalized current prospect fields. Persist only derived evidence.

- [ ] **Step 5: Implement publisher transaction**

Create `WeeklyProspectBatch`, connect the selected prospects, mark them `PUBLISHED`, assign the configured seller, and mark the cycle `PUBLISHED` in one Prisma transaction. Notify the seller only after commit.

- [ ] **Step 6: Persist notification URLs**

Modify `CreateNotificationInput` so `url` is stored in `Notification.actionUrl` and used by push. Existing callers remain compatible.

- [ ] **Step 7: Run tests and commit**

Run: `npm test`  
Expected: PASS.

```bash
git add src/lib/prospecting/territory.ts src/lib/prospecting/territory.test.ts src/lib/prospecting/worker.ts src/lib/prospecting/publisher.ts src/lib/prospecting/publisher.test.ts src/lib/prospecting/suppression.ts src/lib/prospecting/suppression.test.ts src/lib/notifications.ts
git commit -m "feat: orchestrate weekly prospecting cycles"
```

---

### Task 6: Cron entry points and admin APIs

**Files:**

- Create: `src/app/api/cron/prospecting-propose/route.ts`
- Create: `src/app/api/cron/prospecting-worker/route.ts`
- Create: `src/app/api/cron/prospecting-maintenance/route.ts`
- Modify: `vercel.json`
- Create: `src/app/api/prospecting/cycles/route.ts`
- Create: `src/app/api/prospecting/cycles/[id]/route.ts`
- Create: `src/app/api/prospecting/cycles/[id]/retry/route.ts`
- Create: `src/app/api/prospecting/cycles/[id]/cancel/route.ts`
- Create: `src/app/api/prospecting/proposals/[id]/approve/route.ts`
- Create: `src/app/api/prospecting/proposals/[id]/reject/route.ts`
- Create: `src/app/api/prospecting/settings/route.ts`

**Interfaces:**

- Cron handlers always return `{ enabled, action, ... }` JSON.
- Admin routes rely on the existing admin-only middleware blanket and recheck session role in handlers that mutate state.

- [ ] **Step 1: Implement disabled no-op cron tests through extracted handlers**

Extract route-independent functions and assert no Prisma/provider call is made when disabled.

- [ ] **Step 2: Implement cron routes**

Each verifies `isCronAuthorized`, exports explicit `maxDuration`, and delegates to one domain function. Add Sunday proposal, ten-minute worker, and daily maintenance schedules to `vercel.json`.

- [ ] **Step 3: Implement approve/reject atomically**

Approval must update only `PROPOSED`; rejection stores a bounded reason and queues another Agent 1 proposal. Duplicate actions return 409.

- [ ] **Step 4: Implement settings through KeyValue**

Use keys:

```text
prospecting:defaultSellerId
prospecting:adminKillSwitch
```

Validate that the selected user has role `SELLER`.

- [ ] **Step 5: Run tests, lint affected files, and commit**

Run: `npm test`  
Run: `npx eslint src/app/api/cron/prospecting-* src/app/api/prospecting src/lib/prospecting`  
Expected: PASS/0 errors.

```bash
git add src/app/api/cron/prospecting-* src/app/api/prospecting vercel.json
git commit -m "feat: expose prospecting worker and admin APIs"
```

---

### Task 7: Admin approval and monitoring page

**Files:**

- Create: `src/app/admin/(dashboard)/prospecting/page.tsx`
- Create: `src/components/admin/prospecting/ProposalCard.tsx`
- Create: `src/components/admin/prospecting/CycleProgress.tsx`
- Create: `src/components/admin/prospecting/ProspectTable.tsx`
- Modify: `src/components/admin/AdminSidebar.tsx`
- Modify: `src/components/admin/NotificationBell.tsx`

**Interfaces:**

- Consumes admin APIs from Task 6.
- Notification bell opens persisted `actionUrl` when present.

- [ ] **Step 1: Add the admin navigation item**

Insert “פרוספקטינג” adjacent to “לידים ופניות”, linking to `/admin/prospecting`.

- [ ] **Step 2: Implement proposal approval UI**

Show territory name, kind, city, rationale, confidence, and approve/reject buttons. Rejection opens one bounded reason field. Disable actions while a request is in flight.

- [ ] **Step 3: Implement cycle monitoring**

Show status, stage counts, score distribution, published count, provider call counts, estimated cost, last error, retry, and cancel.

- [ ] **Step 4: Implement full admin prospect table**

Admins can inspect all scores including 5 and failed review. Live place details load server-side through the admin API and are never embedded in static HTML.

- [ ] **Step 5: Update notification navigation**

Prefer `notification.actionUrl`, retain current type-based fallbacks.

- [ ] **Step 6: Run lint/build and commit**

Run: `npm run lint`  
Run: `npm run build`  
Expected: 0 errors; pre-existing warnings may remain.

```bash
git add 'src/app/admin/(dashboard)/prospecting' src/components/admin/prospecting src/components/admin/AdminSidebar.tsx src/components/admin/NotificationBell.tsx
git commit -m "feat: add prospecting admin control center"
```

---

### Task 8: Seller cold-lead API and weekly call page

**Files:**

- Create: `src/app/api/seller/cold-leads/route.ts`
- Create: `src/app/api/seller/cold-leads/[id]/route.ts`
- Create: `src/app/api/seller/cold-leads/[id]/interactions/route.ts`
- Create: `src/app/seller/(dashboard)/cold-leads/page.tsx`
- Create: `src/components/seller/ColdLeadCard.tsx`
- Create: `src/components/seller/QualityScoreBadge.tsx`
- Create: `src/components/seller/CallOutcomeSheet.tsx`
- Modify: `src/components/seller/SellerSidebar.tsx`

**Interfaces:**

- Seller list returns only assigned current-batch prospects and assigned due follow-ups.
- All business display details are live provider data merged into derived prospect data at request time.

- [ ] **Step 1: Implement ownership-first seller queries**

Every query begins with `assignedSellerId: session.user.id`. Admin inspection is explicit and separate; never fetch then filter in memory.

- [ ] **Step 2: Implement current batch and follow-up response**

Return batch label, territory, progress, up to 50 prospects, six score components, call angles, and interaction history. Exclude score 5 even if bad data links it to a batch.

- [ ] **Step 3: Implement interaction transaction**

Record outcome and note, update `lastContactedAt`, set status/`nextFollowUpAt`, and create suppression rows atomically for `DO_NOT_CALL`.

- [ ] **Step 4: Add seller navigation and page**

Add “לידים קרים” next to existing leads. Render current/follow-up tabs, `x/50` progress, score badge, click-to-call phone, website link, three call angles, and outcome sheet. No territory or scoring controls appear.

- [ ] **Step 5: Run lint/build and commit**

Run: `npm run lint`  
Run: `npm run build`  
Expected: 0 errors.

```bash
git add src/app/api/seller/cold-leads 'src/app/seller/(dashboard)/cold-leads' src/components/seller/ColdLeadCard.tsx src/components/seller/QualityScoreBadge.tsx src/components/seller/CallOutcomeSheet.tsx src/components/seller/SellerSidebar.tsx
git commit -m "feat: add seller weekly cold lead list"
```

---

### Task 9: Prospect promotion and agreement attribution

**Files:**

- Create: `src/lib/prospecting/promotion.ts`
- Create: `src/lib/prospecting/promotion.test.ts`
- Create: `src/app/api/seller/cold-leads/[id]/promote/route.ts`
- Modify: `src/app/seller/(dashboard)/agreements/new/page.tsx`
- Modify: `src/app/api/seller/agreements/route.ts`

**Interfaces:**

- Produces: `promoteProspect(input): Promise<{ leadId: string; created: boolean }>`
- Seller agreement POST accepts verified optional `leadId`.

- [ ] **Step 1: Write promotion idempotency tests**

Assert the same prospect returns the same lead; `externalLeadId` is `gplaces:<placeId>`; email may be null; seller is connected; interactions become notes; acquisition channel is `GOOGLE_PROSPECTING`.

- [ ] **Step 2: Implement promotion transaction**

Require `INTERESTED`, ownership, and live details. Use unique `externalLeadId` to survive retries. Never invent a placeholder email.

- [ ] **Step 3: Carry lead attribution into agreement creation**

Read `lead` from agreement-page query params, send it as `leadId`, verify assignment in the API route, and persist `Agreement.leadId`.

- [ ] **Step 4: Add promote action to seller UI**

After interested outcome, show “העבר ללידים החמים”. On success redirect to `/seller/leads?focus=<id>`.

- [ ] **Step 5: Run tests/build and commit**

Run: `npm test`  
Run: `npm run build`  
Expected: PASS.

```bash
git add src/lib/prospecting/promotion.ts src/lib/prospecting/promotion.test.ts 'src/app/api/seller/cold-leads/[id]/promote' 'src/app/seller/(dashboard)/agreements/new/page.tsx' src/app/api/seller/agreements/route.ts src/components/seller/ColdLeadCard.tsx
git commit -m "feat: promote cold prospects into sales flow"
```

---

### Task 10: Decision log, operational runbook, and final verification

**Files:**

- Create: `DECISIONS.md`
- Create: `docs/PROSPECTING_RUNBOOK.md`
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-07-22-cold-lead-pipeline-design.md` only if implementation revealed a factual mismatch.

**Interfaces:**

- Documents setup, dry run, enable/disable, retries, quotas, and removal.

- [ ] **Step 1: Record the architectural decision**

Document the hybrid architecture, separate Prospect model, Place-ID-only durable Google storage, 0–5 scoring, 50 cap, human-only outreach, and kill switch.

- [ ] **Step 2: Write the runbook**

Include exact environment variables, separate GCP project/key instructions, provider quotas, default seller configuration, preview validation, first-cycle checklist, disable command, and data removal process. Explicitly state that no production migration has been applied.

- [ ] **Step 3: Run complete verification**

Run: `npx prisma format`  
Run: `npx prisma validate`  
Run: `npm test`  
Run: `npm run lint`  
Run: `npm run build`  
Run: `git diff --check`  
Run: `git status --short --branch`  

Expected:

- Prisma valid.
- All tests pass.
- Lint has zero errors; existing unrelated warnings may remain.
- Production build succeeds.
- No whitespace errors.
- Only intentional branch changes exist.

- [ ] **Step 4: Verify isolation**

Run: `git log --oneline main..HEAD`  
Expected: only cold-lead feature commits.

Run: `git status --short --branch` in the original checkout.  
Expected: `main...origin/main` and no changes.

- [ ] **Step 5: Commit documentation**

```bash
git add DECISIONS.md docs/PROSPECTING_RUNBOOK.md README.md docs/superpowers/specs/2026-07-22-cold-lead-pipeline-design.md
git commit -m "docs: add prospecting operations runbook"
```

## Execution note

Execute inline in this session with `superpowers:executing-plans`; multi-agent execution is intentionally not used. Stop only for a genuine safety blocker. Do not push or deploy.
