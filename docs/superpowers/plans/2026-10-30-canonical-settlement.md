# Canonical cash settlement implementation plan

> Execute locally with superpowers:executing-plans. No publication or production changes are authorized.

**Goal:** One evidence-based shared cash settlement used by finance UI, partner UI and MCP, with inspectable receipts and paid costs.

**Architecture:** A pure minor-unit calculator and explicit Israel/UTC period resolver; an authenticated read adapter reuses the existing receipt loader and persisted expense payments; one shared client component renders the same JSON contract on both pages. Current forecast remains separate. No migrations, writes, provider refreshes, assumed FX or new grants.

**Tech stack:** Existing Next.js, TypeScript, React, Node test runner and MCP SDK. Synthetic fixtures only.

**Spec:** Authorized task instructions: actual collections, shared-only 50/50 after net costs, Roy invoice VAT once, confirmed in-period advances only; missing evidence never final payable. Original receipt evidence and private ownership stay immutable.

## Tasks

- [x] 1. Pure calculation (`cash-settlement.ts`, `cash-period.ts`, focused tests). RED then GREEN: Israel October DST, explicit UTC, signed refunds, source/fallback VAT, unknown FX/cost VAT, private exclusion, duplicate references, minor-unit rounding, confirmed advances and payable gates.
- [x] 2. Read adapter (`cash-data.ts`) and authenticated GET (`api/finance/settlement`), owner-only `finance_receipts` under existing finance:read, shared canonical object in finance_summary. RED then GREEN: owner gate before I/O, period and as-of parity, archived receipt clients, mixed-private expenses sanitized, unknown coverage and no writes/providers.
- [x] 3. Shared `CashSettlementPanel` on finance and partner pages. Add actual receipt/client and paid-expense tables; mark remaining product/budget figures forecast. Test rendering using synthetic data and verify local browser UI. Do not add a production auth bypass.
- [x] 4. Full test suite, typecheck, lint, build; sanitized whole-branch review; fix important findings; local commit. Keep all private evidence outside this repository. Prepare data-correction preview outside repository, without applying it.

## Review focus

- Current incomplete month and stale coverage must never show a final payable.
- Partial/mixed expenses expose only their shared allocation to a partner.
- Missing source VAT cannot silently become a source-verified amount.
- Reimbursement belongs to its payer and is outside Roy's invoice VAT base; advances are gross cash credits.
- Every shared client receipt, including archived/unlinked clients and refunds, must reconcile; private totals must be absent for partners.

## Rulings

- The existing expense ledger has no deductible VAT evidence or confirmed advance ledger. Expose these as unknown coverage; never invent zero VAT or zero advances. Pure inputs support verified evidence, but no storage migration/write flow is added in this read-focused change.
- Existing application fee model is estimated. Keep its flag and block final payable unless actual fee evidence is available. No artificial numeric target.
- Native managed worktree tool unavailable for this task; isolated local Git worktree created from the observed production revision.

## Local completion evidence

- Full synthetic test suite passes; four existing optional real-PostgreSQL suites remain skipped without an explicitly configured disposable database.
- TypeScript and changed-file ESLint pass. Full lint has no errors and17 pre-existing warnings.
- Production webpack build succeeds. Default Turbopack build is environment-blocked by its internal port listener; no source workaround was added.
- Actual React component rendered with compiled CSS and synthetic owner/partner data; browser inspection verified tables, expandable receipt/refund details and private-data exclusion. Authenticated end-to-end production browser access was not used.
- Fresh read-only review identified partial-expense redaction, competing legacy MCP allocation, malformed money/overflow, duplicate evidence, receipt ordering/pagination and payer identity. Each important issue received a RED-to-GREEN regression and the complete suite was re-run. Source review contains no private live financial evidence.
- A payer is the settlement partner only when uniquely identified by the existing persisted ADMIN/nonowner/50-percent partnership role; ambiguity stays UNKNOWN.
- The dashboard and both finance screens label product/budget estimates as forecast, before partner invoice VAT.
- Private classification/budget corrections are previewed outside the repository and require separate approval.
