# Fuzion Webz — Claude Code Build Prompt

> Copy-paste this entire prompt into Claude Code to build the complete project from scratch.

---

## CONTEXT

You are building the **Fuzion Webz** website — a boutique web design studio based in Israel. This is a complete rebuild: new frontend (public website + admin dashboard) with a backend for internal task management.

**Before starting**: Read all files in the `docs/` folder carefully. They contain:
- `ARCHITECTURE.md` — Full technical architecture (project structure, DB schema, API routes, component specs)
- `FuzionWebz_Design_Prompt.md` — Visual design language, animations, interactions
- `FuzionWebz_Brand_Guidelines.pdf` — Brand colors, typography, logo usage
- `FuzionWebz_Backend_Architecture.md` — Backend details
- `FuzionWebz_Content_Document.docx` — All content extracted from the current site
- `logo-white.svg` — Logo file

---

## STEP 0: GITHUB CLEANUP

First, clean the existing GitHub repository:

```bash
# Delete all content from the existing repo (keep the repo itself)
gh repo view fuzionwebz/fuzion-webz 2>/dev/null && echo "Repo exists" || echo "Create new repo"

# If repo exists, we'll force-push a fresh start
# If not, create it:
gh repo create fuzionwebz/fuzion-webz --public --description "Fuzion Webz - Advanced Web Design Studio" 2>/dev/null || true
```

---

## STEP 1: INITIALIZE PROJECT

```bash
pnpm create next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm
```

Then install all dependencies as specified in `docs/ARCHITECTURE.md` section 9.

---

## STEP 2: SETUP DATABASE

1. Create `prisma/schema.prisma` exactly as defined in `docs/ARCHITECTURE.md` section 3
2. Create `prisma/seed.ts` with 2 team members:
   - Roei Yehezkel (roei@fuzionwebz.com) — ADMIN
   - Elad Nissim (elad@fuzionwebz.com) — ADMIN
   - Both with bcrypt-hashed passwords (use "FuzionAdmin2026!" as default, will change later)
3. Create `.env.example` with all variables from `docs/ARCHITECTURE.md` section 7
4. Run `npx prisma generate`

---

## STEP 3: SETUP AUTH

1. Configure NextAuth v5 in `src/lib/auth.ts`:
   - Credentials provider (email + password)
   - JWT strategy with 24h expiration
   - Prisma adapter
2. Create auth API route at `src/app/api/auth/[...nextauth]/route.ts`
3. Create middleware at `src/middleware.ts`:
   - Protect all `/admin/*` routes (redirect to `/admin/login`)
   - Protect all `/api/*` routes except `/api/contacts` POST and `/api/auth/*`

---

## STEP 4: BUILD THE PUBLIC WEBSITE

Follow the exact structure from `docs/ARCHITECTURE.md` section 2 and design specs from `docs/FuzionWebz_Design_Prompt.md`.

### Design System First:

**Colors** (in `tailwind.config.ts`):
```
pink: #E503A2 (primary)
cyan: #01FFFF (secondary)
white: #FFFFFF
black: #000000 (all backgrounds)
```

**Fonts** (in `src/styles/fonts.ts`):
- Anomalia — custom font, load from `/public/fonts/Anomalia/` (woff2/woff)
- Use for ALL text — headlines AND body. This is the only font.

**Global styles** (`src/app/globals.css`):
- Dark theme by default (black backgrounds everywhere)
- Custom cursor styles
- Smooth scroll (Lenis)
- Scrollbar styling (thin, pink thumb)
- Selection color: pink background, white text
- Focus-visible outlines: cyan

### Homepage Sections (in order):

Build each section as a separate component in `src/components/sections/`:

1. **Hero.tsx** — Full viewport, animated "FUZION WEBZ" headline (GSAP SplitText letter reveal), subtitle fade-in, magnetic CTA button, floating vector decorations, scroll indicator arrow
2. **HowItWorks.tsx** — 7-step process (I–VII), scroll-triggered stagger reveal, connecting SVG line animation
3. **AboutUs.tsx** — Two founder cards with hover photo effect (grayscale→color), bio reveal, numbered values section
4. **Services.tsx** — 6 service cards (2x3 grid), hover: lift + glow border, Lottie/SVG icons
5. **Portfolio.tsx** — Horizontal scroll carousel (GSAP ScrollTrigger pin), 6 projects, drag cursor, image scale on hover
6. **Pricing.tsx** — 3 tier cards, middle elevated with "מומלץ" badge, feature reveal animation, add-ons section
7. **Contact.tsx** — Oversized "בואו נדבר" headline, form with animated labels, WhatsApp button, submit to API
8. **Marquee.tsx** — Infinite scrolling text banner between sections, Anomalia font, low opacity

### Animation Components (`src/components/animations/`):

- **CustomCursor.tsx** — 12px default → 48px on links (mix-blend-mode: difference) → "View" on images → arrows on drag
- **PageTransition.tsx** — Black wipe → content reveal (Framer Motion AnimatePresence)
- **ScrollReveal.tsx** — Fade-up + scale(0.95→1) on viewport entry (Intersection Observer)
- **TextReveal.tsx** — Word-by-word reveal using GSAP ScrollTrigger
- **MagneticButton.tsx** — Element follows cursor within proximity radius
- **ParallaxLayer.tsx** — Elements move at 0.5x scroll speed
- **CountUp.tsx** — Numbers animate from 0 to target on scroll

