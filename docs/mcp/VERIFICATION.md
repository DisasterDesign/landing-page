# MCP verification — 2026-10-26

> Current status: Elad approved the exact proposal at21:00UTC. Historical pending-approval/dependency notes below are superseded by [RELEASE-STATUS.md](RELEASE-STATUS.md); Auth0 user login is still required.


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
| Production build | PASS — `npm run build`, final patched Next16.4.3; route manifest includes MCP and protected-resource discovery |
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

## Dependency gate — follow-up triage and scoped patches

The initial implementation audit found 21 production dependency entries
(4 critical,10 high,7 moderate). This historical gate was investigated and
narrow compatible security patches were applied in the follow-up work:
Next16.4.3, NextAuth5.0.0-beta.32/Auth core0.41.3, Prisma auth adapter2.11.3,
Zod4.6.6, source-map-js1.2.2 and ProseMirror1.42.8. Original lint rules and
Hooks plugin7.0.1 are retained, without suppressing new errors in UI code.

Final production audit: **10 entries, 0 critical, 4 high, 6 moderate**. Full audit
including dev tools: **14 entries, 0 critical, 6 high, 7 moderate, 1 low**.
See DEPENDENCY-REVIEW.md for every advisory ID, runtime/API preconditions,
resolved packages, inherited audit noise and residual blog/editor risks.
No MCP import path to residual parser/editor/email findings was found; this
does not establish that the whole app is XSS-safe. In particular, existing raw
blog HTML before hydration sanitization needs a separate trust-boundary review.
A documented release decision on those residual risks is still required.

The final patched stack passed **629/629 tests, 0 failures/skips**, tsc and
Next16.4.3 production build. Final lint passed with 0 errors/17 existing warnings.
No provider/tenant/grant or production state was changed. Auth0 approval remains
pending; cost/account findings and exact future steps are in AUTH0-SETUP.md.

## Independent review and final state

An independent read-only security reviewer found no critical/important auth or
privacy issue. Its two operational notes were resolved: user throttling now
returns 429/Retry-After, and receipt queries use both period bounds in the DB
while the cross-period deduplication lookup intentionally stays unbounded. The
verification document was completed. Final full suite: **629/629 passed, no
skips/failures**. Final typecheck, lint and production build exited 0; lint has
the same 17 pre-existing warnings. The disposable Postgres instance was stopped
after verification. No process providing access to business data was installed.

Follow-up review of dependency changes found no important/critical regression.
All final-stack checks above were rerun after preserving the original Hooks
plugin. The original framework16.2.1 build result remains historical evidence,
not the version proposed for release. No broad editor/email upgrade, automatic
audit fix, lint-rule disabling or architecture migration was performed.

Additional patched-library check: actual next-auth/jwt getToken returned null
without throwing for malformed bearer percent encodings and an invalid token
(three synthetic requests, no database/provider I/O). No real login credentials
were used. Final audit was rechecked after the lint-plugin override and retained
the same 10 production/14 total affected-package counts.
