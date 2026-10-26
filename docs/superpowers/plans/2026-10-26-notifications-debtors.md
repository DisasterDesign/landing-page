# Notifications and recoverable debtor hiding implementation plan

> **For agentic workers:** Use superpowers:subagent-driven-development or executing-plans. Track each task and verify before release.

**Goal:** Stop routine payment success noise, make accidental debtor hiding recoverable, and refresh the live report.
**Architecture:** Keep existing notification storage and debtor snapshot/dismissal keys; add a separate scheduled-alert baseline KeyValue without a schema migration. Reuse persisted owner/finance permissions. Suppress old payment success rows at query time rather than deleting them.
**Tech Stack:** Existing Next.js, TypeScript, Prisma/Postgres, Auth.js, Cardcom.
**Spec:** User request in this conversation: no notification per received payment, repair accidental eye-button hiding, refresh debtor report. MCP is feasibility only; Dots is confirmed to run inside Codex/Work. No server or credentials are created in this change.

## Global constraints
- Preserve PRIVATE/SHARED visibility. Terminal-wide debtor information remains owner-only.
- No Cardcom charges, recurring-order changes, passwords, user roles, or deletion of historical notification/dismissal records.
- Public repository: synthetic test data only; production evidence stays outside the repository.
- Preserve payment records, commission accounting, signature events, and actionable failure/mismatch alerts.

## Review focus
- A payment mismatch must survive suppression of routine payment successes.
- List and unread count must apply identical suppression and existing permission scopes.
- Failed hide/restore must not remove a debtor from the UI.
- Restore of an already paid hidden debtor must enter the settled list.
- Hidden debts must not be presented as all debts paid, and manual refresh must not send unsolicited alerts.

### Task 1: Quiet successful payments
**Ownership:** src/app/api/payments/webhook/route.ts; src/lib/email.ts if sole success-mail helper; src/lib/leads/agreement-lifecycle.ts; src/app/api/notifications/route.ts; focused notification/payment policy tests and new helper if needed.
**Interfaces:** Existing notifyFinanceAdmins/notification persistence remain available for actionable alerts. No overlap with debtor files.
- [x] Add failing behavioral tests for first-payment/commission success suppression while preserving accounting and mismatch events; verify red.
- [x] Remove routine success emit/email paths, including ordinary commission-created success message while retaining commission records.
- [x] Exclude precise historical success title prefixes (AGREEMENT_SIGNED only) from BOTH notification list and unread count with existing finance scopes composed via AND. Preserve raw rows and mismatch alerts.
- [x] Verify focused tests, TypeScript, lint and full test suite; return files/evidence, no commit.

### Task 2: Recoverable debtor hiding and private-safe refresh
**Ownership:** src/app/admin/(dashboard)/finance/debtors/page.tsx; src/app/api/finance/debtors/dismiss/route.ts; src/app/api/finance/debtors/refresh/route.ts; src/lib/cardcom-debtors.ts; focused new tests/helper as needed.
**Interfaces:** Manual refresh calls sweepTerminalFailures with notifications disabled; scheduled scan retains actionable owner-only alerts.
- [x] Add failing tests for explicit dismiss boolean/key validation, hide/restore state, failed requests, settled restoration and quiet refresh.
- [x] Replace icon-only hide with explicit text plus confirmation; offer immediate Undo for at least 8 seconds and prominent hidden list/count/restore. Persist first, then update state; guard concurrent duplicate actions by stable key.
- [x] Validate dismiss requests against current snapshot/dismissed keys and require explicit boolean. Keep owner-only authorization.
- [x] Add optional {notify?:boolean} sweep option (default true); manual refresh uses false. Terminal-wide debt alerts target notifyOwner only because the complete snapshot has no proven per-row finance book.
- [x] Final-review P2: keep report refresh and scheduled-alert acknowledgment in separate KeyValue states. Create-only initialize the alert baseline from the pre-refresh report; quiet scans never advance existing alert history. Verify quiet→scheduled new/growth alerts once, repeat suppression and quiet/scheduled initialization overlap.
- [x] Verify focused tests, TypeScript, lint and full suite; return files/evidence, no commit.

### Release and live verification (root)
- [x] Review both task diffs and whole branch; record decisions without private data. Final P2 resolved and scoped re-review clean.
- [ ] Publish through tested PR after preserving unrelated main-checkout edits.
- [ ] Verify live notification list/unread counts and debtor hidden/restore UI using existing owner login.
- [ ] Refresh debtor report through dedicated quiet refresh endpoint; preserve all existing dismissals unless user explicitly selects restore.
- [x] Research MCP feasibility for Codex/Work with official documentation; first phase should use authenticated read-only tools and the existing finance permissions. No server or credentials created.
