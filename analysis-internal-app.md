# Fuzion Webz — Internal Technical Reference

> הערה מקדימה: ניסיון fetch של `https://www.fuzionwebz.com/` מסביבת הסוכן נחסם (egress allowlist). ניתוח המשטח הציבורי נעשה מהקוד ומה-metadata שלו ולא מצפייה חיה. כל טענה שלא ניתן לאמת ללא דפדפן מסומנת ב-Open Questions.

## 1. System Overview

Fuzion Webz הוא **monorepo של Next.js 16** שמאחד שני מוצרים שמופצים מאותו דומיין:

- **אתר ציבורי שיווקי בעברית** (`src/app/(public)/...`) — landing מסחרי לסטודיו, כולל hero תלת-ממדי, סקציות שירותים/מסלולים/portfolio/בלוג/חנות פונטים, וטופס ליד.
- **CRM פנימי לסטודיו** (`src/app/admin/(dashboard)/...`) — ניהול לידים, לקוחות, משימות, הסכמים ותשלומים, בלוג, חנות פונטים, דאטה של SEO ושילוב מודעות לידים מפייסבוק.

הקהל: בעלי הסטודיו (Roy Yehezkel ו-Elad Nissim, ראו `src/lib/constants.ts:26-45`) משתמשים ב-admin; לקוחות פוטנציאליים מגיעים לאתר השיווקי, חותמים על הסכם דיגיטלי ומשלמים דרך Cardcom. מוגדר כ-RTL בעברית (`src/app/layout.tsx:56`, `locale: "he_IL"`).

**סיווג**: Hybrid — landing/marketing site **+** internal SaaS-style admin (CRM + billing) על stack אחד. אינו e-commerce כללי, פרט לחנות פונטים שולית (`FontFamily`/`FontOrder` ב-Prisma) שמסומנת בקוד כ-mock checkout (`src/app/api/fonts/checkout/route.ts:48-60`).

## 2. Tech Stack

- **Framework**: Next.js `16.2.1` עם App Router (`package.json:45`, `next.config.ts:1`).
- **שפה**: TypeScript `^5`, `target: ES2017`, strict mode, alias `@/* → ./src/*` (`tsconfig.json:7,21-23`).
- **React**: `19.2.4` (`package.json:48-49`).
- **Styling**: Tailwind CSS v4 דרך `@tailwindcss/postcss`, עם design tokens מוגדרים ב-`@theme inline` בתוך `src/app/globals.css:4-22` (color palette pink/cyan, גופנים מותאמים).
- **UI/Animation**:
  - `framer-motion ^12.38.0` — אנימציות סקציות, Hero, MagneticButton, CustomCursor.
  - `gsap ^3.14.2`, `lenis ^1.3.21` — smooth scroll (תלות מותקנת; שימוש מצוי במחזור lifecycle).
  - `lottie-react`, `recharts ^3.8.1` (גרף הכנסות באדמין — `src/components/admin/RevenueChart.tsx`).
- **3D**: `three ^0.183.2` + `@react-three/fiber ^9.5.0` + `@react-three/drei ^10.7.7`. Hero glass mesh ממומש **vanilla three.js** (לא R3F) ב-`src/components/three/HeroGlass.tsx` ו-`src/components/three/scene.ts` — כולל shaders מותאמים (vertex+fragment) ל-honeycomb pattern על משטח האות F (ראיה: `HeroGlass.tsx:9-147`).
- **Forms/Validation**: `zod ^4.3.6` (`src/lib/validations.ts`); ללא ספריית טפסים — state ידני ב-React.
- **Rich text**: TipTap ‎`^3.21.0` לעורך הבלוג (`@tiptap/react`, `extension-image`, `extension-link`, `placeholder`, `starter-kit`).
- **DnD**: `@dnd-kit/core` + `sortable` — סידור מחדש של משימות (`src/app/api/tasks/reorder/route.ts`).
- **Auth**: `next-auth ^5.0.0-beta.30` עם Credentials provider + bcrypt (`src/lib/auth.ts:1-69`).
- **DB**: Prisma `^5.22.0` ו-`@prisma/client`.
- **Email**: Resend ‎`^6.12.2` (`src/lib/email.ts:1`).
- **Push**: `web-push ^3.6.7` עם VAPID (`src/lib/push.ts`).
- **Sanitization**: `dompurify ^3.2.0` (לרינדור תוכן TipTap).
- **Build tools**: npm + `package-lock.json` (lockfile יחיד), `eslint ^9` + `eslint-config-next`, `tsx` ל-seed scripts. אין Turbopack/SWC overrides.
- **Observability**: `@vercel/speed-insights ^2.0.0` ב-`src/app/layout.tsx:60`.