### Shared Components:
- **WhatsAppButton.tsx** — Floating bottom-right, pink, links to wa.me/{number}
- **CookieConsent.tsx** — Banner on first visit, Essential/Analytics/Marketing toggles, stores in cookie
- **AccessibilityWidget.tsx** — Placeholder for UserWay integration script
- **Navbar.tsx** — Sticky, hide on scroll down / reveal on scroll up, transparent → solid on scroll

### Sub-pages:
- `/about` — Extended about page with timeline
- `/contact` — Full contact page with map placeholder
- `/blog` — Blog listing (placeholder cards for now)
- `/portfolio` — Grid view of all projects
- `/faq` — Accordion FAQ
- `/terms`, `/privacy`, `/accessibility` — Legal text pages

### SEO (every page):
- Next.js Metadata API with dynamic title, description, og:image
- Schema.org JSON-LD: LocalBusiness + Organization
- Sitemap via next-sitemap
- robots.txt
- Canonical URLs
- hreflang for Hebrew

---

## STEP 5: BUILD THE ADMIN DASHBOARD

### Layout:
- Dark sidebar (collapsible) with: Dashboard, Tasks, Projects, Contacts, Settings links
- Top bar with user avatar + logout
- Mobile: bottom tab bar

### Pages:

1. **Login** (`/admin/login`) — Email + password form, dark theme, logo above
2. **Dashboard** (`/admin`) — 4 stat cards + recent activity + quick-add task
3. **Tasks** (`/admin/tasks`) — Kanban board with 4 columns (TODO/IN_PROGRESS/REVIEW/DONE), drag-and-drop via @dnd-kit, filters (project, assignee, priority)
4. **Task Detail** (`/admin/tasks/[id]`) — Slide-in panel, edit all fields, comment thread
5. **Projects** (`/admin/projects`) — Card grid with status dots + progress bars
6. **Project Detail** (`/admin/projects/[id]`) — Project info + filtered task list
7. **Contacts** (`/admin/contacts`) — Inbox list, click to read, mark as read, WhatsApp reply link
8. **Settings** (`/admin/settings`) — Team member list (name, email, role)

### API Routes:
Build all routes as specified in `docs/ARCHITECTURE.md` section 4. Every protected route must:
- Check session via getServerSession
- Return 401 if no session
- Validate input with Zod schemas
- Handle errors with proper status codes

---

## STEP 6: DEPLOYMENT PREP

1. Create `next-sitemap.config.js` for auto sitemap
2. Create `.github/workflows/ci.yml` for lint + type-check
3. Create `vercel.json` if needed
4. Ensure `next.config.ts` has:
   - Image optimization (WebP/AVIF)
   - Strict mode enabled
   - Headers for security (X-Frame-Options, etc.)
5. Add `prefers-reduced-motion` media query respect in all animations

---

## STEP 7: GIT + PUSH

```bash
git init
git add .
git commit -m "Initial commit: Fuzion Webz complete rebuild"
git remote add origin https://github.com/fuzionwebz/fuzion-webz.git
git branch -M main
git push -u origin main --force
```

---

## DESIGN RULES (CRITICAL)

1. **ALL backgrounds are BLACK (#000000)**. No white backgrounds anywhere on the public site.
2. **Only font is Anomalia** — for everything: headlines, body, captions, navigation, buttons.
3. **Colors: Pink (#E503A2) + Cyan (#01FFFF) + White (#FFFFFF) on Black**. That's it.
4. **No 3D**. All visuals are 2D, vector, flat design.
5. **Every interactive element has a hover animation**. No static buttons or links.
6. **Custom cursor is always active** on desktop (hidden on touch devices).
7. **RTL support** for all Hebrew content. Proper `dir="rtl"` on Hebrew text blocks.
8. **Mobile-first** — every section must work perfectly on mobile.
9. **Performance** — Lighthouse 90+ target. Only animate transform & opacity.
10. **Accessibility** — WCAG 2.1 AA compliance. Israeli law IS 5568.

---

## CONTENT

All website text content is in `docs/FuzionWebz_Content_Document.docx`. Use the Hebrew text as-is for:
- Team bios (Roei & Elad descriptions)
- Service names and descriptions
- Pricing plans and features
- Navigation labels
- Footer categories

Portfolio projects: Inner Cosmos, Aquatis, Titans, Third Eye, Dental Care, AMS Law (placeholder images for now).

---

## REFERENCE SITE

**https://buzzworthystudio.com/** — This is the primary design reference. Match the energy, scroll behavior, typography scale, and animation quality. Adapt their patterns to our brand colors and 2D vector style.

---

## FINAL CHECKLIST

After building everything, verify:
- [ ] Homepage loads with hero animation
- [ ] Custom cursor works on desktop
- [ ] All 8 homepage sections render correctly
- [ ] Portfolio horizontal scroll works
- [ ] Pricing cards display correctly in Hebrew RTL
- [ ] Contact form submits to API
- [ ] WhatsApp button links correctly
- [ ] Cookie consent banner appears on first visit
- [ ] /admin/login works with seeded credentials
- [ ] Kanban board drag-and-drop works
- [ ] All API routes return proper responses
- [ ] Mobile responsive on all breakpoints
- [ ] Lighthouse performance > 90
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] Git pushed to GitHub successfully
