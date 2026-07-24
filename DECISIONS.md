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

## 2026-07-23 — Separate website opportunity from sales fit

**Status:** Accepted for production rollout.

### Decision

A cold prospect must pass two independent gates:

1. Website opportunity: the existing deterministic score is 0 through 4.
2. Sales fit: the business is likely independent, confidence is at least 0.80, owner reachability is at least 70, and a public business phone exists.

Territory selection is changed from a generic compact area to a named commercial street or open local commercial center. Broad areas, malls, chain-dominated centers, campuses, institutions, industrial zones and logistics centers are prohibited.

Chains and franchises are excluded completely. A versioned deterministic denylist and prohibited business types catch high-certainty cases. A bounded structured AI assessment handles the remaining ambiguous public evidence and fails closed to `UNCERTAIN`.

### Public business data

The seller receives public business phone, website, map, category, address, rating/review context and opening hours. Google content remains live and is not stored. Each Place Details request fails independently, so one bad response cannot erase the rest of the list. The independently audited domain is the website fallback.

No private owner name, mobile number, email or other personal contact is discovered or inferred.

### Batch replacement

Cycles and batches are revisioned by `[weekStart, revision]`. An unsuitable published batch is superseded rather than deleted. Only untouched prospects are invalidated; calls, audits, promoted leads and attribution remain intact. The seller reads the latest non-superseded batch.

### Rationale

The Dizengoff Center batch optimized for website weakness but included businesses whose purchasing decision is controlled by a chain or large organization. That is not a usable cold-sales list. The new model optimizes for both a solvable website problem and a realistic path to the person who can approve the purchase.

## 2026-07-23 — Unify the commercial lead lifecycle

**Status:** Accepted for implementation behind feature flags.

### Decision

Every published cold prospect becomes a canonical commercial lead immediately. `Prospect` remains the one-to-one research and website-audit record; the existing `ContactSubmission` table is extended as the canonical lead store. The previous rule that created a `ContactSubmission` only after seller-recorded interest is superseded.

Leads carry two independent source dimensions:

- Immutable business intent: `OUTBOUND`, `AD_RESPONSE`, or `INBOUND`.
- Extensible technical channel such as `google_maps`, `meta_lead_ads`, `website`, or `google_search_ads`.

Seller views remain source-specific because the work differs: outbound leads require preparation, ad responses require fast follow-up, and customer-initiated leads receive the highest priority. All views write to the same lifecycle, ownership, notes, follow-up, agreement and event models.

Ownership is exclusive and claimed atomically. A lead is `WON` only after the first successful payment; agreement creation, sending and signing remain separate stages. Notes are company CRM data rather than private seller notes. Every material transition is written to an append-only lead event log.

Cardcom callback bodies are untrusted notifications, not payment proof. A first-charge callback is mapped only through the stored LowProfile attempt, then the server pulls the result from Cardcom’s authenticated `LowProfile/GetLpResult` endpoint and verifies the LowProfile ID, agreement `ReturnValue`, charged amount and provider transaction ID before writing `COMPLETED`, `WON` or commission data. A provider-read failure is retryable and never falls back to callback values.

Source ingestion is idempotent by the composite identity `(sourceKey, externalLeadId)`, so the same raw provider ID may legitimately exist under two different channels without collision. Historical Meta sync preserves the provider occurrence time and suppresses fresh-lead notifications and SLA escalation; a sync replay cannot masquerade as a new inquiry.

Lead, note, interaction, follow-up, Agreement and commission lifecycle writes are restricted to an explicit domain-writer allow-list. Product routes delegate to those writers, destructive deletes return `405`, and migration-only repair primitives are callable only from the audited resolver script. UI rollback flags are read on the server and switch interfaces only; canonical write invariants remain active in both legacy and unified views.

Ambiguous legacy source, stage or ownership is never inferred. Such rows remain `migrationReviewRequired`, admin-only and excluded from seller queues until an admin supplies a complete reasoned resolution. Database hardening is two-phase: additive nullable columns and compatibility indexes first, then idempotent backfill/reconciliation and only afterward composite uniqueness, partial indexes and required canonical fields. The final Prisma nullability/schema sync is a separate commit after every deployed database is hardened.

### User experience

The seller sees only the final assigned cold list and does not participate in research approval or scoring. Public business phone and the existing website are actionable in both seller and admin interfaces. Google phone data remains live by Place ID rather than being persisted; first-party or seller-confirmed contact data may be stored with provenance. Cold-lead preparation shows source context, the current site, the Fuzion audit and concrete call angles before dialing.

