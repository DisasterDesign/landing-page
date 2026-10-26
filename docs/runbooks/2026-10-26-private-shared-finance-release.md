# Finance release and reconciliation

Operational customer identities, account IDs and amounts must remain outside this public repository. Supply a reviewed private manifest and expense map; never commit either file or live command output.

## Release order

1. Back up the explicitly selected production database with a compatible PostgreSQL client; validate the archive and record a checksum privately.
2. Apply prisma/migrations/20261026143000_finance_books/migration.sql once. The database predates a complete Prisma migration chain; do not blindly run migrate deploy without a migration baseline.
3. Deploy and verify the privacy code. Imported private data must wait until the new code and schema are active together. UNASSIGNED rows temporarily disappear from shared views until backfill completes.
4. Run `tsx scripts/finance-backfill.ts --manifest=/private/path/import.json` dry. Review every proposed update and unknown item. Use `--expense-map=/private/path/expense-books.json` for explicitly reviewed overhead/direct cost classifications. Missing clientId is not overhead evidence. Apply with `--apply`, then dry-run again to verify idempotency.
5. Run `tsx scripts/finance-import-personal.ts --manifest=/private/path/import.json` dry, review exact account identity and explicitly approved missing-client creations, then apply. Preserve archived customers and existing client names. Do not fabricate signed agreements or guess ambiguous client links.
6. Save explicit orphan account book overrides privately in FinanceSyncState `finance:account-overrides`, metadata `{accounts:[{accountId,financeBook}]}`. An override may identify a book without inventing a client identity; conflicting links remain unassigned.
7. Only after classification/products, preview `tsx scripts/finance-sync-history.ts --from=YYYY-MM-DD --to=now`. Review original currency, ILS evidence, dates, duplicate transaction identities and unknown mappings. Apply using the same confirmed range and `--apply`. Provider calls are reads; only the application database changes. Never prepare receipt snapshots before classification.
8. Verify owner and partner views, direct private IDs, totals/counts, private expense isolation, current-month receipt coverage and existing archived history. New private proposals must remain absent from shared routes and notifications.
9. Record expense payments only from actual evidence using an ILS amount, payment date, payer and optional reference. Monthly forecast rows are not payment evidence. Provider keys remain server-only.

## Providers and limits

Cloudflare pilot: CLOUDFLARE_FINANCE_API_TOKEN and CLOUDFLARE_FINANCE_ACCOUNT_ID. Neon pilot: NEON_FINANCE_API_KEY and NEON_FINANCE_ORG_ID. Manual refresh is owner-only; scheduled finance-sources requires CRON_SECRET. Cloudflare invoices are evidence, not automatically shared expenses; Neon consumption is usage, not bank settlement. Other suppliers retain manual entry until connected.

Cardcom fees remain an explicitly estimated 2%. Forecast FX uses existing approximate rates, while actual expense payments require recorded ILS evidence and foreign receipts need provider ILS valuation. Only recorded expenses are deducted from actual entitlement; incomplete evidence is labelled partial. Nightly reconciliation covers a rolling window, and history import supplements it. Completed partner transfers and closed-month accounting are not automatic.

## Recovery

Keep financial snapshots and the backup; do not drop ledger columns. After private import, do not roll back to old code that exposes private records. Restrict nonowner access while repairing if necessary. Full code+database restoration must account for any newer payments. No Cardcom orders or charges are changed by this release.
