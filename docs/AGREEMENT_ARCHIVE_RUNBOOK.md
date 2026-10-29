# Reversible agreement archive

Archive changes list visibility only. It is not cancellation, debt settlement, deletion, refund, or a way to stop recurring billing. Existing DELETE remains disabled. Archive does not change legal/signature/payment statuses, client/product records, amounts, receipts, commission history, files, lead statistics or provider state.

## Deployment (not executed during development)

1. Review and back up schema using the established deployment procedure. Apply only `prisma/migrations/20261029120000_agreement_archive/migration.sql` through the normal reviewed migration workflow. It adds metadata and an audit table; it has no business-data UPDATE/DELETE/backfill.
2. Generate Prisma and deploy the application that understands the additive schema. Do not run a generic schema-push command against production.
3. Configure server-only private values in the existing secure deployment configuration, never NEXT_PUBLIC or a tracked file:
   - `AGREEMENT_ARCHIVE_ENABLED=true`
   - `AGREEMENT_ARCHIVE_PROTECTED_IDS`: nonempty comma-separated exact IDs supplied privately by the owner; retain the task's protected exception regardless of its status.
   - `AGREEMENT_ARCHIVE_BEFORE`: explicit ISO timestamp with offset identifying the age cutoff.
   - `AGREEMENT_ARCHIVE_PREVIEW_SECRET`: random secret of at least 32 characters, server only.
4. Missing/invalid configuration blocks archive. Restore still requires the owner and a signed fresh preview, but not an enabled archive policy. Changing the private policy invalidates old previews. Do not include IDs, names, credentials or customer reports in public commits/PRs.

## Read-only dry run before migration or cleanup

`scripts/agreement-archive-dry-run.ts --output /absolute/private/path.json` reads the existing database credentials from the process, discovers the unique persisted owner, and runs read-only transactions. It detects the pre-archive schema so a migration is not needed just to inspect dependencies. It never calls Cardcom, signs a contract, sends messages or writes business data. Reports are created with mode 0600 and exclusive creation outside the checkout; existing reports are never overwritten. Use the approved Node/tsx runner and existing secure environment loading. Do not paste environment values into a command or publish the report.

The report includes all visible Agreement kinds, full historical counts of charges, receipt-ledger links, both legacy/current commission links and client products (including archived products). The private age/protection policy applies. No historical candidate count is baked into the code. In pre-migration mode all archive metadata is explicitly treated as absent; after migration normal metadata is read.

## Cleanup after deployment (separate owner action)

- Read the fresh report first. Open Agreements for subscriptions or Jobs/Quotes for one-time quotes. Default view is active; the URL `archive=archived` or `archive=all` persists the chosen view.
- Choose the owner-only bulk preview. Inspect IDs, client names, creation dates, signature/payment/recurring evidence and blockers. Only eligible records get actor-bound tickets valid for five minutes. At most 50 records are selectable per batch. Supply a meaningful reason, select records and explicitly submit.
- Each item is reauthorized against the stored owner, checked again in a Serializable transaction, and conditionally updated with an atomic audit event. Changed evidence produces skipped, transaction failures produce failed, and successful items produce success. Obtain a new preview for failures/stale tickets. Repeating an already applied action skips without duplicate audit events.
- Any signature, payment, payment attempt, partial/zero payment trace, provider/recurring trace, unknown evidence, financial history, product/client link, protected ID or creation after cutoff blocks archive. Even a cancelled agreement may be signed or paid and must remain protected.
- Nothing is physically deleted; archive does not remove legal/financial history from client/lead detail or finance, debtors and MCP reports. Historical links remain intact.

## Restore and concurrent events

Choose the archive/all view, open the restore preview, select the records, give a reason and submit. Restore clears visibility metadata and appends an audit event. It remains available for a record that acquired financial evidence after archival and does not regenerate checkout, start collection, send messages, or change payment/signature status.

Public signing/payment callbacks remain independent. A late signature, payment or provider trace makes an archived agreement visible in the active view for review as well as the archive view; restore can then clear its archive marker. Archive must never cause payment evidence or revenue to be discarded. Existing billing controls remain the sole way to control a provider schedule.

## Verification and recovery

Unit tests cover policy evidence, private config, signed ticket integrity/expiry/actor binding, strict input and safe repetition. `ARCHIVE_TEST_DATABASE_URL` enables the PostgreSQL integration test only for its explicitly named local synthetic database; no production URL fallback exists. It tests real scope queries, archived product history, both lifecycle races, owner revocation, metadata-only changes and audit rollback.

Run the project's tests, TypeScript, lint and build with synthetic URLs and notification credentials disabled. Test production through GET/dry-run only. Do not execute bulk cleanup, migrate, backfill or provision OAuth/MCP grants as part of verification.

If archive must be disabled, set `AGREEMENT_ARCHIVE_ENABLED=false`; existing records and history remain. Keep the additive columns/audit table. Restore records through the owner's restore preview rather than editing SQL or deleting events. Reverting list presentation is safe only while retaining compatibility with the new schema. Never drop audit history as a rollback step.