The canonical-Lead design narrowly supersedes the earlier no-storage rule for Google’s public business `displayName`: publication persists it as `ContactSubmission.company` so the Lead retains a stable business identity and remains understandable during a Google outage. Google phone, address, category, opening hours, ratings and raw payload remain live and non-persisted.

The feature changes information hierarchy and behavior only. It reuses the existing admin/seller shell, components, RTL behavior and existing pink/cyan/gray tokens. The admin and seller root layouts keep their current Heebo runtime font; components that already opt into Birzia/Meruba/Anomalia retain those local classes. It does not introduce a new visual language or modify global design tokens.

### Rationale

Promoting a prospect only after interest splits one sales journey across two records and discards reliable funnel data before qualification. A canonical lead from publication preserves source attribution, claim history, failed contact attempts, notes, follow-ups, loss reasons, agreements and payment conversion without forcing the seller into research decisions.

### Reversibility

Schema changes are additive and the new UI and domain flow remain behind independent server-only feature flags. Legacy fields and routes are retained through the migration window. Disabling the flags restores the prior interface without deleting the new audit history or bypassing canonical writers. Code must never be rolled back to a version that does not understand the additive schema; the ordered rollout and recovery gates are defined in `docs/LEAD_LIFECYCLE_RUNBOOK.md`.

## 2026-07-23 — Fail closed on payment proof and revoked access

**Status:** Accepted for the unified-lifecycle rollout.

### Decision

First-payment lifecycle state is derived only from immutable evidence copied from an authenticated Cardcom `GetLpResult` read: LowProfile ID, Agreement `ReturnValue`, provider transaction ID, paid amount and verification time. `GetLpResult` uses its documented `POST` JSON transport and is not routed through the recurring APIs' GET-with-body client. Historical `COMPLETED` or `paidAt` fields without that full evidence never create `WON` or commission state. Backfill, reconciliation, migration linking and admin migration resolution all use the same evidence classifier and leave ambiguous rows in review.

Recurring charges from the legacy callback, the dedicated callback and the authenticated reconciliation cron share one Serializable writer. A unique provider charge key deduplicates the financial event, while a revenue marker is committed atomically with the Client/Product increment. Existing legacy charge rows are classified conservatively; ambiguous revenue provenance is flagged for finance review rather than incremented.

Session role claims are not sufficient for sensitive operations. Seller claim and admin Agreement/contact/client/finance reads, client mutations and billing actions re-check the persisted role before reading or mutating scoped data. Exhausted claim serialization retries remain failures instead of being converted to success by an unguarded owner read. Reassignment removes operational phone and signing-token access from the former seller while preserving earned commission history. `DO_NOT_CALL` suppression covers canonical and live public identities without storing raw phone data in the event log, and the whole interaction transaction fails closed when the suppression hash secret is absent.

### Rationale

Local status fields, replayable callback bodies and stale sessions are not authoritative evidence. Centralizing payment writes and checking current database authorization prevents duplicate revenue, fabricated conversion state and access that outlives a role or ownership change.

### Reversibility

The evidence and recurring-idempotency columns are additive and nullable for legacy data. The application remains fail-closed if evidence or secrets are absent. UI flags can still restore the prior screens, but payment proof, canonical suppression and persisted-role checks are invariant and are not disabled by UI rollback.

## 2026-07-24 — שלוש דרגות חום לליד, ורשימת לידים אחת לכל תפקיד

**Status:** Accepted.

### Decision

לכל ליד יש בדיוק אחת משלוש דרגות חום, והיא הממד הראשון שאדם רואה — לפני שם, לפני מקור:

| דרגה | `intentLevel` | משמעות | ערוץ נוכחי |
|---|---|---|---|
| 🧊 ליד קר | `OUTBOUND` | אנחנו יזמנו | אוטומציית Google Maps |
| 🌤️ ליד בינוני | `AD_RESPONSE` | הלקוח השאיר פנייה חפוזה על מודעה | Meta Lead Ads |
| 🔥 ליד חם | `INBOUND` | הלקוח חיפש אותנו | פה-לאוזן היום, Google Search בעתיד |

ערוץ טכני חדש (`sourceKey`) ממופה לאחת משלוש הדרגות — לא ממציאים "סוג ליד" רביעי.

