# Reverse-Engineering Analysis — Fuzion Webz

> **System under analysis**
> - **Live URL:** https://www.fuzionwebz.com/
> - **Codebase:** `~/Desktop/fuzion-webz` (mounted at `/Users/eladnissim/Desktop/fuzion-webz`)
> - **Generated:** 2026-05-07T07:57:03Z
> - **Note:** The live URL was **not directly reachable** from the analysis sandbox (`www.fuzionwebz.com` is not on the egress allowlist; `cowork-egress-blocked`). `WebSearch` for `site:fuzionwebz.com` returned zero results. All "live surface" claims below are therefore **inferred from the codebase** (route tree, sitemap config, JSON-LD, metadata) rather than observed in a browser. See **Open Questions** for items that would normally require live verification.

---

## 1. TL;DR

`fuzion-webz` is a **Hebrew, RTL, single-tenant Next.js 16 application** that serves two surfaces from one codebase:

1. A **public marketing site** for an Israeli boutique web-design studio ("Fuzion Webz") — homepage with animated/3D hero, services, pricing, portfolio, blog, FAQ, fonts store, contact, legal pages.
2. An **internal admin dashboard** at `/admin/*` for the two co-founders (Roy Yehezkel, Elad Nissim — `prisma/seed.ts:9-28`) that runs the agency itself: CRM (clients/leads/contacts), agreements with e-signature + recurring billing, blog content pipeline, font store + orders, SEO data sync (Google Search Console + GA4), Facebook Lead Ads ingestion, internal task management with web-push notifications, partner profit-sharing report.

It is hosted on **Vercel** (`vercel.json`, `@vercel/speed-insights` in `package.json:36`), backed by **PostgreSQL via Prisma** (`prisma/schema.prisma:5-9`), with **NextAuth v5** Credentials-only auth (`src/lib/auth.ts:1-69`) and three nightly **Vercel cron jobs** (`vercel.json:1-16`).

---

## 2. Tech stack

| Concern | Choice | Evidence |
|---|---|---|
| Framework | **Next.js 16.2.1** (App Router, React Server Components) | `package.json:45` |
| Language | TypeScript 5, strict mode, `@/*` path alias to `./src/*` | `tsconfig.json:7,21-23` |
| UI | **React 19.2.4**, Tailwind CSS 4 (PostCSS), `tailwind-merge`, `clsx` | `package.json:48-49,53,59,68` |
| Animation | **Framer Motion 12**, **GSAP 3.14**, **Lenis** smooth scroll, **Lottie** | `package.json:41-44` |
| 3D | **Three.js 0.183**, **@react-three/fiber 9**, **@react-three/drei 10** | `package.json:25-26,54` |
| Charts | **Recharts 3** (revenue, partner-report) | `package.json:51` |
| Drag-and-drop | **@dnd-kit/core**, **sortable** (task reorder, Kanban) | `package.json:21-23`, `src/app/api/tasks/reorder/route.ts` |
| Rich-text editor | **Tiptap 3** (StarterKit + Image + Link + Placeholder) | `package.json:28-33`, `src/components/admin/BlogEditor.tsx:3-7` |
| ORM / DB | **Prisma 5.22** + **PostgreSQL** (separate `DATABASE_URL` and `DIRECT_URL` — pooled vs direct) | `package.json:24,67`, `prisma/schema.prisma:5-9`, `.env.example:2-3` |
| Auth | **NextAuth v5 beta.30** Credentials provider, JWT 24h sessions, bcryptjs hashing | `package.json:46`, `src/lib/auth.ts:6-69` |
| Email | **Resend** | `package.json:52`, `src/lib/email.ts:1` |
| Push | **web-push** + VAPID + service worker | `package.json:55`, `src/lib/push.ts:1-19`, `public/sw.js`, `src/components/pwa/ServiceWorkerRegister.tsx` |
| Payments | **Cardcom** LowProfile v11 (REST) + BillGoldService (legacy SOAP) for recurring | `src/lib/cardcom.ts:1-44`, `.env.example:34-39` |
| Validation | **Zod 4** | `package.json:56`, `src/lib/validations.ts` |
| Sanitization | **DOMPurify 3** (used to clean Tiptap HTML before rendering) | `package.json:40` |
| SEO sitemap | **next-sitemap** (post-build) | `package.json:47`, `next-sitemap.config.js:1-12` |
| Analytics | **Google Analytics 4** (gtag) public-site only + **Vercel Speed Insights** | `src/components/seo/GoogleAnalytics.tsx:6-29`, `src/app/layout.tsx:2,60` |
| Lint | ESLint 9 + `eslint-config-next` | `eslint.config.mjs`, `package.json:65-66` |
| Hosting | Vercel (env-injected build SHA, cron, speed insights) | `next.config.ts:5-8`, `vercel.json` |

---

## 3. Information architecture (public surface)

Based on the App-Router file tree under `src/app/(public)/`:

| Path | Purpose | File |
|---|---|---|
| `/` | Marketing homepage (Hero → HowItWorks → AboutUs → Services → Portfolio → Pricing → Contact, separated by Marquees) | `src/app/(public)/page.tsx:11-29` |
| `/about`, `/about/[slug]` | About page + per-team-member pages | `src/app/(public)/about/page.tsx`, `…/about/[slug]/page.tsx` |
| `/blog`, `/blog/[slug]` | Blog index + post detail | `src/app/(public)/blog/…` |
| `/portfolio`, `/portfolio/[slug]` | Portfolio index + project case-study | `src/app/(public)/portfolio/…` |
| `/fonts`, `/fonts/[slug]` | Font store catalogue + family page | `src/app/(public)/fonts/…` |
| `/fonts/download/[token]` | Token-gated font download (post-purchase) | `src/app/(public)/fonts/download/[token]/page.tsx` |
| `/contact` | Contact form (public POST → `/api/contacts`) | `src/app/(public)/contact/page.tsx`, `src/app/api/contacts/route.ts:8-48` |
| `/faq` | FAQ (own layout) | `src/app/(public)/faq/{layout,page}.tsx` |
| `/accessibility`, `/privacy`, `/terms` | Legal | `src/app/(public)/{accessibility,privacy,terms}/page.tsx` |
| `/agreement/[token]` | **Public** agreement-signing page (token in URL, no login) | `src/app/agreement/[token]/page.tsx:30-54` |
| `/agreement/[token]/pdf` | PDF view of the same agreement | `src/app/agreement/[token]/pdf/page.tsx` |
| `/payment/success`, `/payment/failed` | Cardcom redirect targets | `src/app/payment/{success,failed}/page.tsx` |
| `/admin/login` | Login (public) | `src/app/admin/login/page.tsx` |
| `/admin/*` | Authenticated dashboard (see §10) | `src/app/admin/(dashboard)/…` |