## 3. Services & Infrastructure

- **Hosting**: Vercel — נחקר משני מקורות:
  - `vercel.json` עם `crons` (Vercel Cron בלעדי) — `vercel.json:2-15`.
  - `.vercel/project.json` עם `projectId`/`orgId` ושם פרויקט `landing-page`.
  - `next.config.ts:6-7` משתמש ב-`VERCEL_GIT_COMMIT_SHA`.
  - אין `wrangler.toml` או `cloudflare/`.
- **DB**: PostgreSQL ניהולי — `prisma/schema.prisma:5-9` מגדיר `provider postgresql` עם `directUrl` (תבנית Neon/Supabase pooler — לא ודאי מי ספק). ‎`.env.example:1-3` מציג DSN postgres עם `sslmode=require`.
- **Auth**: NextAuth v5 עם Credentials provider בלבד. JWT, `maxAge: 24h` (`src/lib/auth.ts:8-12`).
- **Payments**: **Cardcom** v11 LowProfile + BillGold (SOAP/NTV) — `src/lib/cardcom.ts:10-11` מפנה ל-`https://secure.cardcom.solutions/api/v11` ול-`BillGoldService.asmx`. הוראות קבע ניצרות ב-`createRecurringOrderNTV()` (`src/lib/cardcom.ts:417-491`).
- **Email**: Resend, מ-`notifications@fuzionwebz.com`, רשימת admin הארדקודית (`src/lib/email.ts:9, 43`).
- **Image/asset**: ללא CDN חיצוני (`next.config.ts:9-11` מגדיר רק formats avif/webp); אין `images.remotePatterns`. וידאו portfolio נשמר ב-`/public/c-video/...` (`Portfolio.tsx:16-23`).
- **Analytics/SEO**:
  - Google Analytics 4 דרך `NEXT_PUBLIC_GA_ID` (`src/components/seo/GoogleAnalytics.tsx:9`).
  - Google Search Console + GA4 API דרך OAuth — `src/lib/google-oauth.ts`, `src/lib/search-console.ts`, `src/lib/analytics.ts`. טוקנים מוצפנים AES-256-GCM (`src/lib/crypto.ts:16-24`) ושמורים ב-`GoogleIntegration` (`schema.prisma:429-442`).
  - Vercel Speed Insights (`src/app/layout.tsx:60`).
- **Lead-Ads**: Meta Graph API v19 — `src/lib/facebook.ts:3-4`. Webhook subscription `leadgen` ב-`src/app/api/webhooks/facebook/route.ts`, OAuth flow ב-`src/app/api/integrations/facebook/*`.
- **Push notifications**: web-push + VAPID (`src/lib/push.ts:7-13`); SW ב-`src/components/pwa/ServiceWorkerRegister.tsx`.
- **PWA**: `manifest.json` ב-public, `appleWebApp` ב-metadata (`src/app/layout.tsx:11-16`).

Third-party APIs נקראים מהקוד: `secure.cardcom.solutions`, `graph.facebook.com/v19.0`, `oauth2.googleapis.com`, `googleapis.com/webmasters/v3`, `accounts.google.com`, Resend SDK, Vercel Speed Insights.

