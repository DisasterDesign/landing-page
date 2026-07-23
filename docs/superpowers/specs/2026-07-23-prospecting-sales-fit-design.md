# Prospecting Sales Fit and Seller Contact Reliability

**Date:** 2026-07-23  
**Status:** Proposed for implementation  
**Owner:** Fuzion Webz

## 1. Problem

The first production batch proved that website scoring alone does not create a
seller-ready call list.

The current pipeline selected Dizengoff Center, which contains chains, large
organizations, and businesses where a cold caller is unlikely to reach the
decision-maker. It also made the seller page depend on one bulk Google Places
request. If any request or response failed, the route discarded every live
business detail and silently hid phone and website actions.

The result was technically scored prospects that were commercially weak and
operationally unusable.

## 2. Goals

- Select compact Israeli micro-markets with a high concentration of small,
  independent, locally operated businesses.
- Exclude chains, franchises, malls, large institutions, and large corporate
  organizations before publication.
- Estimate the likelihood that the public business phone reaches an
  owner-operated decision path. This is a likelihood, not a factual claim about
  ownership.
- Keep the existing website-quality score from 0 through 5.
- Publish at most 50 prospects only when both website opportunity and sales fit
  pass their independent gates.
- Give Degaron a call-ready card with public phone, website, map, category,
  address, rating context, website findings, and a concise reason the business
  is a good sales fit.
- Prevent one failed Google response from erasing the details of the other
  prospects.
- Preserve Google Places compliance by storing Place IDs and Fuzion-derived
  audit/classification results, not raw Places business content.

## 3. Non-goals

- Do not discover or infer private mobile numbers, owner names, personal email
  addresses, or other non-public contact information.
- Do not scrape Google Maps.
- Do not let Degaron approve territories, classify businesses, or clean data.
- Do not lower the fit threshold to force a batch to contain 50 prospects.
- Do not treat review count, rating, or city size as proof of business size or
  ownership.

## 4. Chosen approach

Use a hybrid pipeline:

1. AI proposes a commercially focused micro-market.
2. Deterministic validation rejects prohibited territory shapes.
3. Google Places discovers candidates and supplies live public business
   details.
4. Deterministic rules reject obvious chains, franchises, institutions,
   prohibited business categories, closed businesses, and records without a
   public phone.
5. A structured AI sales-fit assessment classifies remaining candidates using
   bounded public evidence and website evidence.
6. The existing website audit assigns the independent 0-5 website score.
7. The publisher admits only candidates that pass both gates.

This is preferred over AI-only classification because hard exclusions must be
reliable and testable. It is preferred over a fixed city/street allowlist
because the system must continue finding new weekly territories without manual
research.

No matching primitive exists in the canonical Fuzion code library or reference
store.

## 5. Territory selection

### 5.1 Allowed territory shapes

- `STREET`: a named commercial street or bounded street segment with
  street-facing local businesses.
- `COMMERCIAL_CENTER`: only an open neighborhood or small-city commercial
  cluster where businesses are independently accessible.

The existing generic `AREA` value remains readable for historical rows but is
removed from the AI output schema and rejected for every new proposal. An
enclosed or chain-dominated center is prohibited even though its database enum
would otherwise be `COMMERCIAL_CENTER`.

### 5.2 Prohibited territory shapes

- Enclosed malls.
- Major shopping centers dominated by chains.
- Corporate campuses.
- Industrial zones dominated by factories, logistics, or B2B headquarters.
- Government, medical-campus, university, or institutional complexes.
- A single large organization presented as a territory.

The validator rejects proposals whose name, rationale, or search seeds indicate
one of these shapes. AI confidence cannot override a deterministic rejection.

### 5.3 Smart selection inputs

The territory agent receives:

- Previously considered coverage keys.
- Requested batch size.
- Prior-cycle yield: discovered, sales-fit rejected, website rejected, and
  published counts.
- Explicit target profile: independent local businesses where the owner is
  likely to work in or directly manage the business.
- Explicit exclusions for chains, franchises, malls, and large organizations.

The structured proposal returns:

- Display name and city.
- Allowed territory kind.
- Two to four bounded Places search queries covering the core street and
  adjacent commercial streets.
- Why the territory is likely to contain owner-operated businesses.
- Expected independent business categories.
- Explicit risk factors and confidence.

If one query does not yield enough eligible businesses, the worker uses only
the approved adjacent queries. It does not expand to an unbounded city-wide
search.

## 6. Business sales-fit gate

### 6.1 Hard exclusions

A prospect is not audited or published when public evidence identifies it as:

- A chain or franchise.
- A mall, shopping-center operator, department store, or anchor tenant.
- A bank, insurer, telecom operator, national utility, government body,
  hospital, university, school network, or large nonprofit institution.
- A corporate headquarters, factory, logistics center, or business whose local
  phone is unlikely to reach a purchasing decision-maker for a website.
- Permanently closed.
- Missing a public business phone.

Hard exclusions are implemented with normalized-name rules, prohibited Places
types, a versioned Israeli chain/franchise denylist, and high-confidence
structured classification. The denylist is auditable and can be extended
without changing scoring code.

### 6.2 Structured sales-fit assessment

The assessment returns:

- `classification`:
  - `INDEPENDENT_LIKELY`
  - `CHAIN_OR_FRANCHISE`
  - `LARGE_ORGANIZATION`
  - `UNSUITABLE_CATEGORY`
  - `UNCERTAIN`
- `confidence`: 0 through 1.
- `ownerReachabilityScore`: integer 0 through 100.
- `reason`: concise Hebrew seller-facing explanation.
- `evidence`: bounded codes selected from a fixed enum.

