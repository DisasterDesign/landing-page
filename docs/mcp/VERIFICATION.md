# MCP verification — 2026-10-26

Local isolated branch based on committed finance/debtor fixes `88fa1d3`.
No production environment file was copied or loaded. No production migration,
OAuth setup, credential creation, grant, deployment, Codex setup or Work plugin
installation was performed. No endpoint is claimed live/connected.

| Check | Result / evidence |
| --- | --- |
| Full suite, DB tests enabled sequentially | PASS — final run: 629 tests, zero failed, zero skipped (24.3 seconds) |
| Official client, real loopback Streamable HTTP | PASS — initialize, tools/list, tools/call; owner and shared-reader behavior |
| OAuth-shaped synthetic RS256 auth | PASS — absent/malformed/expired token, wrong audience/issuer, absent/expired/revoked/not-yet-valid grant, password-reset restriction, persisted role change, current scope intersection; azp and RFC 9068 client_id |
| Current permissions after initialized session | PASS — owner flag/scope updates and revocation affect the next request |
| Finance parity | PASS — actual `buildFinanceReport`/`loadReceipts` functions through strict synthetic reader and actual local Postgres; same lenses and UTC period; refunds, mixed private/shared clients, receipt deduplication, historical/empty periods, archived receipts, recorded costs, original VAT evidence and unvalued currency |
| Client search | PASS — scope before limit, private-only name indistinguishable from missing, scoped mixed children, empty and limited results; no identity/payment fields |
| Debtors | PASS — stored shared loader/partition, owner gate before queries/counts, hidden and historical missing snapshots, null unknown amount, stale/freshness metadata, inactive orders, no identity/payment keys or numeric/transaction name fallbacks |
| No side effects | PASS — strict module I/O allowlists and actual Prisma middleware reject non-read actions during MCP initialize/list/call; setup/revocation/cleanup restricted to synthetic DB |
| Migration | PASS — exact SQL executed in temporary test schema; creates zero grants; schema removed afterward |
| Prisma generation / types | PASS — Prisma 5.22 generated; `tsc --noEmit` zero errors |
| Lint | PASS with existing warnings — zero errors, 17 warnings; scoped MCP/finance route lint zero errors/warnings |
| Production build | PASS — `npm run build`, Next 16.2.1; route manifest includes MCP and protected-resource discovery |
| Actual Auth0 tenant / OAuth browser flow | NOT RUN — provider/client/grant provisioning requires explicit approval |
| Production data parity and live auth | NOT RUN — no deployment/access provisioned; production checks must remain read-only |
| Local Codex connection | NOT RUN — no persistent setup authorized yet |
| PERSONAL Work plugin / successful dot call | NOT RUN — parent owns setup and final acceptance |

The guarded synthetic PostgreSQL instance uses loopback `127.0.0.1:55448`,
database `finance_test`, disposable files under `/tmp/fuzion-mcp-pg`. This is
not an application/production credential or a production access grant. Existing
finance integration tests reject any other host/port/database. Business-write
rejection is active during MCP reads; fixture setup changes synthetic data only.

Reproduction (after starting a disposable database and applying schema there):

```
MCP_TEST_DATABASE_URL=<guarded-local-test-url> \
FINANCE_TEST_DATABASE_URL=<guarded-local-test-url> \
node --import tsx --test --test-concurrency=1 'src/**/*.test.ts'
npm exec tsc -- --noEmit
npm run lint
npm run build
```

The equivalent `npm test` script also ran successfully (625 passed, one DB test
skipped before the second DB test was added). An initial sandbox-only attempt
was blocked by local tsx socket permissions; approved synthetic runs succeeded.
The first build exposed a Next route-config re-export error; it was fixed by
exporting the route setting as a literal and the build passed afterward.
An initial source-structure test was updated to check the extracted guarded
read-loader call, preserving its original authorization-before-sensitive-work
assertion. No unresolved test failure is hidden as a pass.

## Existing dependency security gate — unresolved

`npm audit --omit=dev` reports **21** vulnerable production dependency entries:
4 critical, 10 high, 7 moderate. Direct/related affected packages include Next,
NextAuth/Auth core/Prisma adapter, Zod and existing UI/email dependencies. No
advisory was returned for the added MCP SDK or `jose`. Existing versions were
not broadly upgraded as part of this integration; **do not deploy/enable this
branch until the critical/high baseline is patched and the auth/report/build
checks pass on the selected patched versions**. The audit offers Next 16.4.3
and compatible package updates; those have not been installed or verified.

Relevant advisory examples:
[Next RCE](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j),
[Next middleware authorization bypass](https://github.com/advisories/GHSA-26hh-7cqf-hhc6),
[Zod constrained collection exhaustion](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).
This is a release gate, not a claim that MCP JWT verification was bypassed.
The MCP route independently authenticates before any data read, enforces a
16-KiB request bound and does not trust the legacy middleware session role.

## Independent review and final state

An independent read-only security reviewer found no critical/important auth or
privacy issue. Its two operational notes were resolved: user throttling now
returns 429/Retry-After, and receipt queries use both period bounds in the DB
while the cross-period deduplication lookup intentionally stays unbounded. The
verification document was completed. Final full suite: **629/629 passed, no
skips/failures**. Final typecheck, lint and production build exited 0; lint has
the same 17 pre-existing warnings. The disposable Postgres instance was stopped
after verification. No process providing access to business data was installed.