## 4. Architecture

- **App Router בלבד** — אין `pages/`. כל הניתובים תחת `src/app/`. אין mixing עם Pages Router.
- **Route Groups**:
  - `(public)/` — אתר שיווקי, layout משלו עם CustomCursor/Loader/GridBackground (`src/app/(public)/layout.tsx`).
  - `admin/(dashboard)/` — CRM, layout נפרד עם sidebar וסשן בדיקה (`src/app/admin/(dashboard)/layout.tsx:14-19`).
  - `agreement/[token]/` — דף חתימת לקוח, ללא navbar/footer.
  - `payment/success|failed` — דפי redirect של Cardcom.
- **Server vs Client Components**:
  - Server Components כברירת מחדל — `src/app/(public)/page.tsx`, `src/app/agreement/[token]/page.tsx` קוראים מ-Prisma ישירות.
  - Client Components מסומנות `"use client"` — `Hero.tsx`, `Pricing.tsx`, `Services.tsx`, `Contact.tsx`, כל ה-`animations/*`, `three/HeroGlass.tsx`, ושאר רכיבי האדמין שמשתמשים ב-state.
  - `HeroGlassWrapper.tsx` משתמש ב-`next/dynamic({ ssr: false })` כדי לדחות את three.js (`src/components/three/HeroGlassWrapper.tsx:1-9`).
- **Data Fetching**:
  - **SSR/dynamic** — נראה ב-`agreement/[token]/page.tsx:6` ‎(`export const dynamic = "force-dynamic"`).
  - רוב ה-API routes מסומנות `force-dynamic` (לדוגמה `src/app/api/leads/route.ts:1`, `cron/blog-publish/route.ts:1`).
  - **CSR** — דפי האדמין משתמשים ב-`fetch("/api/...")` מתוך `useEffect` (לדוגמה `src/app/admin/(dashboard)/page.tsx:67-94`).
  - אין `revalidate` או ISR מפורש בקוד שנקרא.
- **API Layer**: 81 קבצי `route.ts` תחת `src/app/api/`. אין tRPC/GraphQL/Server Actions — הכל REST handlers על Route Handlers.
- **State management**: ללא Redux/Zustand/Jotai. State מקומי + URL params + sessionStorage (לדוגמה `fuzion-loaded` ב-`Loader.tsx:18` ו-`Hero.tsx:28`).
- **Auth flow**: NextAuth credentials → JWT עם `role` (ADMIN/MEMBER), `maxAge 24h`. בדיקה ב-`auth()` בכל route מוגן. Layout האדמין עושה redirect ל-`/admin/login` כשאין session (`(dashboard)/layout.tsx:14-19`).
- **Folder structure (2 רמות)**:

```
src/
├── app/                  # App Router routes
│   ├── (public)/         # Marketing site
│   ├── admin/            # CRM (auth gated)
│   ├── agreement/        # Customer signing flow
│   ├── payment/          # Cardcom redirect targets
│   └── api/              # 81 Route Handlers
├── components/           # React components, חצויים לפי domain
│   ├── animations/       # Loader, ScrollReveal, MagneticButton, ...
│   ├── three/            # HeroGlass — vanilla three.js
│   ├── sections/         # Hero / Services / Pricing / ...
│   ├── admin/            # AdminSidebar, BlogEditor, RevenueChart
│   ├── seo/              # JsonLd, GoogleAnalytics
│   ├── pwa/              # ServiceWorkerRegister, InstallPrompt
│   └── ui/               # Primitive design system (Button, Input, Card, ...)
├── lib/                  # Domain logic, integrations, utils
├── hooks/                # 3 hooks (useInView, useMousePosition, useScrollDirection)
├── styles/               # (ריק — globals.css יושב ב-app/)
└── types/                # Type definitions לקבועים השיווקיים
prisma/                   # schema + 2 seed scripts (TypeScript)
scripts/                  # 18+ ad-hoc maintenance/scripts ב-mjs/ts
seo/                      # (לא נחקר)
public/                   # logo, fonts, c-video, images, manifest
```

