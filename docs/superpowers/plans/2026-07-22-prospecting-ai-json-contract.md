# Prospecting AI JSON Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make weekly territory proposals and visual audits reliably match their strict production schemas.

**Architecture:** Preserve the Zod boundaries and change only the two Anthropic system instructions. Verify each exact outbound prompt through the existing injected `fetchImpl` seam.

**Tech Stack:** TypeScript, Node test runner, Zod, Anthropic Messages API

## Global Constraints

- Do not relax, coerce, or guess the response schema.
- Do not add retries or extra provider calls.
- Keep the production model and all scoring behavior unchanged.

---

### Task 1: Enforce the territory response contract

**Files:**
- Modify: `src/lib/prospecting/ai.test.ts`
- Modify: `src/lib/prospecting/ai.ts`
- Verify: `docs/superpowers/specs/2026-07-22-prospecting-ai-json-contract-design.md`

**Interfaces:**
- Consumes: `proposeTerritory(input, { apiKey, model, fetchImpl })`
- Produces: an Anthropic request whose system prompt explicitly defines every property accepted by `parseTerritoryProposal`

- [x] **Step 1: Write the failing regression test**

Call `proposeTerritory` with an injected `fetchImpl`, return a valid proposal, capture the request body, and assert that the system prompt includes all seven property names and every allowed `kind` value.

- [x] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/lib/prospecting/ai.test.ts`

Expected: FAIL because the current system prompt omits the response contract.

- [x] **Step 3: Implement the minimal prompt contract**

Replace the generic territory system instruction with one explicit JSON-object contract matching `territorySchema`. Keep the request shape, parser, token limit, and call count unchanged.

- [x] **Step 4: Verify GREEN and regression safety**

Run the focused AI test, the complete test suite, lint, and production build. All must pass before commit.

- [ ] **Step 5: Commit and deploy the hotfix**

Commit only the two code files and the two contract documents. Merge the tested branch to `main`, push, redeploy Production, and rerun the weekly proposal once.

### Task 2: Enforce the visual response contract

**Files:**
- Modify: `src/lib/prospecting/ai.test.ts`
- Modify: `src/lib/prospecting/ai.ts`
- Modify: `docs/superpowers/specs/2026-07-22-prospecting-ai-json-contract-design.md`

**Interfaces:**
- Consumes: `assessWebsiteVisuals(input, { apiKey, model, fetchImpl })`
- Produces: an Anthropic request whose system prompt explicitly defines every property and enum accepted by `parseVisualAssessment`

- [x] **Step 1: Write and run the failing visual-contract regression test**

- [x] **Step 2: Add the minimal visual prompt contract without changing parsing or retries**

- [x] **Step 3: Run the focused test and verify it passes**
