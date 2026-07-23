# Prospecting Sales Fit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace location-only prospecting with a smart small-business sales-fit gate and make Degaron's cold-lead cards reliably show public contact and business context.

**Architecture:** Keep Google Places content live and persist only Place IDs plus Fuzion-derived sales-fit and website-audit results. A hybrid territory validator and business-fit classifier fail closed before publication; per-place live-detail isolation prevents one Google failure from emptying the seller list. Versioned weekly cycles allow the poor first batch to be superseded without deleting history.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma 5/Neon Postgres, NextAuth v5, Zod 4, Google Places API (New), Anthropic structured outputs, Tailwind CSS 4, `tsx --test`.

## Global Constraints

- Public business contact details only; never infer private owner contact data.
- Never persist raw Google display name, phone, address, category, rating, review count, hours, or website URI.
- New territories use only `STREET` or open-local `COMMERCIAL_CENTER`; `AREA` is historical-only.
- Chains, franchises, malls, institutions, and large organizations fail closed.
- Publish only `INDEPENDENT_LIKELY` prospects with confidence `>= 0.80`, owner-reachability `>= 70`, public phone, and website score `0-4`.
- Publish at most 50 and never weaken thresholds to fill the batch.
- Preserve the existing kill switch, suppression, attribution, and interaction history.
- Use the current isolated branch `fix/prospecting-sales-fit`.

---