The whole site is **Hebrew/RTL**: `<html lang="he" dir="rtl">` (`src/app/layout.tsx:56`); locale `he_IL` for OpenGraph and `he-IL` canonical alternate (`src/app/layout.tsx:25,40`).

---

## 4. Repo layout

```
fuzion-webz/
├── prisma/                    # schema (533 LOC), seed, seed-clients
├── public/                    # static assets — logo SVGs, manifest.json, sw.js,
│                              #   offline.html, fonts/, images/, icons/, v10.glb (3D model),
│                              #   rosendal_park_sunset_puresky_1k.hdr (3D env map)
├── scripts/                   # 18 ad-hoc *.mjs / *.ts maintenance scripts (data backfill,
│                              #   blog publishing, client renumbering, FB status check, etc.)
├── seo/                       # ad-hoc SEO assets (separate from the next-sitemap output)
├── src/
│   ├── middleware.ts          # auth + rate-limit edge middleware (102 LOC)
│   ├── app/
│   │   ├── layout.tsx         # root: lang=he dir=rtl, metadata, SpeedInsights, SW reg
│   │   ├── (public)/          # public-site route group (own layout w/ Navbar/Footer/etc)
│   │   ├── admin/
│   │   │   ├── login/         # /admin/login
│   │   │   └── (dashboard)/   # auth-gated dashboard (own layout w/ AdminSidebar)
│   │   ├── agreement/[token]/ # public e-sign flow (token-gated)
│   │   ├── payment/           # Cardcom redirect landing pages
│   │   └── api/               # 81 API route handlers (see §8)
│   ├── components/
│   │   ├── admin/             # AdminSidebar, BlogEditor (Tiptap), NotificationBell,
│   │   │                      #   AssigneePicker, RevenueChart, PushNotificationToggle, …
│   │   ├── animations/        # CustomCursor, Loader, GridBackground, Marquee, ScrollReveal,
│   │   │                      #   ParallaxLayer, MagneticButton, ChromaticText, CountUp, LogoSVG
│   │   ├── three/             # HeroGlass (custom GLSL shaders + SVGLoader of the F glyph),
│   │   │                      #   HeroGlassWrapper, scene.ts
│   │   ├── sections/          # Public-site sections (Hero, Services, …, Contact)
│   │   ├── layout/            # Navbar, TopNav, MobileMenu, Footer
│   │   ├── seo/               # JsonLd (Organization/LocalBusiness/WebSite/FAQ), GoogleAnalytics
│   │   ├── shared/            # WhatsAppButton, AccessibilityWidget, CookieConsent, RelatedContent
│   │   ├── pwa/               # InstallPrompt, ServiceWorkerRegister
│   │   ├── ui/                # Button, Card, Modal, Input, Badge, ConfirmSheet, PullToRefresh, …
│   │   └── svg/               # inline SVG components
│   ├── lib/                   # 25 lib modules (see §11)
│   ├── hooks/                 # useInView, useMousePosition, useScrollDirection
│   ├── styles/                # globals.css imported from app/layout.tsx
│   └── types/                 # shared TS types
├── docs/                      # in-repo docs
├── .env.example               # template (see §12 for what's expected)
├── next.config.ts             # security headers + CSP (see §13)
├── next-sitemap.config.js     # sitemap/robots (excludes /admin/* and /api/*)
├── vercel.json                # 3 cron jobs (seo-sync, blog-publish, facebook-sync)
└── *.md prompt files          # CLAUDE_CODE_PROMPT, DEPLOY_PROMPT, GRID_PATTERN_PROMPT, … —
                               #   ad-hoc prompt scratchpads kept in repo, not used at runtime
```

The root contains many `*_PROMPT.md` files (`CLAUDE_CODE_PROMPT.md`, `DESIGN_FIX_PROMPT.md`, `HERO_3D_PROMPT.md`, `SEO_TECHNICAL_PROMPT.md`, …) and two WhatsApp screenshots — these look like **personal prompt-engineering scratchpads** kept in the repo, not part of the running app.

---

## 5. Routing & rendering

**App Router with three route groups:**

- `(public)` — public marketing site, wrapped in `src/app/(public)/layout.tsx:15-85` which renders `Navbar`, `TopNav`, `Footer`, `WhatsAppButton`, `AccessibilityWidget`, `CookieConsent`, `Loader`, `CustomCursor`, `GridBackground`, plus `<GoogleAnalytics />`, `<OrganizationJsonLd />`, `<WebSiteJsonLd />`. Uses a **fixed inset frame design**: black canvas at `inset-[5px]` with rounded corners, content scrolls inside that frame.
- `admin/(dashboard)` — authenticated dashboard, wrapped in `src/app/admin/(dashboard)/layout.tsx:9-58` which calls `await auth()` server-side and `redirect("/admin/login")` if missing; renders `AdminSidebar`, sticky header with `NotificationBell`, `InstallPrompt` (PWA), `ConfirmSheetHost`, `AdminToaster`.
- `admin/login` — bare login outside the dashboard group.

