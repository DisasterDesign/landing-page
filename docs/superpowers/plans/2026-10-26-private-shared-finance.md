# Private and shared finance implementation and release

Implementation is complete in an isolated worktree. User approved production deployment and actual reconciliation after reviewing the implementation.

- [x] Add immutable book snapshots, scoped financial access and owner-only book selection.
- [x] Separate forecast from paid receipts; handle duplicate provider identities, refunds and missing FX explicitly.
- [x] Add immutable expense payments, actual cost allocation and payer reimbursement.
- [x] Cover relationship routes, lead counts, notifications, product link races and paid job history.
- [x] Prepare dry-run/idempotent generic imports without legal contract fabrication.
- [x] Add owner-only supplier evidence adapters and preserve stale evidence on failure.
- [x] Verify local schema migration, unit/integration/HTTP tests and build.
- [x] Keep operational customer evidence outside the public repository and load a validated external manifest.
- [ ] Back up production and apply additive schema; deploy privacy code before importing private records.
- [ ] Review/apply classifications and manifest, then fresh historical receipt import.
- [ ] Verify production as owner and shared partner, including direct-ID denials and current-month totals.

Private source evidence stays in access-controlled local files. Release commands and limitations are documented in docs/runbooks/2026-10-26-private-shared-finance-release.md. Existing unrelated edits in the primary checkout are preserved.
