# Fuzion Webz — Decision Log

## 2026-07-22 — Weekly cold-prospecting pipeline

**Status:** Accepted for an isolated, disabled-by-default trial.

### Decision

Build cold prospecting as a separate `Prospect` domain inside the existing Fuzion application. The pipeline proposes one compact Israeli territory each week, waits for an admin approval notification, discovers businesses through Google Places API (New), audits websites, publishes at most 50 scored prospects to the assigned seller, and promotes only interested prospects into the existing `ContactSubmission` and agreement flow.

The architecture is hybrid:

- Deterministic code owns discovery limits, network safety, technical evidence, the 0–5 score, eligibility, deduplication, suppression, assignment and state transitions.
- One bounded AI call proposes a territory; one bounded AI call contributes only the 15 visual-UX points and exactly three call angles. Neither AI call has tools.
- The seller performs human calls only. There is no automated messaging or outreach.

### Fixed rules

- Score `0`–`4` enters the eligible pool; score `5` is excluded from the seller list.
- The weekly batch is capped at 50.
- The seller sees only the final assigned list and does not approve territories or edit scoring.
- Google Maps HTML is never scraped. Durable Google data is limited to Place IDs; display name, phone and address are fetched live.
- Raw Places responses, website HTML and screenshots are not persisted.
- `DO_NOT_CALL` creates permanent Place ID, phone and domain suppression identifiers.
- The feature is controlled by `PROSPECTING_ENABLED=false` and an independent admin kill switch.

### Rationale

Keeping prospects separate prevents speculative cold records from polluting the warm-lead CRM. Promotion creates a normal lead only after the seller records interest, preserving the existing agreement, payment and first-month commission model. Place-ID-only storage and bounded safe fetching reduce policy, privacy and SSRF risk.

### Reversibility

No production schema change or deployment is part of this branch. Before migration, removal is deleting the branch/worktree. After migration, set `PROSPECTING_ENABLED=false` immediately; dropping the isolated prospecting tables and nullable integration columns is a separate reviewed migration.