The root `src/app/layout.tsx:50-65` is a thin shell: `<html lang="he" dir="rtl">`, `SpeedInsights`, `ServiceWorkerRegister`. Both surfaces share global metadata: title template `"%s | Fuzion Webz"`, `metadataBase: https://www.fuzionwebz.com`, `appleWebApp.title: "FW Admin"` (`src/app/layout.tsx:6-43`).

Many API routes pin `export const dynamic = "force-dynamic"` and `export const maxDuration = N` (e.g. `src/app/api/cron/seo-sync/route.ts:1,5` — `maxDuration = 300`), and the agreement-signing page uses `force-dynamic` to never cache token-bearing URLs (`src/app/agreement/[token]/page.tsx:6`).

---

## 6. Auth & access control

**Single layered model**: edge middleware → page-level `auth()` checks.

**`src/lib/auth.ts:6-69`** — NextAuth v5:
- Single provider: **Credentials** (email + bcrypt password hash from `User.passwordHash`).
- Session strategy: **JWT, 24h** (`maxAge: 24 * 60 * 60`).
- Login page: `/admin/login`.
- JWT callback persists `user.id` and `user.role` into the token; session callback re-exposes them.

**`src/middleware.ts:5-103`** — runs on `/admin/:path*` and `/api/:path*` (line 100-102):
1. Rate-limits all `POST/PATCH/DELETE` to **30 requests/min/IP** via in-memory `Map` (`src/lib/rate-limit.ts:1-22`). **In-process only** — does not survive across serverless instances; effective only when the same IP hits the same warm instance.
2. **Whitelist of public endpoints** that bypass auth:
   - `/api/auth/*` (NextAuth)
   - `/api/agreements/sign/*` (token-gated public e-sign)
   - `/api/version` (used by the in-app version-tag refresh button)
   - `/api/webhooks/facebook` (Meta lead-form callback — verified by `hub.verify_token`)
   - `/api/payments/webhook` (Cardcom server-to-server callback)
   - `/api/cron/*` (each handler enforces its own `vercel-cron` UA + `CRON_SECRET` check)
   - `POST /api/contacts` (public contact form)
   - `GET /api/blog/*` and `GET /api/fonts/*` not under `/admin`
3. Everything else under `/api/*` requires session **AND** `user.role === "ADMIN"` (returns 401 / 403).
4. `/admin/*` (except `/admin/login`) requires session **AND** `role === "ADMIN"`; otherwise redirects to login (with `callbackUrl`) or back to `/`.

**Two-role model** (`prisma/schema.prisma:11-14`): `ADMIN` and `MEMBER`. In practice, **only ADMIN gets in** anywhere — `MEMBER` would pass the auth check but fail the role check on every protected route. The `assignedTasks` / `notifications` logic supports multiple users (assignees, recipients), but the seed only creates two ADMINs (`prisma/seed.ts:9-30`).

**Public agreement signing** is a separate path: the user lands at `/agreement/[token]`, where `token === Agreement.signToken` (cuid-generated, `prisma/schema.prisma:354`), reads the agreement server-side, and signs via `POST /api/agreements/sign/[token]`. After signing, the flow continues into Cardcom for payment.

---

## 7. Data model (Prisma)

`prisma/schema.prisma` — 533 LOC, 22 models, 1 datasource (PostgreSQL with separate `DATABASE_URL` pooled and `DIRECT_URL`), 11 enums.

**Models grouped by concern:**

- **Identity/auth:** `User` (`schema.prisma:84-105`) — email, name, passwordHash, role, plus inverse relations to almost every other model (assigned tasks, comments, notifications, blog posts, integrations, push subscriptions, contact/client notes, UTM links).
- **Internal task tracking:** `Project`, `Task` (with assignees many-to-many, creator, comments, notifications, `tags: String[]`, `order: Int` for drag-and-drop reordering), `Comment`, `Notification` (`NotificationType`: TASK_ASSIGNED / TASK_UPDATED / TASK_COMMENTED / CONTACT_RECEIVED / AGREEMENT_SIGNED).
- **Inbound leads:** `ContactSubmission` (line 178-205) — name/email/phone/message, plus **external lead** fields (`externalLeadId @unique`, `externalFormId`, `externalCampaignId`, `externalAdId`, `source`) for Facebook Lead Ads ingestion, status enum (NEW/IN_PROGRESS/CLOSED/SPAM), follow-up timestamps; with `ContactNote` for internal notes.
- **CRM:** `Client` (line 296-325) — auto-incrementing `number`, status (free-form), notes, **financials** (`amount`, `expense`, `cardcomFee`), `partner` field (`"fuzion"` vs other) for the partner-report split, `archivedAt` for soft-delete; `ClientNote` for per-client notes.
- **Sales / contracts:** `Agreement` (line 339-385) — tier (BASIC/ADVANCED/PREMIUM), `additionalServices: String[]`, `monthlyPrice`, `oneTimeFee`, customer details, status (DRAFT/SENT/SIGNED/CANCELLED), `signatureData` (base64 canvas signature), `signToken @unique` for the public sign URL, **legal trail** (`signedIp`, `signedUserAgent`, `documentVersion`), and a complete **Cardcom integration block**: `paymentStatus`, `paymentUrl`, `paymentId`, `cardcomDealId`, `cardcomToken`, `cardcomRecurringId`, `cardcomLowProfileId`, `cardcomAccountId`, `invoiceNumber`, `paidAmount`. Each charge logs to `AgreementCharge` (line 387-401) with raw webhook payload for debugging.
- **Blog:** `BlogPost` (line 223-254) — slug, Tiptap-HTML `content`, cover, category, tags, SEO meta (`metaTitle`, `metaDesc`), and a **content pipeline**: `status: BlogPostStatus` (DRAFT/READY/SCHEDULED/PUBLISHED/ARCHIVED), `scheduledAt`, `targetKeyword`, `keywords[]`, `contentScore`, `lastReviewedAt`, `reviewNotes`.
- **Font store:** `FontFamily` → `FontStyle` (per weight, with `pricePersonal`/`priceCommercial`); `FontOrder` (line 403-423) tracks customer info, `LicenseType` (PERSONAL/COMMERCIAL), payment status, currency `ILS`, **`downloadToken @unique`** for the post-purchase token-gated download URL, `downloadCount`, `expiresAt`.
- **SEO:** `GoogleIntegration` (line 429-442) — per-user OAuth tokens (**AES-256-GCM encrypted at rest**, scopes saved, `gscSiteUrl`, `ga4PropertyId`), `SeoSnapshot` (daily aggregate clicks/impressions/ctr/position + GA4 organic/referral sessions), `SeoQuery` (per-query 28-day rollup unique on `(query, windowStart)`), `Backlink` (unique on `(sourceDomain, targetUrl)`), `UtmLink` (UTM builder with click counts).
- **Push:** `PushSubscription` (endpoint @unique, p256dh, auth, userAgent).
- **Facebook:** `FacebookIntegration` — pageId @unique, encrypted `pageAccessToken`.