## 5. Reusable Patterns

### Design system (`src/app/globals.css:4-22`)
טוקנים על Tailwind v4 inline theme. צבעים: `--color-pink #E503A2`, `--color-cyan #01FFFF`, סקאלת אפורים מותאמת אישית. גופנים: Birzia (running), Meruba (headings), Anomalia. שורות גופנים `@font-face` לוקאליות (קבצים ב-`/public/fonts/`).

### UI primitives (`src/components/ui/`)
`Button.tsx`, `Input.tsx`, `Card.tsx`, `Badge.tsx`, `Modal.tsx`, `LoadingSpinner.tsx`, `ConfirmSheet.tsx`, `PullToRefresh.tsx` — שכבת design system פשוטה אך עקבית, יכולה לעבור as-is לפרויקט אחר.

### Animation kit (`src/components/animations/`)
`ScrollReveal` (wrapper על framer-motion + IntersectionObserver — `ScrollReveal.tsx:11-30`), `MagneticButton` (התנהגות עכבר magnetic — `MagneticButton.tsx:18-33`), `CustomCursor` (motion + spring + data-cursor attribute — `CustomCursor.tsx:5-44`), `Loader` (מצב מולטי-פאזה: draw → chromatic → fly → fadeout — `Loader.tsx:6-14`), `ChromaticText`, `Marquee`, `GridBackground`, `ParallaxLayer`, `CountUp`. כל אחד עומד בפני עצמו.

### Three.js (vanilla)
- `src/components/three/scene.ts` — Glass material (`MeshPhysicalMaterial` עם transmission, IOR 1.45, env map שנבנה ב-`PMREMGenerator` עם נקודות אור pink/cyan — `scene.ts:22-48`).
- `src/components/three/HeroGlass.tsx` — וריאנט עם shader honeycomb mouse-interactive ו-fresnel (`HeroGlass.tsx:9-147`). שני קבצים מקבילים — בחירה לא ודאית מי בשימוש בפועל בעמוד הבית. `HeroGlassWrapper` עוטף `dynamic({ ssr: false })`.
- אינו משתמש ב-React Three Fiber; הספריה מותקנת אבל ה-Hero ידני.

### Form pattern
טפסים פשוטים — state אחיד בקומפוננטה, שליחה ל-route handler עם honeypot field (`src/components/sections/Contact.tsx:75-87` + `src/app/api/contacts/route.ts:13-19`). Validation עם Zod ב-`src/lib/validations.ts`.

### Domain libs (`src/lib/`)
26 קבצים. הבולטים: `cardcom.ts` (492 שורות, 5 גישות API מתועדות), `facebook.ts` (Meta Graph + signature verify), `google-oauth.ts` + `search-console.ts` + `analytics.ts` + `seo-sync.ts` (pipeline אינטגרציה), `agreement-templates.ts` (HTML שמתורגם לחוזה, גרסת מסמך עם עליה — `AGREEMENT_DOCUMENT_VERSION = 5`), `crypto.ts` (AES-256-GCM, key מ-SHA256 על `OAUTH_ENCRYPTION_KEY`), `vat.ts` (`VAT_RATE = 18`).

### SVG library (`src/components/svg/`)
תשעה רכיבי SVG מוטבעים (`SvgAbout`, `SvgProjects`, `SvgWhereIdeas`, ...) משמשים את ה-wireframe animation ב-`HowItWorks.tsx:5-12, 30-42`.

## 6. Customization Surface

