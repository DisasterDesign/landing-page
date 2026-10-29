# Agreement Archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Reversible owner-only agreement visibility cleanup with financial-history safeguards.
**Architecture:** Pure conservative evidence classifier; private policy and actor-bound preview tickets; Serializable archive writer with append-only audit; list-only filters and shared UI.
**Tech Stack:** Existing Next.js, TypeScript, Prisma/PostgreSQL, Node test runner, Zod.
**Spec:** docs/superpowers/specs/2026-10-29-agreement-archive-design.md and the user's full task.

## Global Constraints

- No production writes, migration/backfill execution, physical deletes or disabled-DELETE bypass.
- No customer exceptions or private reports in tracked source; no finance/MCP/OAuth/provider side effects.
- Persisted owner checks; preserve private/shared scopes, Roy's permissions and others' working changes.

## Review Focus

- A cancelled agreement can still be signed; protect signature evidence independently.
- A restored paid record must become visible without any financial mutation.
- Missing/expired/tampered preview or missing private policy must fail closed.
- A concurrent signature, payment, linked charge or owner revocation must win over stale preview.
- Financial and historical readers must not acquire archive filters.

### Task 1: Evidence policy, metadata and archive writer

Files: prisma/schema.prisma; additive SQL migration; src/lib/agreements/archive-{policy,config,ticket,service,store}.ts; matching tests.
Interfaces: classifyArchive(record, counts, policy); previewArchive(actor, kind, action); executeArchive(actor, action, tickets, reason). Produce safe preview rows and per-item outcomes.
- [x] Write synthetic tests for eligibility, blockers, configuration, tickets, transactions, idempotence and races; observe RED.
- [x] Implement minimal pure policy and server writer/Prisma adapter; add schema and audit model.
- [x] Run focused tests and synthetic PostgreSQL checks; observe GREEN.

### Task 2: Authorized API and visibility projections

Files: src/app/api/agreements/archive/route.ts; agreements/route.ts; quotes/route.ts; seller/agreements/route.ts; finance/access.ts; visibility tests.
Interfaces: GET preview (owner-only), POST bulk (strict action/tickets/reason), archive=active|archived|all on list routes; unchanged finance scopes.
- [x] Write failing route/visibility authorization and regression tests.
- [x] Implement route delegation and list-only visibility; redact archive operator/reason for nonowners.
- [x] Verify owner revocation, strict input, restored visibility, private/shared scope and unchanged disabled DELETE/financial readers.

### Task 3: Shared UI, runbook and full verification

Files: src/components/admin/AgreementArchiveControls.tsx; agreements/page.tsx; QuotesSection.tsx; docs/AGREEMENT_ARCHIVE_RUNBOOK.md; DECISIONS.md.
Interfaces: common URL view hook and preview/bulk controls with explicit selection, reason and per-item results.
- [x] Add tests for UI query parsing and bulk selection/outcome behavior; observe RED.
- [x] Implement RTL filters, preview signature/payment/recurring/block reasons and restore, for subscriptions and one-time quotes.
- [x] Run full tests, TypeScript, lint, production build; fresh read-only production inventory (private report only).
- [x] Obtain one independent whole-branch code review and fix material findings. Deliver branch, evidence, migration/deployment instructions and limitations; do not archive real agreements.