**Note on encryption:** OAuth/page tokens are stored encrypted via `src/lib/crypto.ts:18-25` (AES-256-GCM, IV+tag prefix, base64). The key comes from `OAUTH_ENCRYPTION_KEY` and is **passed through `sha256` first** (`crypto.ts:14`), so any string of any length becomes a valid 32-byte key.

---

## 8. API surface (81 route handlers)

Counted: `find src/app/api -name route.ts | wc -l` → **81**. Grouped:

| Group | Count | Notable routes |
|---|---|---|
| `agreements/` | 6 | CRUD + `sign/[token]` (public) + `sign/[token]/payment` + `fix-lowprofile` + `retry-recurring` + `[id]/download` |
| `blog/` | 8 | CRUD + `bulk-create`, `bulk-schedule`, `pipeline`, `review`, `auto-publish`, `schedule/[id]`, `edit/[id]` |
| `clients/` | 5 | CRUD + `[id]/notes` + `[id]/archive` + `bulk-urls` |
| `comments/` | 2 | task comments |
| `contacts/` | 3 | public POST + admin GET/list + bulk + per-id |
| `cron/` | 3 | `seo-sync`, `blog-publish`, `facebook-sync` (called by Vercel Cron) |
| `dashboard/` | 2 | `stats`, `my-tasks` (consumed by the dashboard page) |
| `fonts/` | 7 | catalogue read + `checkout` + `download/[token]` + `admin/*` (CRUD, styles, orders, upload) |
| `integrations/facebook/` | 7 | OAuth `connect`/`callback`, `disconnect`, `pages`, `subscribe`, `sync`, `status` |
| `leads/` | 3 | leads CRUD + `[id]/notes` (likely the same data as contacts but different lens) |
| `notifications/` | 2 | list + per-id (mark read/delete) |
| `partner-report/` | 1 | snapshot of active recurring clients with VAT (18%) and Cardcom fee (2%) deducted, profit split 50/50 |
| `payments/` | 2 | `create` (LowProfile init) + `webhook` (Cardcom S2S callback — public) |
| `push/` | 4 | `subscribe`, `unsubscribe`, `status`, `test` |
| `seo/` | 14 | `connect`/`callback`/`disconnect`/`configure`/`status`, `sites`, `pages`, `queries`, `referrals`, `backlinks`, `opportunities`, `snapshots`, `utm`, `refresh` |
| `tasks/` | 4 | CRUD + `[id]/comments` + `reorder` (drag-and-drop) |
| `users/` | 1 | list (probably for assignee picker) |
| `version/` | 1 | exposes `NEXT_PUBLIC_BUILD_SHA`/`BUILD_TIME` for the in-app version refresh button |
| `webhooks/facebook/` | 1 | Meta lead-ads webhook (GET verify + POST events) |
| `auth/[...nextauth]` | 1 | NextAuth handlers |

**Conventions across handlers** (sample: `src/app/api/contacts/route.ts:1-83`):
- Each file exports the Next.js `route.ts` HTTP verb functions (`GET`, `POST`, `PATCH`, `DELETE`).
- Auth is rechecked **inside** the handler with `await auth()` even though the middleware already gates it (defensive double-check).
- Input validated with **Zod schemas** from `src/lib/validations.ts` (`createContactSchema.safeParse(...)`, contacts/route.ts:21).
- Pagination is `?page=&limit=` capped at 100 (contacts/route.ts:59-61).
- Dynamic execution forced (`export const dynamic = "force-dynamic"`) on routes that touch the DB.
- **Honeypot** on the public contact form: a `_hp` field in the body silently returns a fake 201 (contacts/route.ts:13-15).
- After successful contact creation, every admin is notified via `notifyAllAdmins({ type: "CONTACT_RECEIVED", … })` (contacts/route.ts:34-38) — which inserts a Notification row **and** fires web-push (`src/lib/notifications.ts:36-50`).

---

## 9. Background jobs (Vercel Cron)

`vercel.json:1-16` declares three crons:

| Schedule | Path | Purpose |
|---|---|---|
| `0 3 * * *` (daily 03:00 UTC) | `/api/cron/seo-sync` | For every `GoogleIntegration` with a `gscSiteUrl`, pulls Search Console daily stats + queries (28-day window, 3-day GSC lag) and GA4 daily sessions; upserts into `SeoSnapshot` and `SeoQuery`. `maxDuration = 300`. (`src/app/api/cron/seo-sync/route.ts:1-39`, `src/lib/seo-sync.ts:1-80`) |
| `0 7 * * *` (daily 07:00 UTC) | `/api/cron/blog-publish` | Finds `BlogPost` rows with `status=SCHEDULED, scheduledAt<=now`, flips them to `PUBLISHED` + sets `publishedAt`. (`src/app/api/cron/blog-publish/route.ts:1-42`) |
| `0 6 * * *` (daily 06:00 UTC) | `/api/cron/facebook-sync` | Refreshes Facebook Lead Ads (likely catches up on any leads the webhook missed). |

