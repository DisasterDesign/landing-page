# Unified Lead Lifecycle Runbook

## Current state

The unified lifecycle is implemented as a reversible release candidate. It is not safe to enable the new interfaces until the target database has passed the additive schema, backfill, reconciliation and hardening gates below.

The two UI flags are server-only:

```dotenv
UNIFIED_LEAD_LIFECYCLE_ENABLED=false
COLD_LEAD_PREPARATION_ENABLED=false
```

Both legacy and unified interfaces write through the same canonical lifecycle services. Turning a UI flag off changes the screen only; it does not undo data or permit legacy direct writes.

## Non-negotiable safety rules

- Use an isolated preview database first. Never test migration or race scenarios against production.
- Take a restorable database snapshot immediately before each environment rollout.
- Run all commands from the exact release commit that will be deployed.
- Scripts are dry-run by default. `APPLY=1` is the only write switch.
- A non-zero reconciliation result blocks constraints, UI enablement and production rollout.
- Store any non-empty resolution JSON outside the repository. Set `OPERATOR_USER_ID` to a persisted admin.
- Never delete a Lead, note, event, interaction, follow-up, Agreement or commission to repair history.
- Never roll application code back to a version that does not understand the additive schema. Roll back the interface with flags.
- Treat every Cardcom callback body as untrusted. Before any `COMPLETED`, `WON` or commission mutation, re-read the LowProfile through authenticated `GetLpResult`/LowProfile verification and require the stored LowProfile ID, `ReturnValue`, amount and stable provider transaction ID to match. A provider read failure is retryable and must leave lifecycle and financial state unchanged.

## Preview rollout

### 1. Baseline and additive schema

1. Create or refresh the isolated preview database and capture baseline counts for Leads, open seller queues, Agreements and commissions.
2. Keep both UI flags `false`.
3. Validate the release commit:

```bash
npx prisma format
npx prisma validate
npx prisma generate
```

4. Apply only the additive `prisma/schema.prisma` to preview:

```bash
npx prisma db push
```

Do this before deploying code that writes the new columns.

### 2. Index preflight and audited exception repair

Run the index script without `APPLY`:

```bash
npm run leads:indexes
```

If it reports duplicate active Agreements or scheduled follow-ups, prepare a version-1 resolution file outside the repository. The supported audited actions are:

- `LINK_AGREEMENT_TO_LEAD`
- `CANCEL_DUPLICATE_AGREEMENT`
- `CANCEL_DUPLICATE_FOLLOW_UP`
- `SET_AGREEMENT_CREDIT`
- `LINK_COMMISSION_TO_AGREEMENT`
- `CLASSIFY_LEGACY_ORPHAN_COMMISSION`

Validate it first:

```bash
OPERATOR_USER_ID=<admin-id> npm run leads:resolve -- --file /absolute/path/resolutions.json
```

Apply only after reviewing every reported action:

```bash
APPLY=1 OPERATOR_USER_ID=<admin-id> npm run leads:resolve -- --file /absolute/path/resolutions.json
APPLY=1 npm run leads:indexes
```

### 3. Pre-cutover backfill

While the old application is still serving:

```bash
npm run leads:backfill
APPLY=1 npm run leads:backfill
APPLY=1 npm run leads:backfill
```

The second applied run proves idempotency. A row becomes seller-visible only when intent, source, snapshot, stage, ownership and eligible seller are all resolved. Ambiguous rows remain `migrationReviewRequired=true` and admin-only.

The first applied run captures its preservation baseline in one Serializable transaction before it scans migration work: exact pre-existing Lead IDs, exact original `ContactNote` IDs, and a hash of each original note’s Lead, author and timestamp. Reconciliation validates those identities rather than relying on a wall-clock count window.

### 4. Deploy with both interfaces disabled

Deploy the release commit to preview with:

```dotenv
UNIFIED_LEAD_LIFECYCLE_ENABLED=false
COLD_LEAD_PREPARATION_ENABLED=false
```

Immediately run the applied backfill again. This is the mandatory catch-up pass for rows created or changed by old writers during the schema/backfill/deploy window:

```bash
APPLY=1 npm run leads:backfill
APPLY=1 npm run leads:backfill
npm run leads:reconcile
```

The catch-up compares every stored `legacyStateHash`, rederives mismatches under a row lock, and must become a no-op on its second run.

Batch supersession invalidates only an untouched `NEW`, unowned Lead with no canonical or legacy Prospect interaction. It never regresses a claimed, contacted, Agreement-active or paid Lead. A scheduled follow-up that has merely become overdue remains scheduled; catch-up cancels it only when the Lead is terminal.

### 5. Seller-queue count gate

With both UI flags still off, compare the legacy seller queues to the recorded baseline:

- expected resolved incoming/ad-response Leads are present;
- expected current outbound Leads are present;
- focused notification links open the exact in-scope Lead;
- no seller sees another seller’s Lead;
- unresolved migration rows appear only to admins.

Any unexplained material count drop blocks rollout.

### 6. Resolve all reconciliation exceptions

Use the admin migration-review flow for ambiguous Lead source, stage or ownership. Use the external audited resolution file only for the explicit historical Agreement, follow-up and commission cases listed above.

Repeat until clean:

```bash
npm run leads:reconcile
```

Then run the constraints preflight and apply:

```bash
npm run leads:constraints
APPLY=1 npm run leads:constraints
npm run leads:reconcile
```

Do not proceed unless all commands exit successfully and reconciliation reports zero unresolved issues.

### 7. Staged UI enablement