### Task 1: Persist only derived sales-fit and batch-revision state

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/lib/prospecting/types.ts`
- Test: `src/lib/prospecting/sales-fit.test.ts`
- Create: `src/lib/prospecting/sales-fit.ts`

**Interfaces:**
- Produces: `SalesFitClassification`, `SalesFitAssessment`, `isPublishableSalesFit(assessment)`.
- Produces Prisma fields used by the worker, publisher, seller API, and replacement transaction.

- [ ] **Step 1: Write the failing domain test**

```ts
test("sales fit passes only high-confidence likely-independent businesses", () => {
  assert.equal(isPublishableSalesFit({
    classification: "INDEPENDENT_LIKELY",
    confidence: 0.8,
    ownerReachabilityScore: 70,
    reason: "עסק מקומי עצמאי",
    evidence: ["LOCAL_BRAND"],
  }), true);
  assert.equal(isPublishableSalesFit({
    classification: "UNCERTAIN",
    confidence: 0.99,
    ownerReachabilityScore: 95,
    reason: "אין מספיק מידע",
    evidence: [],
  }), false);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/lib/prospecting/sales-fit.test.ts`  
Expected: FAIL because `sales-fit.ts` and its exports do not exist.

- [ ] **Step 3: Add the minimal domain implementation**

```ts
export function isPublishableSalesFit(value: SalesFitAssessment): boolean {
  return value.classification === "INDEPENDENT_LIKELY"
    && value.confidence >= 0.8
    && value.ownerReachabilityScore >= 70;
}
```

Add Prisma enum `SalesFitClassification` and nullable derived fields to
`Prospect`. Add `revision Int @default(1)`, `supersededAt DateTime?`, and
`supersededReason String?` to both cycle and batch. Replace `weekStart @unique`
with `@@unique([weekStart, revision])`.

- [ ] **Step 4: Generate Prisma and verify GREEN**

Run: `npx prisma generate`  
Run: `npm test -- src/lib/prospecting/sales-fit.test.ts`  
Expected: Prisma generation succeeds and the focused test passes.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma src/lib/prospecting/types.ts src/lib/prospecting/sales-fit.ts src/lib/prospecting/sales-fit.test.ts
git commit -m "feat: add prospect sales-fit state"
```

### Task 2: Make territory proposals target independent-business micro-markets

**Files:**
- Modify: `src/lib/prospecting/ai.ts`
- Modify: `src/lib/prospecting/ai.test.ts`
- Modify: `src/lib/prospecting/territory.ts`
- Modify: `src/lib/prospecting/territory.test.ts`
- Modify: `src/lib/prospecting/types.ts`
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `validateTerritoryProposal(proposal): { ok: true } | { ok: false; reason: string }`.
- Produces: `buildDiscoveryQueries(proposal)` from two to four approved search seeds and the fixed category taxonomy.

- [ ] **Step 1: Write failing tests for allowed and prohibited territories**

```ts
test("territory validation rejects malls and generic areas", () => {
  assert.equal(validateTerritoryProposal({
    displayName: "דיזנגוף סנטר",
    city: "תל אביב",
    kind: "COMMERCIAL_CENTER",
    searchQueries: ["עסקים בדיזנגוף סנטר"],
    rationale: "קניון גדול",
    independentBusinessRationale: "תנועה רבה",
    riskFactors: ["רשתות"],
    expectedBusinessTypes: ["חנויות"],
    confidence: 0.9,
  }).ok, false);
});

test("territory validation accepts a bounded commercial street", () => {
  assert.equal(validateTerritoryProposal(validStreetProposal).ok, true);
});
```

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/lib/prospecting/ai.test.ts src/lib/prospecting/territory.test.ts`  
Expected: FAIL because the new proposal contract and validator are absent.

- [ ] **Step 3: Implement the strict structured output contract**

Replace single `searchQuery` output with:

```ts
searchQueries: z.array(z.string().trim().min(3).max(300)).min(2).max(4),
independentBusinessRationale: z.string().trim().min(10).max(1_000),
riskFactors: z.array(z.string().trim().min(1).max(200)).max(10),
kind: z.enum(["STREET", "COMMERCIAL_CENTER"]),
```

Store `searchQueries String[]` on `TerritoryProposal`, while retaining and
populating `searchQuery` with the first query for historical compatibility.
Reject prohibited terms including mall/קניון, center, corporate campus,
institutional campus, and explicit chain-dominated rationale.

- [ ] **Step 4: Build bounded discovery queries**

```ts
export function buildDiscoveryQueries(
  searchQueries: readonly string[],
  categories = PROSPECTING_CATEGORY_QUERIES,
): string[] {
  return searchQueries.flatMap((search) =>
    categories.map((category) => `${category} ${search}`),
  );
}
```

Update discovery indexing to consume this flattened, approved list.

- [ ] **Step 5: Verify GREEN**

Run: `npm test -- src/lib/prospecting/ai.test.ts src/lib/prospecting/territory.test.ts`  
Expected: all focused tests pass.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma src/lib/prospecting/ai.ts src/lib/prospecting/ai.test.ts src/lib/prospecting/territory.ts src/lib/prospecting/territory.test.ts src/lib/prospecting/types.ts
git commit -m "feat: target independent-business territories"
```

### Task 3: Return partial, enriched live Place details

**Files:**
- Modify: `src/lib/prospecting/places.ts`
- Modify: `src/lib/prospecting/places.test.ts`
- Modify: `src/lib/prospecting/types.ts`

**Interfaces:**
- `getLiveDetails(placeIds)` still returns `Map<string, LivePlaceDetails>`.
- Missing map entry means `UNAVAILABLE`; present entry with null phone means
  `NO_PHONE`.

- [ ] **Step 1: Write a failing partial-failure test**

```ts
test("one malformed Place response does not erase other live details", async () => {
  const provider = placeProviderReturning([
    Response.json(validDetails("one")),
    Response.json({ id: 42 }),
    Response.json(validDetails("three")),
  ]);
  const result = await provider.getLiveDetails(["one", "two", "three"]);
  assert.deepEqual([...result.keys()], ["one", "three"]);
});
```

Also assert that the field mask requests `primaryTypeDisplayName`, `rating`,
`userRatingCount`, and `regularOpeningHours`.

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/lib/prospecting/places.test.ts`  
Expected: FAIL because the current parser rejects the whole method.

- [ ] **Step 3: Implement bounded concurrency and per-place isolation**

Use a worker pool of six requests. Wrap status parsing and Zod parsing inside
each place task. Add nullable live fields:

```ts
category: string | null;
rating: number | null;
reviewCount: number | null;
weekdayDescriptions: string[];
```

Return successful entries even when neighboring entries fail.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- src/lib/prospecting/places.test.ts`  
Expected: all Places tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/prospecting/places.ts src/lib/prospecting/places.test.ts src/lib/prospecting/types.ts
git commit -m "fix: isolate live Places detail failures"
```

### Task 4: Classify and reject poor sales-fit businesses

**Files:**
- Modify: `src/lib/prospecting/sales-fit.ts`
- Modify: `src/lib/prospecting/sales-fit.test.ts`
- Modify: `src/lib/prospecting/ai.ts`
- Modify: `src/lib/prospecting/ai.test.ts`
- Modify: `src/lib/prospecting/types.ts`

**Interfaces:**
- Produces: `detectHardSalesFitExclusion(details)`.
- Produces: `assessBusinessSalesFit(input, options): AiResult<SalesFitAssessment>`.

- [ ] **Step 1: Write failing deterministic exclusion tests**

Cover normalized Hebrew/English chain names, franchise signals, malls, banks,
government, hospitals, universities, factories, and logistics. Include the
counter-test that rating or review count alone never excludes an independent
business.

- [ ] **Step 2: Write failing AI contract tests**

Assert exact properties:

```ts
[
  "classification",
  "confidence",
  "ownerReachabilityScore",
  "reason",
  "evidence",
]
```

Assert the model is told that website text is untrusted, private contact
inference is forbidden, and uncertain evidence must return `UNCERTAIN`.

- [ ] **Step 3: Verify RED**

Run: `npm test -- src/lib/prospecting/sales-fit.test.ts src/lib/prospecting/ai.test.ts`  
Expected: FAIL on missing exclusion and AI assessment functions.

- [ ] **Step 4: Implement deterministic and structured AI classification**

Add a versioned denylist and prohibited-type set. Keep the AI enum closed:

```ts
"INDEPENDENT_LIKELY" | "CHAIN_OR_FRANCHISE" | "LARGE_ORGANIZATION"
| "UNSUITABLE_CATEGORY" | "UNCERTAIN"
```

Use only bounded public details plus up to 5,000 characters of untrusted
website text.

- [ ] **Step 5: Verify GREEN**

Run: `npm test -- src/lib/prospecting/sales-fit.test.ts src/lib/prospecting/ai.test.ts`  
Expected: all focused tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/prospecting/sales-fit.ts src/lib/prospecting/sales-fit.test.ts src/lib/prospecting/ai.ts src/lib/prospecting/ai.test.ts src/lib/prospecting/types.ts
git commit -m "feat: classify owner-reachable local businesses"
```

### Task 5: Gate website audits and publication on sales fit

**Files:**
- Modify: `src/lib/prospecting/worker.ts`
- Create: `src/lib/prospecting/worker-policy.ts`
- Create: `src/lib/prospecting/worker-policy.test.ts`
- Modify: `src/lib/prospecting/publisher.ts`
- Modify: `src/lib/prospecting/publisher.test.ts`

**Interfaces:**
- Produces pure `decideProspectSalesFit(...)` policy used by the worker.
- Extends `PublishableProspectCandidate` with classification, fit confidence,
  and owner-reachability score.

- [ ] **Step 1: Write failing worker-policy tests**

Assert:

- Hard-excluded chain becomes `INVALID` without PageSpeed.
- AI `UNCERTAIN` becomes terminal `FAILED_REVIEW`.
- High-confidence independent continues to website audit.
- A no-website independent remains eligible with website score 0.

- [ ] **Step 2: Write failing publication tests**

```ts
test("publication requires sales fit and orders by website then reachability", () => {
  const selected = selectPublishableProspects([
    prospect("chain", { salesFitClassification: "CHAIN_OR_FRANCHISE" }),
    prospect("reachable", { ownerReachabilityScore: 90 }),
    prospect("less-reachable", { ownerReachabilityScore: 75 }),
  ]);
  assert.deepEqual(selected.map(({ id }) => id), ["reachable", "less-reachable"]);
});
```

- [ ] **Step 3: Verify RED**

Run: `npm test -- src/lib/prospecting/worker-policy.test.ts src/lib/prospecting/publisher.test.ts`  
Expected: FAIL because the new gate is absent.

- [ ] **Step 4: Integrate the sales-fit assessment before expensive auditing**

Fetch live details, apply hard exclusions, safe-fetch active websites when
needed for evidence, call `assessBusinessSalesFit`, persist only derived
assessment fields, and continue only when `isPublishableSalesFit` returns true.
Count the additional AI request and tokens in the cycle cost guard.

- [ ] **Step 5: Update publication filtering and ordering**

Filter both gates and order by:

1. Website score ascending.
2. Owner-reachability descending.
3. Sales-fit confidence descending.
4. Website-audit confidence descending.

- [ ] **Step 6: Verify GREEN**

Run: `npm test -- src/lib/prospecting/worker-policy.test.ts src/lib/prospecting/publisher.test.ts`  
Expected: all focused tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/prospecting/worker.ts src/lib/prospecting/worker-policy.ts src/lib/prospecting/worker-policy.test.ts src/lib/prospecting/publisher.ts src/lib/prospecting/publisher.test.ts
git commit -m "feat: gate prospect publication on sales fit"
```

### Task 6: Supersede a published batch without deleting history

**Files:**
- Create: `src/lib/prospecting/replacement.ts`
- Create: `src/lib/prospecting/replacement.test.ts`
- Modify: `src/lib/prospecting/territory.ts`
- Modify: `src/lib/prospecting/publisher.ts`
- Modify: `src/app/api/prospecting/cycles/route.ts`

**Interfaces:**
- Produces:

```ts
supersedePublishedCycle(
  cycleId: string,
  reason: string,
  now?: Date,
): Promise<{ replacementCycleId: string; invalidatedProspects: number }>;
```

- [ ] **Step 1: Write the failing transaction-policy test**

Use an injectable store to prove that the operation:

- Requires a published cycle and batch.
- Marks cycle and batch superseded.
- Invalidates only untouched prospects.
- Preserves prospects with interactions.
- Creates revision `previous + 1` with the same week and seller.
- Is idempotent.

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/lib/prospecting/replacement.test.ts`  
Expected: FAIL because replacement logic does not exist.

- [ ] **Step 3: Implement the transaction and revision-aware reads**

Create the replacement cycle in one transaction. Update cycle creation and
batch publication to write revision. Admin cycle lists include historical
revisions; seller reads later select only non-superseded batches.

- [ ] **Step 4: Verify GREEN**

Run: `npm test -- src/lib/prospecting/replacement.test.ts src/lib/prospecting/territory.test.ts src/lib/prospecting/publisher.test.ts`  
Expected: all focused tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/prospecting/replacement.ts src/lib/prospecting/replacement.test.ts src/lib/prospecting/territory.ts src/lib/prospecting/publisher.ts src/app/api/prospecting/cycles/route.ts
git commit -m "feat: support safe prospect batch replacement"
```

### Task 7: Make the seller list call-ready and failure-explicit

**Files:**
- Create: `src/lib/prospecting/seller-view.ts`
- Create: `src/lib/prospecting/seller-view.test.ts`
- Modify: `src/app/api/seller/cold-leads/route.ts`
- Modify: `src/app/api/seller/cold-leads/[id]/route.ts`
- Modify: `src/components/seller/cold-lead-types.ts`
- Modify: `src/components/seller/ColdLeadCard.tsx`
- Modify: `src/app/seller/(dashboard)/cold-leads/page.tsx`

**Interfaces:**
- Produces `serializeSellerProspect(prospect, liveDetails)` with:

```ts
liveStatus: "READY" | "UNAVAILABLE" | "NO_PHONE";
website: string | null;
websiteSource: "GOOGLE" | "AUDITED_DOMAIN" | "NONE";
mapUrl: string;
```

- [ ] **Step 1: Write failing serializer tests**

Cover live success, one prospect unavailable while another succeeds, real null
phone, safe audited-domain fallback, no-site state, and superseded-batch
exclusion.

- [ ] **Step 2: Verify RED**

Run: `npm test -- src/lib/prospecting/seller-view.test.ts`  
Expected: FAIL because the serializer does not exist.

- [ ] **Step 3: Implement the pure serializer and use it in both seller APIs**

The list route requests only the active batch, merges partial live results, and
does not swallow the distinction between failure and missing phone.

- [ ] **Step 4: Implement the card UI**

Show:

- Large public call button or explicit live-data error.
- Website/no-site action.
- Google Maps action.
- Category, address, rating/reviews, and today's hours.
- Sales-fit reason and website summary.
- Google attribution for Places-sourced fields.
- Existing call angles, score detail, and history.

- [ ] **Step 5: Verify GREEN and compile the changed UI**

Run: `npm test -- src/lib/prospecting/seller-view.test.ts`  
Run: `npx eslint src/lib/prospecting/seller-view.ts src/app/api/seller/cold-leads src/components/seller/ColdLeadCard.tsx src/components/seller/cold-lead-types.ts 'src/app/seller/(dashboard)/cold-leads/page.tsx'`  
Expected: focused tests pass and ESLint reports no new errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/prospecting/seller-view.ts src/lib/prospecting/seller-view.test.ts src/app/api/seller/cold-leads src/components/seller/ColdLeadCard.tsx src/components/seller/cold-lead-types.ts 'src/app/seller/(dashboard)/cold-leads/page.tsx'
git commit -m "fix: make cold leads call-ready"
```

### Task 8: Document, verify, deploy, and replace the first batch

**Files:**
- Modify: `docs/PROSPECTING_RUNBOOK.md`
- Create or modify: `DECISIONS.md`
- Verify: all files changed in Tasks 1-7

**Interfaces:**
- Produces an operationally reversible production rollout.

- [ ] **Step 1: Update operations and decision records**

Document the dual website/sales-fit gates, Google live-data behavior,
territory exclusions, revisioned replacement, and rollback order.

- [ ] **Step 2: Run complete local verification**

Run: `npm test`  
Expected: all tests pass.

Run: `npm run lint`  
Expected: zero errors; record any unchanged pre-existing warnings.

Run: `npm run build`  
Expected: production build exits 0.

Run: `git diff --check`  
Expected: no whitespace errors.

- [ ] **Step 3: Review the complete branch diff**

Confirm no Google raw details are persisted, no private contacts are inferred,
no chain can bypass the publication gate, and no unrelated user changes were
modified.

- [ ] **Step 4: Apply the production schema safely**

Use the production Neon connection to run `npx prisma db push` before deploying
the application. Verify new nullable columns, revision defaults, and composite
unique constraints.

- [ ] **Step 5: Deploy the exact tested commit**

Push `fix/prospecting-sales-fit`, merge only after verification, then deploy the
exact merged commit to Vercel production. Verify deployment status is READY.

- [ ] **Step 6: Run bounded production smoke tests**

Verify:

- One allowed territory proposal and one deterministic mall rejection.
- Partial Place Details response behavior.
- One seller card with public phone, site, map, business context, Google
  attribution, and website findings.
- No secrets or raw Google content in application storage.

- [ ] **Step 7: Supersede Dizengoff only after smoke tests pass**

Call the reviewed replacement operation for cycle
`cmrwji6qj000113tp8ufj8ehv`, using reason
`Initial batch failed the independent-business sales-fit criteria`. Verify that
only untouched prospects become invalid, history remains intact, revision 2 is
created, and admins receive the replacement proposal.

- [ ] **Step 8: Commit documentation**

```bash
git add docs/PROSPECTING_RUNBOOK.md DECISIONS.md
git commit -m "docs: record sales-fit prospecting policy"
```