**Cron auth pattern** (`seo-sync/route.ts:9-21`): accept any of:
- `User-Agent: vercel-cron`
- `Authorization: Bearer <CRON_SECRET>`
- ⚠️ if `CRON_SECRET` env var is **empty/unset, the route returns 200 to anyone** (because `expected = null` collapses the second OR-arm to `true`). Same code in `blog-publish/route.ts:11-13`. See **Open Questions**.

---

## 10. Admin dashboard (sidebar tour)

From `src/components/admin/AdminSidebar.tsx:9-130+` — the left nav holds **exactly 13 items** (verified: 13 `label:` entries in the file):

1. **דשבורד** `/admin` — KPI cards (`activeTasks`, `myOpen`, `dueThisWeek`, `newMessages` from `/api/dashboard/stats`), "My open tasks" list with optimistic mark-done (`src/app/admin/(dashboard)/page.tsx:33-65`), and `<RevenueChart />` (Recharts).
2. **משימות** `/admin/tasks` (+ `/new`, `/[id]`) — task list/Kanban; reorder via dnd-kit; comments per task.
3. **בלוג** `/admin/blog` (+ `/new`, `/[id]/edit`).
4. **צינור תוכן** `/admin/blog/pipeline` — status board (DRAFT → READY → SCHEDULED → PUBLISHED).
5. **פונטים** `/admin/fonts` (+ `/new`, `/[id]/edit`).
6. **הזמנות (פונטים)** `/admin/fonts/orders`.
7. **SEO** `/admin/seo` with own layout + sub-nav (`SeoSubNav`): `/keywords`, `/pages`, `/backlinks`, `/referrals`, `/utm`.
8. **לקוחות** `/admin/clients` (+ `/[id]`).
9. **הסכמים** `/admin/agreements`.
10. **דוח שותף** `/admin/partner-report` — current-state snapshot of every Client in `status="בוצע"` (lit. "done" / active recurring); per-row computes `vat = 18% inclusive`, `cardcomFee = 2% of amount`, `profit = amount - vat - cardcomFee`, `partnerShare = profit / 2` (`src/app/api/partner-report/route.ts:5-50`). Both partners get the same `partnerShare`; the UI renders two columns for clarity (route comment, lines 28-36).
11. **לידים** `/admin/leads`.
12. **הודעות** `/admin/contacts`.
13. **הגדרות** `/admin/settings`.
**Bonus (file-tree only, not in the sidebar):** `/admin/integrations/facebook/page.tsx` exists in the file tree but is not linked from the sidebar — likely reached from `/admin/settings`.

Top-bar shows the user initials, name, and **`<NotificationBell />`** (likely polls `/api/notifications`). Below the main area: **`<InstallPrompt />`** (PWA install banner), `<ConfirmSheetHost />` (mobile-style confirm sheet), `<AdminToaster />` (`react-hot-toast`).

The dashboard markup uses Tailwind classes like `bg-gray-900/80 backdrop-blur-md`, `safe-pt` (iOS safe-area utility), `pb-32 md:pb-6` ("extra bottom padding on mobile to clear FAB + home indicator", `layout.tsx:52`) — **mobile-first** even though it's an internal admin app.

---

## 11. Library layer (`src/lib/`)

| Module | Purpose |
|---|---|
| `prisma.ts` | Singleton `PrismaClient` with hot-reload guard (`prisma.ts:1-11`) |
| `auth.ts` | NextAuth v5 config (see §6) |
| `rate-limit.ts` | 30 req/min/IP, in-process Map, periodic cleanup (`rate-limit.ts:25-34`) |
| `crypto.ts` | AES-256-GCM encrypt/decrypt for OAuth tokens; key derived via SHA-256 of `OAUTH_ENCRYPTION_KEY` (`crypto.ts:1-30`) |
| `cardcom.ts` | Cardcom v11 LowProfile REST + legacy BillGoldService SOAP for recurring orders; `CardcomError` class; ~491 LOC (`cardcom.ts:1-44`) |
| `payments.ts` | Higher-level glue between agreements and Cardcom |
| `vat.ts` | VAT helpers (the partner report uses 18% inclusive; the live VAT helper applies the same rate) |
| `google-oauth.ts` | OAuth dance for Search Console + GA4; scopes hard-coded to `webmasters.readonly`, `analytics.readonly`, `userinfo.email` (`google-oauth.ts:4-8`) |
| `search-console.ts` | GSC API queries (daily stats, top queries, backlinks) |
| `analytics.ts` | GA4 Data API queries (daily sessions) |
| `seo-sync.ts` | Per-user `syncIntegration(userId)` that ties GSC + GA4 + Backlinks into snapshots/queries (`seo-sync.ts:1-80`) |
| `facebook.ts` | Meta OAuth, lead retrieval, webhook signature verification (HMAC, `timingSafeEqual`); ⚠️ **hardcoded fallback secrets** (see §13) |
| `notifications.ts` | `createNotification` writes a row + fires `sendPushToUser`; URL routing per `NotificationType` (`notifications.ts:12-30`) |
| `push.ts` | `web-push` wrapper, VAPID setup from env, removes 410-Gone subscriptions automatically (`push.ts:6-19`) |
| `email.ts` | Resend wrapper; recipient list `["roy@fuzionwebz.com", "elad@fuzionwebz.com"]` hardcoded; HTML escape helper (`email.ts:1-25`) |
| `agreement-templates.ts` | Tier-based agreement body composition |
| `validations.ts` | Zod schemas for inbound payloads |
| `csv-export.ts` | Generic CSV export |
| `import-urls.ts` | Bulk-URL ingestion for clients |
| `og-image.tsx` | OG image generation (Next.js `ImageResponse` style) |
| `constants.ts` | **Site-wide content as TS constants** — team bios, services, pricing tiers, FAQ, portfolio (`constants.ts:1-120+`). The marketing site reads these directly rather than from the DB. |
| `confirm.ts` | Imperative `confirm()` API backed by `<ConfirmSheetHost />` |
| `haptic.ts` | iOS-style haptic feedback wrapper (used on dashboard mark-done, `page.tsx:34`) |
| `analytics.ts`, `blog-slug.ts`, `env-values.ts`, `utils.ts` | Misc helpers |