1. Set `UNIFIED_LEAD_LIFECYCLE_ENABLED=true` in preview.
2. Verify admin CRM, incoming/ad-response seller queue, ownership, notes, structured outcomes, follow-ups, agreement creation and notification deep links.
3. Set `COLD_LEAD_PREPARATION_ENABLED=true`.
4. Verify cold preparation, public live phone, website/map actions, claim, call outcome and sales handoff.
5. Run the browser and race smoke checklist below.

## Preview smoke checklist

- Publish the same Prospect twice: one Lead and one publication event.
- Ingest the same Meta external ID twice: one Lead and no duplicate fresh-lead notification.
- After hardening, ingest the same raw external ID under `meta_lead_ads` and `google_search_ads`: two Leads keyed by source pair.
- Historical Meta sync preserves original `occurredAt` and creates no fresh SLA/notification flood.
- Exercise one `OUTBOUND`, one `AD_RESPONSE` and one `INBOUND` Lead.
- Race two seller claims: exactly one owner.
- Seller B cannot read or mutate seller A’s Lead.
- Admin and seller can see the intent level, actual acquisition channel, phone provenance, website and map.
- A company note survives reassignment and remains attributed to its author.
- A due follow-up emits one notification on the next one-minute cron tick; retry emits no duplicate.
- A notification opens the exact Lead in both unified and legacy UI modes.
- `DO_NOT_CALL` hides contact/follow-up actions and the APIs reject them.
- Race two Agreement creates: one active Agreement.
- Agreement sent, signature and first payment appear once in the timeline.
- Send a forged Cardcom success body without a matching authenticated LowProfile result: no Agreement, Lead, revenue or commission mutation occurs.
- Make the authenticated Cardcom LowProfile read fail: the callback returns a retryable error and performs no lifecycle or financial mutation.
- Payment retry creates one `WON`, one payment event and one commission.
- Failed first payment creates a recovery next action, not a fake seller follow-up.
- Payment after `LOST` records the authoritative `WON` and alerts admins.
- Resolve one migration-review Lead: the audit event is present and seller access begins only after resolution.
- Prospect table phone copy, website, map and open-Lead actions work.
- Both UI flags off restore legacy screens without changing canonical invariants.
- Desktop and narrow RTL layouts retain the current Heebo shell, typography and pink/cyan/gray tokens.

## Production rollout

Production requires a separate explicit approval after preview passes. Repeat the exact order:

1. Snapshot production and record baseline counts.
2. Keep both UI flags false.
3. Apply the additive schema.
4. Dry-run and apply indexes after audited repairs.
5. Dry-run, apply and repeat the pre-cutover backfill.
6. Deploy the verified release commit with flags false.
7. Immediately run and repeat the applied catch-up backfill.
8. Pass the legacy seller-queue count gate.
9. Reconcile to zero, then dry-run/apply constraints and reconcile again.
10. Enable the unified lifecycle UI.
11. Verify incoming/admin flows.
12. Enable cold preparation and verify outbound flows.

Only after preview and production are both confirmed hardened, create a separate schema-sync commit that:

- makes `intentLevel`, `sourceKey` and `stage` required;
- removes the transitional single-column `externalLeadId @unique`;
- keeps the additive nullable `SellerCommission.agreementRefId` relation.

Deploy that schema-sync commit before any later `prisma db push`.

## Recovery

### Partial backfill or interrupted process

Leave both UI flags false. Do not manually edit rows. Rerun the dry-run, then the applied backfill; it is idempotent and row-scoped. Run it a second time and reconcile. Serialization failures that remain after the bounded retry are unresolved blockers, not rows to skip.

### Duplicate webhook or sync replay

Retry the same payload. Source idempotency is the pair `(sourceKey, externalLeadId)`. Confirm one Lead and one source-specific created event. A conflict with the same raw ID under another channel must not be “fixed” by merging the records.

### Missing or ambiguous seller assignment

Keep the Lead in migration review and admin-only. Resolve the eligible seller/owner explicitly through the admin migration-review screen with a reason. Never guess an owner from a note, Agreement name or unrelated historical assignment.

### Live Google outage

Do not persist or substitute stale phone, address, category, hours, rating or raw Google payload. The durable public display name and audited website preserve business identity. Show the live-data-unavailable state and retry later. Already confirmed first-party/seller contact data remains usable with its provenance.

### Reconciliation or constraints failure

Do not enable flags. Export the report, repair only through the admin review flow or audited resolution file, and rerun. If a constraint application was interrupted, rerun its dry-run before `APPLY=1`; the DDL is designed to be repeatable only after its preflight succeeds.

### Immediate UI rollback

Set:

```dotenv
UNIFIED_LEAD_LIFECYCLE_ENABLED=false
COLD_LEAD_PREPARATION_ENABLED=false
```

Redeploy the same schema-aware release. Canonical writers and append-only history remain active.

### Stop prospecting independently

Turn on the database-backed prospecting admin kill switch for the fastest stop, or set `PROSPECTING_ENABLED=false` and redeploy. This stops proposal, discovery, audit and publication without disabling the CRM or deleting published Lead history.

## Monitoring after enablement

For the first 48 hours, review:

- new Leads by intent and channel;
- claim conflicts and seller-scope denials;
- leads in migration review;
- SLA and follow-up notification dedupe;
- active Agreement collision errors;
- first-payment lifecycle/commission mismatches;
- Google live-detail availability;
- reconciliation output after the first scheduled Meta sync and prospecting cycle.

Post-rollout canonical Leads have a `CREATED` event and are not required to carry a migration-only `MIGRATED` note snapshot. Reconciliation applies that legacy-history requirement only to the exact Lead IDs stored in the migration baseline, while still validating global source, payment, ownership and count invariants for every Lead.

Any writer-boundary regression, cross-seller access, duplicate first-payment effect or reconciliation mismatch is a rollback-level incident.
