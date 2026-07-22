# Cold Prospecting Operations Runbook

## Current status

The implementation lives only on `feat/cold-lead-pipeline`. It has not been pushed, deployed, or connected to the production database. No production migration has been applied. `PROSPECTING_ENABLED` defaults to `false`.

## Required services

Create a dedicated Google Cloud project or at minimum a dedicated restricted API key for prospecting. Enable:

- Places API (New)
- PageSpeed Insights API

Restrict the key by API and by the production server environment where supported. Do not reuse the homepage reviews key. Set conservative daily quotas and billing alerts before enabling the worker.

Create a separate Anthropic server-side API key. The production code uses the Messages API with no tools. Never expose any of these keys through `NEXT_PUBLIC_*` variables.

## Environment

```dotenv
PROSPECTING_ENABLED=false
PROSPECTING_AI_API_KEY=
PROSPECTING_AI_MODEL=
PROSPECTING_GOOGLE_PLACES_API_KEY=
PROSPECTING_PAGESPEED_API_KEY=
PROSPECTING_HASH_SECRET=
PROSPECTING_WEEKLY_TARGET=50
PROSPECTING_MAX_DISCOVERED_PER_CYCLE=250
PROSPECTING_MAX_PLACES_CALLS_PER_CYCLE=400
PROSPECTING_MAX_AI_CALLS_PER_CYCLE=250
PROSPECTING_MAX_ESTIMATED_COST_USD=25
```

Generate `PROSPECTING_HASH_SECRET` as a long random value and keep it stable. Changing it makes existing phone/domain suppression hashes impossible to reproduce.

## Pre-production setup

1. Create a preview database from a current schema-safe copy. Never point preview verification at production.
2. Apply `prisma/schema.prisma` to the preview database using the same reviewed schema workflow used by Fuzion. This repository currently has no migration history; do not invent a full baseline migration or run `prisma db push` against production from this branch.
3. Deploy the branch to a preview environment with all provider keys and `PROSPECTING_ENABLED=false`.
4. Open `/admin/prospecting`. Select the seller, keep the weekly target at 50, enable the admin kill switch, and save.
5. Verify that all three prospecting cron endpoints return a successful disabled/no-op response and create no cycle.
6. Set `PROSPECTING_ENABLED=true` in preview while the admin kill switch remains on. Verify the UI reports that automation is stopped by admin control.
7. Review Google and Anthropic quotas and confirm the estimated-cost ceiling is appropriate.

## First-cycle checklist

1. Turn off the admin kill switch in preview.
2. Invoke `/api/cron/prospecting-propose` once with valid cron authorization.
3. Confirm every admin receives an in-app notification linking to the proposed territory.
4. Review the proposal in `/admin/prospecting`; reject it once to verify a bounded replacement is created, then approve an appropriate proposal.
5. Invoke the worker repeatedly or wait for its ten-minute schedule.
6. Confirm that only Place IDs and derived audit evidence are stored—never raw Google payloads, HTML or screenshot data.
7. Confirm scores follow the fixed boundaries and that score 5 is absent from the seller batch.
8. Confirm the seller receives at most 50 records, live phone/business data, three call angles and no territory/scoring controls.
9. Record a follow-up, `DO_NOT_CALL`, and `INTERESTED`. Verify suppression, promotion to a warm lead, agreement `leadId`, payment flow and commission behavior.
10. Only after a successful preview cycle, schedule a separate production migration/deploy review.

## Schedules

- Sunday 06:00 UTC: `/api/cron/prospecting-propose`
- Every ten minutes: `/api/cron/prospecting-worker`
- Daily 02:00 UTC: `/api/cron/prospecting-maintenance`

Every endpoint authenticates with the existing cron guard. Each invocation performs bounded work; no transaction remains open during external requests.

## Monitoring and incident response

Use `/admin/prospecting` to watch state, provider-call counts, estimated AI cost and the last error. A stale 15-minute lock is released by maintenance. A failed cycle can be retried from its last safe state or cancelled.

Immediate stop options:

1. Turn on the admin kill switch for a reversible database-level pause.
2. Set `PROSPECTING_ENABLED=false` and redeploy for the environment-level kill switch.

Already published historical seller records remain readable if provider credentials stay configured. No new discovery, audit or publication runs while disabled.

## Quotas and policy guardrails

- Maximum 250 discovered Place IDs per cycle.
- Maximum 400 combined Places calls per cycle.
- Maximum 250 AI calls per cycle.
- Maximum estimated AI cost: USD 25 per cycle.
- Google Text Search is treated as best-effort and capped at 60 results per query; it is not a complete business registry.
- Every arbitrary website request validates DNS and each redirect, rejects private/local/metadata addresses, permits only HTTP(S), limits redirects to 5, total time to 12 seconds, body size to 5 MB and analyzed text to 100,000 characters.
- Outreach is human-only. Never add automated calls, WhatsApp, email or social messaging without a new explicit decision.

## Removal

Before any production migration: delete the feature branch/worktree; production is unchanged.

After a migration:

1. Set `PROSPECTING_ENABLED=false` and turn on the admin kill switch.
2. Export any prospect/call history that must be retained.
3. Remove the prospecting cron entries and UI links.
4. Apply a separately reviewed migration that drops only the prospecting tables/enums and the nullable fields added to `Notification`, `ContactSubmission` and `Agreement`.
5. Do not delete warm leads or agreements created through promotion; they are normal business records.