---

## 12. Environment variables

`.env.example:1-39` defines the expected env. Categories:

- **Database:** `DATABASE_URL`, `DIRECT_URL` (Prisma pooled vs direct).
- **Auth:** `NEXTAUTH_SECRET`, `NEXTAUTH_URL=https://www.fuzionwebz.com`.
- **Seed:** `SEED_ADMIN_PASSWORD` (default in seed.ts is the literal `"FuzionAdmin2026!"` — `prisma/seed.ts:7`).
- **Public:** `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_WHATSAPP_NUMBER`, `NEXT_PUBLIC_WHATSAPP_MESSAGE` (Hebrew default), `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SITE_NAME`.
- **Token encryption:** `OAUTH_ENCRYPTION_KEY` (32-byte recommendation, but hashed to 32 bytes regardless).
- **Google:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`.
- **Meta:** `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`, `META_WEBHOOK_VERIFY_TOKEN`.
- **Cardcom:** `CARDCOM_TERMINAL`, `CARDCOM_API_NAME`, `CARDCOM_API_PASSWORD`, `CARDCOM_BILLGOLD_USERNAME`, `CARDCOM_BILLGOLD_PASSWORD`.

**Not in `.env.example` but referenced in code (so they need to be set in Vercel separately):**
- `CRON_SECRET` (cron handlers)
- `RESEND_API_KEY` (`email.ts:31`)
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`push.ts:8-13`)
- `FACEBOOK_LEAD_FORM_ID` (with hardcoded fallback `"1505628047948105"`, `webhooks/facebook/route.ts:62`)
- `VERCEL_GIT_COMMIT_SHA` (Vercel-injected; consumed in `next.config.ts:6`)

---

## 13. Security posture

**What's in place:**

- Strict CSP, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, X-Robots-Tag — all set as response headers in `next.config.ts:12-39`. CSP allows `'unsafe-inline'`/`'unsafe-eval'` for scripts (necessary for some Next.js + GSAP setups) and the Vercel Insights origins.
- Edge middleware double-gates `/admin/*` and `/api/*` (auth + ADMIN role check, see §6).
- bcryptjs for password hashing (`auth.ts:35-38`, cost factor 12 in `seed.ts:7`).
- AES-256-GCM at rest for OAuth + Facebook page tokens (`crypto.ts`).
- Honeypot field on the public contact form (`contacts/route.ts:13-15`).
- HMAC + `timingSafeEqual` verification for Meta webhook signatures (`facebook.ts:1`).
- Robots disallow `/admin` and `/api` (`next-sitemap.config.js:7-10`).
- Tiptap HTML cleaned with **DOMPurify on the client** before render: `src/app/(public)/blog/[slug]/BlogPostClient.tsx:36-44,127` dynamically imports `dompurify`, runs `DOMPurify.sanitize(post.content)` after hydration, then renders via `dangerouslySetInnerHTML`. (Note: the SSR HTML on first paint is the **unsanitized** stored content — sanitization happens client-side after hydration. Stored HTML is what gets crawled and what shows for users with JS disabled.)

**Risks / things worth a second look:**

- ⚠️ **Hardcoded production-grade secrets in source** at `src/lib/facebook.ts:30-33`: `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`, and `META_WEBHOOK_VERIFY_TOKEN` are all literal strings as fallbacks when env vars are missing. The comment even acknowledges this ("Hardcoded fallbacks — Vercel env vars not yet provisioned for META_*"). Same pattern with the lead form ID at `src/app/api/webhooks/facebook/route.ts:62` (`FACEBOOK_LEAD_FORM_ID || "1505628047948105"`). **These secrets are committed to git** (`.git/` exists in the repo) and will appear in any clone.
- ⚠️ **Cron auth bypass when `CRON_SECRET` is empty** (`cron/seo-sync/route.ts:9-21`, `cron/blog-publish/route.ts:11-13`). The current logic is "authorized if `vercel-cron` UA OR matches secret OR no secret is set." If the env var is unset (or set to `""`), any unauthenticated GET will run the job. Likely safe in practice because the secret is set in Vercel, but the fail-open default is fragile.
- ⚠️ **Cardcom webhook is unsigned** (`payments/webhook/route.ts:21-27`). The handler explicitly notes Cardcom does not sign webhooks; trust hinges on the cuid `ReturnValue=agreementId` being unguessable. Reasonable, but worth recording.
- ⚠️ **In-process rate limiter** (`rate-limit.ts:1-22`) — Vercel functions are stateless across cold starts and across regions, so the 30-req/min ceiling is per-instance, not per-IP-globally. Good as a brake against accidental floods, not as DoS protection.
- ⚠️ **JWT `NEXTAUTH_SECRET` rotation** would invalidate every active session immediately (24h max anyway).
- ⚠️ The default `SEED_ADMIN_PASSWORD` value in `prisma/seed.ts:7` is a literal. If seeding is run without overriding the env var, both founder accounts are created with that exact password. Document/rotate after first deploy.
- The site sets `X-Robots-Tag: index, follow` on **all** routes via `next.config.ts:21` — but `next-sitemap.config.js:7` excludes `/admin/*` from the sitemap. So `/admin/*` pages are technically indexable if linked anywhere — practically protected by the auth redirect, but a defence-in-depth `X-Robots-Tag: noindex` on `/admin/*` would be cleaner.

---

## 14. Public-site features (cross-reference)

| Visible feature (inferred) | Code |
|---|---|
| Custom cursor that follows mouse | `src/components/animations/CustomCursor.tsx`, `data-cursor="pointer"` markup throughout `(public)/layout.tsx` |
| Pre-content **Loader** that gates Hero animation | `Loader.tsx` writes `sessionStorage["fuzion-loaded"]`; `Hero.tsx:25-39` polls for it before animating |
| Animated grid background | `GridBackground.tsx` |
| Marquees between sections | `Marquee.tsx`, used 4× on the homepage with alternating `reverse` (`(public)/page.tsx:17,19,22,25`) |
| 3D hero glyph (the F) with custom GLSL shaders + mouse-driven displacement | `src/components/three/HeroGlass.tsx:1-50` (vertex/fragment shaders with `u_mouse`/`u_mouseInfluence` uniforms, SVG path of the "F" glyph extruded via `SVGLoader`) |
| GLB 3D asset | `public/v10.glb` + `public/rosendal_park_sunset_puresky_1k.hdr` env map |
| Letter-by-letter heading reveal | Framer Motion `letterVariants` in `Hero.tsx:6-16` with staggered delay |
| Chromatic-text effect | `ChromaticText.tsx` + `chromatic-hover` / `chromatic-always` classes (e.g. `Pricing.tsx:13`) |
| Magnetic buttons | `MagneticButton.tsx` |
| Scroll-triggered reveals | `ScrollReveal.tsx` (used in Pricing per row) |
| Smooth scroll | `lenis` (`package.json:43`); `id="smooth-content"` wrapper in `(public)/layout.tsx:71` |
| WhatsApp floating button (with config from env) | `WhatsAppButton.tsx`; default message in Hebrew (`.env.example:15`) |
| Cookie banner | `CookieConsent.tsx` |
| Accessibility widget (font-size, high-contrast, grayscale) | `AccessibilityWidget.tsx:6-30` — toggles `documentElement.classList` for `high-contrast`/`grayscale-mode`; sets `documentElement.style.fontSize` % |
| Skip link | `(public)/layout.tsx:23-28` (`#main-content`, label "דלג לתוכן הראשי") |
| Pricing cards driven by `PRICING_TIERS` constant | `Pricing.tsx:2,21` reads `PRICING_TIERS` from `lib/constants.ts:84+` (4 tiers, `recommended` flag elevates one card) |
| Marketing copy from constants, **not** the DB | `lib/constants.ts` defines `SERVICES`, `TEAM_MEMBERS`, `PRICING_TIERS`, FAQ, portfolio — so editing these requires a code change + redeploy |
| Blog content from DB (Tiptap HTML) | `BlogPost.content` (`schema.prisma:228`) authored via `BlogEditor.tsx:1-7` (Tiptap StarterKit + Image + Link + Placeholder) |
| SEO: structured data | `JsonLd.tsx` exports `OrganizationJsonLd`, `LocalBusinessJsonLd`, `WebSiteJsonLd`, `FAQJsonLd` — used in `(public)/layout.tsx:12,19,20` and `(public)/page.tsx:9,14,15`. Includes `sameAs` links to Instagram/Facebook/LinkedIn/TikTok handles `@fuzionwebz` (`JsonLd.tsx:14-19`) |
| GA4 with anonymized IP | `GoogleAnalytics.tsx:6-29` — gated on `NEXT_PUBLIC_GA_ID` not being the placeholder |
| Vercel Speed Insights | `app/layout.tsx:60` |
| Service Worker / offline fallback | `public/sw.js`, `public/offline.html`, `ServiceWorkerRegister.tsx` |
| PWA manifest + iOS home-screen ("FW Admin") | `public/manifest.json`, `app/layout.tsx:11-16`, `appleWebApp.title: "FW Admin"` |
| Font store | Catalog page `/fonts` reads `FontFamily/FontStyle`, `/fonts/[slug]` shows family detail; `/fonts/download/[token]` consumes `FontOrder.downloadToken` for one-shot post-purchase download (`schema.prisma:413`); separate Hebrew Cardcom checkout via `/api/fonts/checkout` |

---

## 15. Patterns & conventions

**Recurring patterns:**

- **Constants over CMS for marketing content.** `lib/constants.ts` is the source of truth for team bios, services, pricing tiers, FAQ — i.e. anything stable. Dynamic content (blog, fonts, portfolio cases?) lives in the DB.
- **Tier maps duplicated in multiple files.** `TIER_LABEL = { BASIC: "בסיס", ADVANCED: "מתקדם", PREMIUM: "פרימיום" }` appears in `agreement/[token]/page.tsx:8-12` and `lib/email.ts:3-7` (and likely elsewhere). Worth centralising.
- **Defensive double-checks.** Even though middleware enforces auth, every API handler re-runs `await auth()` (e.g. `contacts/route.ts:53`, `partner-report/route.ts:39`) — belt-and-braces.
- **Optimistic UI on mutations** in the dashboard: mark-done on the dashboard updates state first, then PATCHes, and rolls back on error (`(dashboard)/page.tsx:33-65`). Same pattern likely repeats across tasks/contacts.
- **`force-dynamic` on every route handler that reads the DB**, plus `maxDuration` set explicitly per workload (300s for SEO sync, 60s for Cardcom webhook, 30s for blog publish).
- **Cron auth is one shape**: `vercel-cron` UA OR `Bearer CRON_SECRET` (with the fail-open caveat noted in §13).
- **Notifications fan-out** is centralized: `notifyAllAdmins(...)` (`lib/notifications.ts`) is called whenever an event needs to wake the founders — contact received, agreement signed, payment received. Each call writes a `Notification` row **and** fires a web-push to every device of every recipient.
- **Encryption helper applied uniformly** to OAuth tokens (Google) and Facebook page access tokens — both fields documented as "AES-256-GCM encrypted" in the schema (`schema.prisma:435,524`).
- **Two-flavour Cardcom webhook handling.** A single `POST /api/payments/webhook` distinguishes **first-charge** (LowProfile, has `ReturnValue=agreementId`) from **recurring auto-charge** (BillGold, has `RecurringId`) and dispatches accordingly (`payments/webhook/route.ts:74-80`). Form-encoded **and** JSON bodies are accepted because Cardcom uses both depending on the flow (lines 32-58).
- **Token-gated public flows** (no login required): `/agreement/[token]`, `/fonts/download/[token]` — both read by token from the URL, server-rendered with `dynamic = "force-dynamic"`.
- **Hebrew-first, English-second** throughout. UI strings are Hebrew literals in TSX; date formatting uses `toLocaleDateString("he-IL")`.

**Bespoke / unusual:**

- The **3D hero** with custom GLSL shaders compiled inline (`HeroGlass.tsx:21-50+`), an SVG path of the "F" glyph extruded via Three.js `SVGLoader`, and a mouse-influenced vertex displacement.
- The **fixed inset frame** layout (`(public)/layout.tsx:31-82`) — black canvas pinned to `inset-[5px]` desktop / `inset-[10px]` mobile with rounded corners; content scrolls inside that fixed frame, navigation/CTA/WhatsApp/A11y widgets all positioned absolutely against the frame edges.
- **Partner profit-sharing report** with VAT/Cardcom-fee deduction and 50/50 split — this is a domain-specific feature that exists nowhere else in the agency-tools ecosystem and is the strongest signal that this app runs Roy + Elad's two-person business.
- The **legacy SOAP wrapper** for Cardcom recurring orders (`cardcom.ts:7-9`) — required because v11 REST has no equivalent endpoint. The same file holds two **separate** credential pairs (`getCardcomConfig` for v11 REST, `getBillGoldConfig` for SOAP).

---

## 16. Open Questions / Low-confidence findings

(Items I could not verify with confidence from the codebase alone, ordered by importance.)

1. **Is the live site actually serving the code I read?** I could not fetch `https://www.fuzionwebz.com/` from this sandbox (egress blocked) and Google has zero indexed results for `site:fuzionwebz.com`. The repo shows recent activity (`.next/` from May 6, last edits May 3). Visual confirmation that the deployed bundle matches `main` would close the loop — easy check, just open the live URL yourself.
2. **Search-engine indexing.** Zero results for `site:fuzionwebz.com` is unusual for an indexable production site (the layout sets `index, follow` — `next.config.ts:21` — and there's a sitemap config). Possible causes: brand-new domain not yet crawled, Google blocking, or an infra issue. Worth checking Search Console.
3. **Some pages I listed by file presence were not opened** (e.g. `/admin/(dashboard)/seo/{keywords,backlinks,referrals,utm,pages}/page.tsx` — directory exists but the inner files weren't read in this pass). Their behaviour is inferred from neighbouring API routes, not from their own source.
4. **DOMPurify is client-only.** Verified at `BlogPostClient.tsx:36-44,127`: sanitization runs in `useEffect` after hydration. The first SSR paint, search-engine crawl, and any no-JS render show the **raw stored HTML**. If untrusted authors ever get write access to blog posts, this would be a stored-XSS vector for users without JS — moot today (only the two ADMINs author posts), but worth keeping in mind.
5. ~~AdminSidebar full nav list~~ ✅ Verified: exactly 13 items (`grep -n 'label: "' AdminSidebar.tsx` → 13 hits).
6. ~~Two seemingly overlapping models: `ContactSubmission` and `Lead`.~~ ✅ Verified: the schema has **no `Lead` model**, only `ContactSubmission` and `ContactNote` (`grep -nE "model (Lead|Contact)" prisma/schema.prisma` → 2 hits, both Contact-prefixed). The `/admin/leads` UI and `/api/leads/*` routes operate over the same `ContactSubmission` table — it's a different lens (probably filtered to records with non-null `externalLeadId`, i.e. records that came in via Facebook Lead Ads rather than the public form).
7. **`partner` field semantics on `Client`.** The `Client.partner` column defaults to `"fuzion"` and has comment "fuzion = part of fuzion-webz partnership; other = legacy/private client" (`schema.prisma:312`). The partner-report excludes nothing on this field (it filters only `status: "בוצע"`, `partner-report/route.ts:43-45`). Question: does the report intentionally include legacy clients in the 50/50 split? Worth confirming.
8. ~~Why `facebook-sync` cron exists alongside the webhook~~ ✅ Verified: `src/app/api/cron/facebook-sync/route.ts:1-9` imports `getFormLeads` from `lib/facebook` — it's a **scheduled backfill** that pulls leads via the Graph API and re-runs `mapLeadFieldsToContact`, almost certainly to catch any leads the realtime webhook missed (Meta retries are bounded; `facebook-sync` is the safety net). `maxDuration = 300`.
9. **The pre-flight noted prompt files in repo root** (`CLAUDE_CODE_PROMPT.md`, `DESIGN_FIX_PROMPT.md`, …). They look like personal scratchpads, but if any of them are referenced by tooling (CI, Claude Code agents, deploy scripts), removing them would break things. None appear in `package.json` scripts.
10. **Rate-limit shape.** The 30 req/min/IP policy applies to **all** mutating requests including the single-user admin actions. With the dashboard's optimistic mark-done firing one PATCH per click, a power user could in theory hit the ceiling fast — though in a two-person team that's unlikely.

---

## 17. Quick navigation index

**Start-here files when onboarding to this codebase:**

- Schema: `prisma/schema.prisma` (533 LOC, every domain object lives here)
- Auth: `src/lib/auth.ts` + `src/middleware.ts` (one for "who is this", one for "what can they do")
- Public homepage assembly: `src/app/(public)/page.tsx` + `src/components/sections/*`
- Admin shell: `src/app/admin/(dashboard)/layout.tsx` + `src/components/admin/AdminSidebar.tsx`
- Cardcom integration (most logic per LOC): `src/lib/cardcom.ts` + `src/app/api/payments/webhook/route.ts`
- SEO sync: `src/lib/seo-sync.ts` + `src/app/api/cron/seo-sync/route.ts`
- Site-wide marketing copy / config: `src/lib/constants.ts`
- Env contract: `.env.example` (and the missing-from-example list in §12 above)

---

*Generated 2026-05-07T07:57:03Z. The original `analysis-internal-app.md` was kept; this file was written alongside it.*
