# Protected unsigned agreement name correction

## Deployment (separate authorized operation)

1. Review and apply `prisma/migrations/20261029120000_agreement_business_name_history/migration.sql` to the target database **before** releasing the application. It adds only `Agreement.businessNameCorrections` JSONB with an empty-array default. This repository has no established Prisma migration baseline; do not blindly run migrate deploy against an existing database. Use the normal reviewed additive SQL process.
2. Generate Prisma client and deploy the branch after integration with other work. No currency or product code is included here. If the independent archive branch is integrated, keep its archive checks/scoping and retain this branch's correction lock/snapshot checks. Optional archivedAt is checked directly from the locked PostgreSQL row even before schema clients are unified.
3. Existing unsigned signing tabs must reload. Missing or changed updatedAt returns 409, before signing side effects. An already committed SIGNED record remains idempotent.
4. Verify with synthetic records in staging: owner access, non-owner refusal, stale edit, correction and signing contending for the same row, before/after audit, unchanged token and financial fields, corrected preview/download. Automated concurrency tests simulate the state visible after lock acquisition; a live PostgreSQL contention exercise remains a staging verification.
5. In the agreements list open the agreement preview, select “תיקון שם העסק”, verify current/new values, tick confirmation and save. A 409 requires closing and reopening the editor. Unknown document layouts fail closed rather than adopting new legal terms.

## Verification and privacy

Automated tests use synthetic records only. No real agreement is changed, no client details are stored in code/tests, and no secrets are committed. Correction only writes businessName/content/audit history; no payment or notification APIs are called. Downloads and print views read the same stored HTML. The signed document is never rewritten by a correction.

Rollback: roll back the application only; keep the additive history column and its contents. Never roll back to a signing implementation that ignores snapshots after a correction has been made. Any real customer correction is a separate authorized operation after rollout and a fresh status check.
