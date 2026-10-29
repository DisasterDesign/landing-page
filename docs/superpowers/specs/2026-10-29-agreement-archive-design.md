# Reversible agreement visibility archive

The user supplied and authorized the full implementation specification in the task on 29 October 2026. This document records implementation choices; it contains no production customer data.

Add nullable archive metadata and an append-only archive/restore event table. Archive is independent of cancellation, signature and payment. Existing DELETE stays disabled. Only persisted owners can preview or execute cleanup; finance book scopes and redaction remain unchanged for other viewers. No finance/MCP/provider query gains archive filtering.

A private server configuration supplies protected IDs, an explicit age cutoff and preview signing secret. Missing configuration disables archive (fail closed). No customer exception is embedded in source, tests, docs or migration. Read-only previews inspect all dependency history in a consistent database snapshot. Short-lived signed tickets bind actor, action, policy revision and evidence fingerprint. Every bulk item is reauthorized/reclassified inside a Serializable transaction, with conditional update and atomic audit. Retries return success/skipped/failed per item. Restore changes visibility only and is possible even if later financial evidence exists.

The normal agreement and quote lists exclude archived rows, except a later signature/payment/recurring trace keeps a protected record visible for review. URL filters expose archive/all. Client/lead history remains complete. Public signing and existing payment callbacks keep their behavior; archive never silently drops late payments or stops a standing order.

The work includes a shared owner-only preview/bulk interface, synthetic policy/service and real PostgreSQL transaction tests, relevant regression tests, TypeScript, lint and production build. Production verification is read-only; migration, deployment, backfill and actual cleanup are not executed during development.