Only `INDEPENDENT_LIKELY` with confidence at least `0.80` and
`ownerReachabilityScore` at least `70` can become `READY`.

The model receives only the minimum bounded evidence required: public business
name, category, address context, rating/review counts as weak context, website
domain, and a small untrusted homepage-text excerpt when available. It receives
no private lead, agreement, payment, or interaction data.

### 6.3 Persisted data

Persist only Fuzion-derived values:

- Sales-fit classification.
- Confidence and owner-reachability score.
- Seller-facing reason.
- Fixed evidence codes.
- Classification version and timestamp.

Do not persist raw Google display name, phone, formatted address, rating,
review count, hours, category label, or website URI. Place ID remains the
durable provider identifier.

## 7. Google Places reliability and compliance

Google Places policies allow durable Place ID storage but prohibit prefetching,
caching, or storing other Places content beyond documented exceptions:

- <https://developers.google.com/maps/documentation/places/web-service/policies>
- <https://developers.google.com/maps/documentation/places/web-service/place-id>

Therefore the seller API continues to retrieve public business details live,
but changes its failure model:

- Fetch details with bounded concurrency rather than 50 sequential requests.
- Isolate every Place Details request. One invalid or failed response produces
  an error state for that prospect only.
- Return partial successes instead of clearing the entire details map.
- Log bounded provider failures with Place ID and HTTP/error class, never the
  API key or raw response.
- Expose `liveStatus: "READY" | "UNAVAILABLE" | "NO_PHONE"` per prospect.
- Use the persisted audited domain as the website fallback because it is the
  target Fuzion independently fetched and audited.
- Generate the public Google Maps link from the stored Place ID.
- Display required Google attribution next to live Places content.

The live field mask adds category, rating, review count, and opening-hours
context to the existing public name, phone, address, website, and business
status. None of these additional fields are persisted.

## 8. Seller experience

Each seller card shows, without expansion:

- Live business name.
- Public business phone as a large call action.
- Public website action or explicit “אין אתר”.
- Google Maps action.
- Category and address.
- Rating and review count as context, not a quality judgment.
- Website score 0-4.
- Sales-fit reason.
- Website opportunity summary.
- Today's public opening-hours context when Google supplies it.
- Three evidence-based Hebrew call angles.

The expanded section shows:

- Six website score dimensions.
- Sales-fit evidence.
- Previous call history.

If live Places details are unavailable:

- The card remains visible.
- The audited domain and all Fuzion-derived analysis remain visible.
- Phone is replaced with “הטלפון לא זמין כרגע” and a focused retry action.
- The UI never implies that the business lacks a phone merely because the
  provider request failed.

## 9. Publication and replacement behavior

The publisher orders eligible candidates by:

1. Lowest website-quality score.
2. Highest owner-reachability score.
3. Highest sales-fit confidence.
4. Highest audit confidence.

It publishes up to 50. A batch may contain fewer than 50 when the approved
micro-market does not contain enough qualified businesses.

The current Dizengoff Center production batch is not deleted. After the new
pipeline is deployed and verified, its still-uncontacted prospects are marked
`INVALID` with an operational reason and a replacement cycle is created for the
same seller. Existing interactions, audit history, and attribution remain
intact.

To support a replacement inside the same calendar week, cycles and batches gain
an integer `revision` starting at 1 plus nullable `supersededAt` and
`supersededReason` fields. Uniqueness changes from `weekStart` alone to
`[weekStart, revision]`. Seller reads choose the latest non-superseded published
batch ordered by `publishedAt`, while historical batches remain queryable by
admins.

## 10. Error handling

- Territory hard-validation failure creates a bounded replacement proposal and
  records the rejection reason.
- Sales-fit AI failure follows the existing bounded retry policy and then moves
  the prospect to `FAILED_REVIEW`; it never defaults to eligible.
- A Places detail failure affects only one prospect and is retryable.
- A missing phone at publication excludes the prospect.
- A missing phone at seller-read time is shown as a live-data problem and never
  mislabeled as “no phone”.
- A denied chain/franchise remains terminal for that cycle and cannot re-enter
  through website score ordering.

## 11. Testing

Automated tests must cover:

- Territory proposals accept commercial streets and open local centers.
- Malls, large complexes, generic city areas, and duplicate territories fail
  deterministic validation.
- Chain, franchise, institutional, and prohibited-category candidates are
  terminally excluded.
- Independent high-confidence candidates pass; uncertain candidates fail
  closed.
- Rating/review count alone never proves independence or causes exclusion.
- Partial Places failures preserve successful details for other prospects.
- Seller serialization distinguishes unavailable live data from a real missing
  phone or website.
- Audited-domain website fallback is safe and correctly normalized.
- Publisher requires both sales-fit and website gates and never dilutes
  thresholds to reach 50.
- Existing suppression, score-5 exclusion, assignment, call outcomes, and
  promotion behavior remain intact.

Production verification must include:

- Full unit suite, lint, and production build.
- One bounded test proposal whose territory passes the new validator.
- A small controlled discovery sample confirming chain exclusion and partial
  live-detail resilience.
- Seller-page inspection with real public phone, website, map, business
  context, and fallback states.
- Only after those checks: invalidate the untouched Dizengoff prospects and
  run the replacement cycle.

## 12. Rollout and rollback

- Implement on `fix/prospecting-sales-fit`.
- Keep `PROSPECTING_ENABLED` and the existing admin kill switch.
- Apply the database migration before application deployment.
- Do not invalidate the current batch until production code and live-provider
  behavior are verified.
- If verification fails, enable the kill switch and leave the existing batch
  and history unchanged.
- Rollback application code without dropping the new nullable sales-fit fields.
