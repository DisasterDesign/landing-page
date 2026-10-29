# Product original-currency correction plan

**Goal:** Record an owner-approved monthly price in its original currency without inventing an ILS valuation or altering payment history.

**Architecture:** Keep `monthlyAmount` as nullable ILS valuation for existing reports. Add original amount/currency and a versioned, append-only price revision history. Foreign prices remain unvalued in ILS; no expense FX constant or historical receipt rate is reused.

**Constraints:** Local preparation only. No provider calls, data backfill, production migration, deployment or private customer information in this branch. Existing ownership, VAT, status, dates, agreements and receipts remain intact.

## Task 1: Audited correction

- [x] Add failing tests for original currency, strict amount validation, ownership, conflict handling and exact undo snapshots.
- [x] Add nullable original amount/currency, price version, and restrictive revision relations in an additive migration.
- [x] Implement owner-only correction/restore through the existing product PATCH route; revision and client rollup commit atomically.
- [x] Guard older ILS editors and payment callbacks against overwriting a corrected price.

## Task 2: Honest display and verification

- [x] Display original currency and missing ILS valuation in the existing Clients table, with correction/history controls for the owner.
- [x] Expose original price in the supported read-only MCP client report. Keep unvalued foreign products excluded from ILS totals with warnings.
- [x] Verify synthetic correction/restore, cash immutability, stale version rejection and private/shared isolation with a disposable local database; run full unit suite, typecheck and focused lint.

## Review focus

Concurrent legacy editor writes; callbacks arriving after correction; owner role revoked between reads; undo after a later correction; mixed client scopes and partial ILS totals.

## Execution decisions

Existing instructions authorize preparing and testing this local fix. No release is included. The existing audit primitive is fire-and-forget and assumes an absent AuditLog model; the existing restrictive AgreementArchiveEvent pattern is the safer local precedent for financial correction history.

Independent review found two important compatibility issues and two display issues. Regression tests reproduced and fixed finite legacy precision, cumulative cash fallback and scoped unknown totals. Empty product status now displays the inactive warning. No findings are deferred. Synthetic UI verification exercised correction and exact undo through the authenticated app, including persisted history and missing-FX labels.
