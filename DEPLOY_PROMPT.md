# Fuzion Webz — Fix, Build & Deploy Prompt

You are working on the Fuzion Webz Next.js project at `~/Desktop/fuzion-webz`.
The project is mostly built but has TypeScript errors that prevent `next build` from passing.
Your job is to fix ALL errors, verify the build passes, then push to the correct GitHub repo so Vercel auto-deploys.

---

## CONTEXT

- **Framework:** Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- **Current git remote:** `origin → https://github.com/DisasterDesign/fuzion-webz.git`
- **Vercel project:** `debatables-projects/landing-page` — connected to GitHub repo `DisasterDesign/landing-page` (branch `main`)
- **Domain:** `www.fuzionwebz.com` — already wired to that Vercel project
- **Goal:** Push this code to `DisasterDesign/landing-page` on branch `main` → Vercel auto-deploys → site goes live

---

## STEP 1 — Fix TypeScript / Build Errors

Run `npx prisma generate` first (requires DATABASE_URL — create a `.env` file if missing):

```
DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/fuzionwebz"
```

Then run `npx prisma generate` to generate the Prisma client types.

After that, run `npx tsc --noEmit` and fix every error. Known issues:

### 1a. Prisma Client imports
After `prisma generate`, imports like `import { PrismaClient } from "@prisma/client"` and `import { Prisma } from "@prisma/client"` should resolve. If they don't, check that `prisma` and `@prisma/client` are installed.

### 1b. Dashboard stats — `group.status` indexing error
File: `src/app/api/dashboard/stats/route.ts` line ~56.
The `group.status` type from `prisma.task.groupBy` may not index `taskCounts` directly.
Fix: cast `group.status` as `keyof typeof taskCounts`.

### 1c. Seed file — parameter `t` implicit any
File: `prisma/seed.ts` line ~129.
Add explicit type: `.map((t: { id: string }) => t.id)` or similar.

### 1d. Any other errors
Fix them. Use `npx tsc --noEmit` iteratively until zero errors.

---

## STEP 2 — Verify Build

Run:
```bash
npm run build
```

Fix any build errors. The build must pass with exit code 0.

Common issues to watch for:
- Missing `"use client"` directives on components using hooks
- Import paths that don't exist
- ESLint errors (fix or add `// eslint-disable-next-line` where appropriate)
- If `next build` can't download SWC binary, try `npm install @next/swc-linux-x64-gnu` or run on the local machine

---

## STEP 3 — Clean Up

Remove default Next.js boilerplate files that aren't used:
```bash
rm -f public/file.svg public/globe.svg public/next.svg public/vercel.svg public/window.svg
```

Make sure `.env` and `.env.local` are in `.gitignore` (they should be by default from create-next-app).

Ensure `.gitignore` includes:
```
node_modules/
.next/
.env
.env.local
.env.production.local
```

---

## STEP 4 — Change Git Remote & Force Push

The Vercel project `debatables-projects/landing-page` is connected to `DisasterDesign/landing-page` on GitHub.
We need to push our code THERE (not to `DisasterDesign/fuzion-webz`).

```bash
# Change remote to the correct repo
git remote set-url origin https://github.com/DisasterDesign/landing-page.git

# Stage everything
git add -A

# Commit (or amend if no new changes since last commit)
git commit -m "feat: complete Fuzion Webz website rebuild

- Next.js 16 App Router + TypeScript + Tailwind CSS 4
- RTL Hebrew site with Anomalia font
- GSAP + Framer Motion animations
- 8 homepage sections + sub-pages (about, portfolio, contact, faq, blog, terms, privacy, accessibility)
- Admin dashboard with Kanban task board, projects, contacts inbox
- NextAuth v5 credentials auth with JWT
- Prisma ORM with PostgreSQL schema
- Custom cursor, scroll animations, parallax effects
- WCAG 2.1 AA accessible, cookie consent, WhatsApp integration"

# Force push to main (this replaces the old landing-page code entirely)
git push --force origin main
```

After pushing, Vercel will automatically detect the push to `main` and start a new deployment.

---

## STEP 5 — Verify Deployment

After pushing, check:
1. Go to https://vercel.com/debatables-projects/landing-page/deployments
2. A new deployment should appear with status "Building"
3. Wait for it to complete
4. Visit https://www.fuzionwebz.com to verify the new site is live

### Vercel Environment Variables
The Vercel project needs these env vars set in the Vercel dashboard (Settings → Environment Variables):
- `DATABASE_URL` — PostgreSQL connection string (e.g. from Vercel Postgres, Supabase, Neon, etc.)
- `NEXTAUTH_SECRET` — random string, generate with `openssl rand -base64 32`
- `NEXTAUTH_URL` — `https://www.fuzionwebz.com`

**Without `DATABASE_URL`, the admin dashboard API routes will fail at runtime.** The public-facing site should work without it since it's all static/client-side.

---

## IMPORTANT NOTES

- Do NOT create a new Vercel project. We're using the existing one.
- Do NOT change the Vercel domain settings. `www.fuzionwebz.com` is already connected.
- The old code in `DisasterDesign/landing-page` will be completely replaced. That's intentional.
- After successful deployment, you can optionally delete the old `DisasterDesign/fuzion-webz` repo on GitHub since it's no longer needed.
- Font files are in `public/fonts/Anomalia/` — make sure they're committed (not gitignored).
- Brand assets (logos/icons) are in `public/` — make sure they're committed.