בהתאם: רשימת לידים **אחת** לכל תפקיד. `/seller/cold-leads` הפך ל-redirect אל `/seller/leads` (שמציג את שלוש הדרגות עם טאבי חום); באדמין `/admin/leads` הוא הרשימה היחידה, ו-`/admin/prospecting` נשאר כדף תפעול המנוע ("אוטומציית גוגל") — מכונה, לא לידים.

### Rationale

פיצול לפי מקור כפה על אותו איש מכירות שתי רשימות עבודה ושבר את המבט האחד על המשפך. דרגת החום היא ההקשר המכירתי האמיתי (איך פותחים שיחה, כמה דחוף לענות); המקור הוא רק שדה משני.

### Reversibility

UI בלבד — הנתונים (`intentLevel`, `sourceKey`) לא השתנו. ה-routes הישנים של cold-leads נשארו כ-redirect/compat.

## 2026-07-24 — הסטטיסטיקה של הלידים היא רשומה קבועה. לא נוגעים.

**Status:** Accepted. כלל ברזל.

### Decision

לידים היסטוריים, שלביהם (stage), אירועיהם (LeadEvent) ותיוג המוצר שלהם
(service) הם רשומה סטטיסטית קבועה של העסק. **אסור למחוק, לדרוס או "לנקות"
אותם** — לא בסקריפט, לא במיגרציה, לא בתיקון UI. שינוי תצוגה לעולם לא מצדיק
שינוי דאטה. ליד שגוי מסומן ספאם — לא נמחק.

חריג יחיד: מחיקה מפורשת שאלעד מבקש, ורק אחרי ארכוב מלא (כמו איפוס ריצת
ה-prospecting הראשונה ב-24.7 — `docs/archives/prospecting-run1-2026-07.md`).

קו הבסיס למדידה: `docs/archives/lead-stats-baseline-2026-07-24.md`.

### Rationale

האנליטיקות העתידיות (conversion לפי מקור/מוצר/מוכר, תקרות תקציב פרסום,
תחזיות MRR) נבנות על הרצף ההיסטורי. כל "ניקיון" שקוטע אותו הופך את המדידה
לניחוש. הפחד של 24.7 ("כל המידע נעלם") נבע מתצוגות שגויות — הדאטה הייתה
שלמה, וכך זה חייב להישאר.

## 2026-07-24 — ריצת prospecting 3: יעד 20, סינון ריצות 1+2, ביטול קרון יום ראשון

**Status:** Accepted.

### Decision

1. **ריצה 3 מופעלת ידנית** (טריגר על `/api/cron/prospecting-propose` עם
   CRON_SECRET) עם `prospecting:weeklyTarget = 20` (ירד מ-50). זהו מבחן
   השבוע הראשון; בסופו אלעד מחליט אם ובאיזה קצב ממשיכים.
2. **סינון ריצות 1+2:** כל 158 ה-placeIds מדיזנגוף סנטר ומשדרות דואני יבנה
   נזרעו ל-`ProspectSuppression` (`scripts/seed-prospect-suppression-runs12.mjs`),
   כך שה-discovery וה-publish לא יעלו אותם שוב. placeId בלבד —
   phone/domain hashes דורשים את `PROSPECTING_HASH_SECRET` שנשאר בפרודקשן.
3. **קרון יום ראשון (`0 6 * * 0`) הוסר מ-vercel.json.** אין הצעת טריטוריה
   אוטומטית שבועית עד החלטה מחודשת. ה-route נשאר קיים — הרצה עתידית היא
   טריגר ידני או החזרת השורה. ה-worker (כל 10 דק') וה-maintenance נשארו.

### Incident שנלמד

סקריפט האיפוס (`reset-cold-and-cleanup.mjs`) הורץ פעמיים; הריצה השנייה
דרסה את קובץ הארכיון עם snapshot ריק. הארכיון שוחזר מ-pg_dump של 23.7
(`~/Documents/fuzion-recovery-2026-07-23/prospecting-runs-1-2-recovered-from-dump.json`)
והסקריפט קיבל הגנת אי-דריסה. כלל: סקריפט archive-then-delete לעולם לא
דורס ארכיון קיים.

### Reversibility

החזרת הקרון = שחזור 4 שורות ב-vercel.json. הסרת הסינון = מחיקת שורות
ה-suppression עם ה-reason הייעודי. היעד חוזר דרך `prospecting:weeklyTarget`.