### Hard-coded שכל לקוח חדש יצטרך לשנות
- שמות הצוות, ביוגרפיות ואימיילים — `src/lib/constants.ts:26-45`.
- מסלולי תמחור (3-4 tiers) ו-tagline-ים — `src/lib/constants.ts:86-247`.
- שירותים ו-portfolio (כולל URLs לוידאו) — `constants.ts:47-84, 249-304` ו-`Portfolio.tsx:16-23`.
- הסכם משפטי — `src/lib/agreement-templates.ts:39-86` (ערכי מסלולים, רשימות שירותים, מע"מ 18%).
- WhatsApp number ו-message — `constants.ts:14-15` (placeholder `972000000000` עדיין שם — צריך ENV `NEXT_PUBLIC_WHATSAPP_NUMBER`).
- Hero glyph — נתיב ה-SVG של האות F הוא קבוע (`scene.ts:4`, `HeroGlass.tsx:7`).
- שמות domain ב-canonical/OG/sitemap — `next-sitemap.config.js`, `layout.tsx:22, 38`, `email.ts:43, 53`.
- אימיילי admin לקבלת התראות — `email.ts:9` (`["roy@fuzionwebz.com", "elad@fuzionwebz.com"]`).
- Fallbacks הארדקודיים של credentials של META ב-`facebook.ts:26-29` (App ID, App Secret, redirect URI, verify token) — ראו Friction Points.

### ENV variables (שמות בלבד, מ-`.env.example` + grep)
- DB: `DATABASE_URL`, `DIRECT_URL`.
- Auth/Crypto: `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `OAUTH_ENCRYPTION_KEY`, `SEED_ADMIN_PASSWORD`.
- Public site: `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_WHATSAPP_NUMBER`, `NEXT_PUBLIC_WHATSAPP_MESSAGE`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SITE_NAME`.
- Google: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`.
- Meta: `META_APP_ID`, `META_APP_SECRET`, `META_REDIRECT_URI`, `META_WEBHOOK_VERIFY_TOKEN`, `META_PAGE_ID`, `FACEBOOK_LEAD_FORM_ID`.
- Cardcom: `CARDCOM_TERMINAL`, `CARDCOM_API_NAME`, `CARDCOM_API_PASSWORD`, `CARDCOM_BILLGOLD_USERNAME`, `CARDCOM_BILLGOLD_PASSWORD`.
- Email: `RESEND_API_KEY`.
- Push: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.
- Cron auth: `CRON_SECRET`.
- Build-injected: `BLOG_API_KEY` (דרך `scripts/inject-env.js` — קובץ `src/lib/env-values.ts` סומן AUTO-GENERATED, כרגע ריק).

### מקורות תוכן
- **Hardcoded** ב-TS: כל סקציות ההומפייג, FAQ, Process steps, Pricing tiers, צוות, social links — מתוך `src/lib/constants.ts`.
- **DB-backed**: בלוג (`BlogPost`, TipTap HTML), פונטים (`FontFamily`/`FontStyle`), portfolio של לקוחות (`Client`), הסכמים (`Agreement`).
- **אין CMS חיצוני** — אין Sanity/Contentful/Payload/strapi קונפיגורציות.

## 7. Build & Deploy

- **Deploy target**: Vercel (`.vercel/project.json` קיים, `vercel.json` עם crons, `next.config.ts:6` משתמש ב-`VERCEL_GIT_COMMIT_SHA`). אין wrangler/Cloudflare.
- **Build commands** (`package.json:5-15`):
  - `npm run build` → `prisma generate && next build`.
  - `npm run dev` → `next dev`.
  - `postinstall` → `prisma generate`.
  - `db:push`, `db:seed`, `db:studio` — Prisma ops; seed מסומן ב-`package.json:16-18` להריץ דרך `tsx prisma/seed.ts`.
- **Cron jobs** (Vercel — `vercel.json:1-15`):
  - `/api/cron/seo-sync` — daily 03:00 UTC.
  - `/api/cron/blog-publish` — daily 07:00 UTC.
  - `/api/cron/facebook-sync` — daily 06:00 UTC.
  - אימות ב-`cron/blog-publish/route.ts:8-17`: `vercel-cron` UA או `Bearer ${CRON_SECRET}`.
- **Headers/CSP** מותאמים ב-`next.config.ts:12-39` — CSP מאפשר `unsafe-inline + unsafe-eval` (ראו Friction Points), חסום `X-Frame-Options: DENY`.
- **Runtime**: ברירת מחדל Node (`maxDuration` הוגדר ב-30/60/120s ב-routes כבדים — `agreements/sign/route.ts:8`, `payments/webhook/route.ts:14`, `agreements/retry-recurring/route.ts:9`). אין `export const runtime = "edge"`.
- **Secrets**: ENV ב-Vercel, נטענים ב-runtime; OAuth tokens מוצפנים בDB דרך `crypto.ts`. `scripts/inject-env.js` מכין קובץ ‎`src/lib/env-values.ts` המגניב לבילד (כרגע ריק — לא ודאי שמשמש).

## 8. Pipeline / Data Flow — Lead → Agreement → Recurring Charge

עוקב אחרי הזרימה הקריטית של הסטודיו, end-to-end:

1. **קליטת ליד**:
   - **טופס באתר**: `Contact.tsx` → `POST /api/contacts` (`route.ts:8-48`) → יוצר `ContactSubmission` עם honeypot anti-bot, שולח push+notification ל-admins דרך `notifyAllAdmins()`.
   - **מודעת לידים פייסבוק**: Meta webhook ב-`/api/webhooks/facebook` (`route.ts:109-176`) — מאמת חתימת `X-Hub-Signature-256`, מסנן לפי `META_PAGE_ID + FACEBOOK_LEAD_FORM_ID`, מושך פרטי ליד מ-Graph API, ממפה ל-`ContactSubmission` עם `externalLeadId` ייחודי (upsert).
2. **טיפול admin**: ליד נראה ב-`/admin/leads` (`src/app/admin/(dashboard)/leads/page.tsx`), נשלף מ-`/api/leads`. סטטוס מקודם ל-`IN_PROGRESS`/`CLOSED` ידנית.
3. **יצירת הסכם**: admin פותח `/admin/agreements`, מזין tier (BASIC/ADVANCED/PREMIUM/Custom), monthlyPrice, oneTimeFee → `POST /api/agreements` (`route.ts:38-110`) → מייצר `Agreement` עם `signToken` (cuid אקראי), HTML חוזי דרך `renderAgreement()` (`agreement-templates.ts`).
4. **שליחת קישור חתימה**: admin שולח ללקוח את `https://www.fuzionwebz.com/agreement/{signToken}` (אופציה ידנית; אין אוטומציית WhatsApp/SMS בקוד שנבדק).
5. **חתימה**: לקוח פותח את הדף → SSR מ-Prisma (`agreement/[token]/page.tsx:37-52`) → `SignAgreementClient` (לא נקרא בפירוט) שולח `POST /api/agreements/sign/[token]` (`route.ts:70-181`) עם `signatureData` (canvas dataURL), פרטי לקוח ומסכים. השרת:
   - מעדכן את `Agreement.status = SIGNED` עם `signedIp`, `signedUserAgent`, `documentVersion`.
   - יוצר/מקשר `Client` (matching לפי email/phone — `route.ts:183-235`).
   - מודיע admins (`AGREEMENT_SIGNED`).
   - **best-effort**: קורא ל-`ensurePaymentUrlForAgreement(id)` ליצור עמוד תשלום Cardcom — אם נכשל, מחזיר `success: true, paymentUrl: null` (`route.ts:165-172`).
6. **חיוב ראשון (Cardcom LowProfile)**:
   - `payments.ts:73-91` קורא ל-`createPaymentPage()` ב-`cardcom.ts:90-152` עם `Operation = "ChargeAndCreateToken"` (כשmonthlyPrice > 0), `successUrl`/`failedUrl`/`webhookUrl` מ-`siteUrl()`, סכום הכולל **גרוס** (setup + monthlyPrice עם מע"מ 18% — `payments.ts:67-70` ו-`vat.ts:1-12`).
   - ‎`Agreement.paymentStatus = SENT`, `paymentUrl` נשמר.
   - לקוח עובר לעמוד Cardcom (hosted), משלם.
7. **Webhook חיוב ראשון** — `POST /api/payments/webhook` (`route.ts:88-224`):
   - מזהה לפי `RecurringId` אם זה first-charge או auto-charge (`route.ts:74-80`).
   - במסלול first-charge: עדכון idempotent של `paymentStatus = COMPLETED`, שמירת `cardcomToken` (מוצפן AES-256-GCM), `cardcomLowProfileId`, `cardcomDealId`, `invoiceNumber`, סנכרון `Client.amount += paid`.
   - הודעה ל-admins + מייל ב-Resend (`sendPaymentReceivedEmail` — `email.ts:27-57`).
   - ‎`after()` של Next.js רושם **הוראת קבע** ב-Cardcom NTV (`createRecurringOrderNTV` — `cardcom.ts:417-491`) עם הסכום הגרוס, NextDateToBill = +30 ימים, TotalNumOfBills = 999999. אם נכשל — admin מתריע ידנית דרך `/api/agreements/retry-recurring`.
8. **חיובים חוזרים**: Cardcom יורה כל חודש את אותו webhook עם `RecurringId`. הקוד יוצר `AgreementCharge` (idempotent לפי `cardcomDealId`), מעדכן `Client.amount` ושולח התראה (`route.ts:226-298`).
9. **דיווחי שותפים**: כל סוף חודש admin פותח `/admin/partner-report` → `/api/partner-report` (`partner-report/route.ts:32-90`) שמחשב `profit = amount − VAT(18% inclusive) − cardcomFee(2%)` ו-`partnerShare = profit / 2` עבור clients עם `status = "בוצע"`.

נקודות אינטגרציה חיצוניות לאורך המסלול: Meta Graph (לידים), Cardcom v11 + BillGold/NTV (סליקה והוראת קבע), Resend (מייל), Web Push (התראות).

## 9. Friction Points & Tech Debt

- **Hardcoded Meta secrets** ב-`src/lib/facebook.ts:26-29`: `appSecret`, `verifyToken`, `appId` ו-`redirectUri` מופיעים כ-fallbacks בקוד-מקור. גם `META_PAGE_ID`/`FACEBOOK_LEAD_FORM_ID` עם hardcoded fallbacks ב-`webhooks/facebook/route.ts:136-137`. סודות שיוצאים לקליינט/git מסכנים את האפליקציה. **דחוף לנטרל.**
- **Two parallel Three.js implementations**: `src/components/three/scene.ts` (vanilla initScene/destroyScene) ו-`src/components/three/HeroGlass.tsx` (vanilla shader-based) קיימים שניהם, רק `HeroGlass` נטען ב-Hero ‎(`Hero.tsx:6, 98, 143`). `scene.ts` נראה לא בשימוש — מועמד למחיקה.
- **CSP מתירני**: `next.config.ts:25-26` מאפשר `'unsafe-inline' 'unsafe-eval'` ב-script-src. מצמצם את הערך של ה-CSP.
- **Skeleton GA fallback**: `src/components/seo/GoogleAnalytics.tsx:9` בודק על `G-XXXXXXXXXX` — אם לא הוחלף, GA נטען בשקט.
- **בלאגן בשורש הריפו**: 8 קבצי `*_PROMPT.md` (CLAUDE_CODE_PROMPT, DEPLOY_PROMPT, ...), שני JPEG WhatsApp עם תאריכי 2026-04-14, `fuzion-sites-list.xlsx`, `prompt-fix-og-image.md` — ניירת זרה שלא רלוונטית ל-build, מכבידה על onboarding.
- **18+ ad-hoc scripts** ב-`scripts/` (mjs+ts מעורב, ללא README) — `apply-batch.mjs`, `dedupe-and-summary.mjs`, `renumber-clients.mjs` וכד'. נראה כבסיס תחזוקה ידנית למודל הנתונים. סיכון אוטומציה גבוה אם מישהו מריץ ‎`fix-mixup.mjs` בלי לקרוא.
- **Mock font checkout**: `api/fonts/checkout/route.ts:48-60` יוצר `FontOrder` עם `paymentStatus = "COMPLETED"` ללא תשלום אמיתי. מי שמשלים ב-`/fonts/...` מקבל את הקובץ חינם.
- **Status string lottery** ב-`Client.status`: זה `String` חופשי (`schema.prisma:300`), לא enum. ‎`partner-report/route.ts:42` מסנן לפי `status = "בוצע"` (literal עברי). שינוי תווית בעברית = שבירה שקטה של הדוח.
- **ENV vs hardcoded**: `WHATSAPP_NUMBER = "972000000000"` ב-`constants.ts:14` מפר את ה-`.env.example` שמציע `NEXT_PUBLIC_WHATSAPP_NUMBER`. הקוד בפועל משתמש בקבוע ולא ב-ENV.
- **כפילויות סטרינגים**: רשימת שירותים, יתרונות תיעור, וצבעים מופיעים גם ב-`Pricing.tsx`/`Services.tsx`/`Hero.tsx`/`agreement-templates.ts` וגם ב-`constants.ts`. שינוי תיאור tier מחייב לעדכן בשני מקומות.
- **`src/lib/env-values.ts`**: AUTO-GENERATED אבל כל הערכים ריקים — לא ברור מתי `scripts/inject-env.js` רץ או למה הוא קיים אם הוא לא מזריק כלום.
- **Cardcom comment debt**: `cardcom.ts:1-8` כולל הערה ארוכה על העובדה ש-v11 REST לא תומך בהוראת קבע ולכן יש בקוד גם BillGold SOAP וגם NTV API — קוד שעובד אבל מסובך, נושא חוב שהיה אפשר להחליף ב-API אחד אם Cardcom יוסיף תמיכה.

## 10. Open Questions

- **רנדור חי של האתר**: לא הצלחתי לאמת את המראה הסופי, אנימציות, נגישות, תרגום או ה-3D loaded successfully — הסביבה חסמה fetch של `fuzionwebz.com`.
- **איזה משני קבצי three.js בפועל ברירת המחדל?** `scene.ts` קיים אבל לא מצאתי נקודת import שלו. ייתכן שמיועד ל-A/B עתידי או שריד מ-refactor.
- **סטטוס חיבור Google/Meta**: מוגדר ב-Schema אבל לא ברור אילו flows הופעלו בייצור (חסרים records לדוגמה).
- **CMS לתוכן הומפייג**: כיום כל ה-`SERVICES`/`PRICING_TIERS`/`PORTFOLIO_PROJECTS` ב-TS — האם הסטודיו עורך ב-deploy בלבד? אין UI admin לעריכת תוכן הומפייג.
- **DB provider**: PostgreSQL ב-Prisma אך אין wrangler/Neon/Supabase config שמוכיח ספק ספציפי.
- **`src/lib/env-values.ts`**: למה מנגנון ההזרקה קיים אם הוא ריק? האם build על Vercel באמת מריץ `scripts/inject-env.js`?
- **דף `agreement/[token]/pdf`**: יש route לכך — מה הצורה (HTML-to-PDF? Puppeteer? React-PDF?) — לא נחקר לעומק.
- **חנות פונטים**: מה התוכנית עתידית? Mock checkout עם downloadToken מסכן את החנות.
- **Tests**: לא נצפה ספריית בדיקות (אין `*.test.ts*`, אין `vitest.config.*`, אין `jest.config.*`).
- **CI**: יש `.github/` אבל לא נחקר; ייתכן ויש workflows ל-build/deploy מעבר ל-Vercel.
