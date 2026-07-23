# Cold Prospecting Operations Runbook

## Current status

The initial prospecting pipeline is active in production. The first Dizengoff Center batch demonstrated that website quality alone is not enough: a business must also be an independent, owner-reachable sales prospect.

The sales-fit overhaul is implemented on `fix/prospecting-sales-fit`. It adds territory-shape validation, chain/franchise exclusion, a separate sales-fit gate, partial Place Details resilience, call-ready seller cards, and revisioned batch replacement. `PROSPECTING_ENABLED` and the admin kill switch remain the immediate stop controls.

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

## Sales-fit upgrade rollout

1. Create a preview database from a current schema-safe copy. Never point preview verification at production.
2. Apply `prisma/schema.prisma` to preview and confirm existing cycles become revision 1, historical rows remain readable, and all new sales-fit columns are nullable.
3. Deploy the branch with the admin kill switch enabled.
4. Run the full tests, lint and production build against the exact deploy commit.
5. Generate one test proposal. Confirm `STREET` and open-local `COMMERCIAL_CENTER` pass, while malls, broad areas, campuses, industrial zones and chain-dominated centers fail.
6. Run a bounded discovery sample. Confirm chains, franchises, institutions and missing-phone businesses are terminally excluded before PageSpeed.
7. Open the seller list and confirm phone, website/no-site state, Google Maps, category, address, rating context, hours, sales-fit reason and website findings are visible.
8. Simulate one malformed Place Details response and confirm the other businesses retain their live data.
9. Review Google and Anthropic quotas. Active websites may use one sales-fit AI call plus one visual-audit AI call.

## Weekly-cycle checklist

1. Turn off the admin kill switch in preview.
2. Invoke `/api/cron/prospecting-propose` once with valid cron authorization.
3. Confirm every admin receives an in-app notification linking to the proposed territory.
4. Approve only a named commercial street or open local center whose rationale targets independent storefront businesses.
5. Invoke the worker repeatedly or wait for its ten-minute schedule.
6. Confirm that only Place IDs and Fuzion-derived sales-fit/audit evidence are stored—never raw Google payloads, business details, HTML or screenshot data.
7. Confirm every published prospect is `INDEPENDENT_LIKELY`, sales-fit confidence is at least 0.80, owner reachability is at least 70, a live public phone exists, and website score 5 is absent.
8. Confirm the seller receives at most 50 records. Fewer than 50 is correct when the territory cannot meet the thresholds.
9. Record a follow-up, `DO_NOT_CALL`, and `INTERESTED`. Verify suppression, promotion to a warm lead, agreement `leadId`, payment flow and commission behavior.

## Replacing an unsuitable published batch

Use `supersedePublishedCycle(cycleId, reason)` only after the new production deployment passes live smoke tests.

The operation:

1. Marks the published cycle and batch as superseded.
2. Marks only untouched `PUBLISHED` prospects as `INVALID`.
3. Preserves prospects with interactions, call history, audits and attribution.
4. Creates the next revision for the same week and seller.
5. Generates a new territory proposal and notifies admins.

The operation is idempotent. Never manually delete the old batch or prospect rows.

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
- New proposals contain two to four bounded search seeds. The worker may expand only through those approved seeds and the fixed business-category taxonomy.
- Ratings and review counts are context only. They cannot independently prove that a business is a chain, large organization or owner-operated.
- Google Place Details are fetched live with bounded concurrency and per-place failure isolation. Only Place IDs are durable Google data.
- Every arbitrary website request validates DNS and each redirect, rejects private/local/metadata addresses, permits only HTTP(S), limits redirects to 5, total time to 12 seconds, body size to 5 MB and analyzed text to 100,000 characters.
- Outreach is human-only. Never add automated calls, WhatsApp, email or social messaging without a new explicit decision.

## Removal

To stop or remove the production trial:

1. Set `PROSPECTING_ENABLED=false` and turn on the admin kill switch.
2. Export any prospect/call history that must be retained.
3. Remove the prospecting cron entries and UI links.
4. Apply a separately reviewed migration that drops only the prospecting tables/enums and the nullable fields added to `Notification`, `ContactSubmission` and `Agreement`.
5. Do not delete warm leads or agreements created through promotion; they are normal business records.
