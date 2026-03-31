# Fuzion Webz — Database Setup & Production Configuration

You are working on the Fuzion Webz Next.js project at `~/Desktop/fuzion-webz`.
The site is live at https://www.fuzionwebz.com (deployed via Vercel from `DisasterDesign/landing-page` repo).
The admin panel exists at `/admin/login` but doesn't work because there's no database connected.

Your job: Set up a PostgreSQL database, connect it to the project, and make the admin panel fully functional.

---

## STEP 1 — Create a Neon PostgreSQL Database

Neon offers free PostgreSQL databases. Create one:

1. Go to https://neon.tech and sign up (use GitHub login for speed)
2. Create a new project:
   - Name: `fuzion-webz`
   - Region: Choose closest to your users (e.g., `eu-central-1` for Israel)
   - PostgreSQL version: latest (16+)
3. After creation, Neon will show you connection strings. You need TWO:
   - **Pooled connection** (for general use) — looks like: `postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`
   - **Direct connection** (for migrations) — looks like: `postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require` (with `-pooler` removed from hostname)

Copy both connection strings.

---

## STEP 2 — Set Environment Variables in Vercel

Go to https://vercel.com → Project `landing-page` → Settings → Environment Variables

Add these variables (for ALL environments: Production, Preview, Development):

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | The **pooled** Neon connection string |
| `DIRECT_URL` | The **direct** (non-pooled) Neon connection string |
| `NEXTAUTH_SECRET` | Generate with: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://www.fuzionwebz.com` |

If `NEXT_PUBLIC_WHATSAPP_NUMBER` and other public vars aren't set, add them too:
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | The actual WhatsApp number (e.g., `972501234567`) |
| `NEXT_PUBLIC_SITE_URL` | `https://www.fuzionwebz.com` |
| `NEXT_PUBLIC_SITE_NAME` | `Fuzion Webz` |

---

## STEP 3 — Update Local .env

Update `~/Desktop/fuzion-webz/.env` with the same Neon connection strings:

```env
DATABASE_URL="postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require"
NEXTAUTH_SECRET="your-generated-secret-here"
NEXTAUTH_URL="http://localhost:3000"
```

⚠️ IMPORTANT: `.env` is gitignored — it will NOT be pushed to GitHub. This is correct.

---

## STEP 4 — Push Schema to Database

Run these commands locally:

```bash
cd ~/Desktop/fuzion-webz

# Push the Prisma schema to create all tables in Neon
npx prisma db push

# This should output: "Your database is now in sync with your Prisma schema."
```

This creates all tables: User, Project, Task, Comment, ContactSubmission, BlogPost, FontFamily, FontStyle, FontOrder.

---

## STEP 5 — Seed the Database

```bash
# Seed admin users and sample data
npx prisma db seed
```

This creates:
- **Roei Yehezkel** (roei@fuzionwebz.com) — ADMIN
- **Elad Nissim** (elad@fuzionwebz.com) — ADMIN
- Both with password: `FuzionAdmin2026!`
- 2 sample projects + 4 sample tasks

---

## STEP 6 — Verify Locally

```bash
# Restart the dev server
npm run dev
```

Then:
1. Go to http://localhost:3000/admin/login
2. Login with: `elad@fuzionwebz.com` / `FuzionAdmin2026!`
3. You should see the admin dashboard with stats
4. Check: Tasks page, Projects page, Contacts page, Blog page, Fonts page
5. Try creating a blog post: Admin → בלוג → מאמר חדש

---

## STEP 7 — Trigger Vercel Redeploy

Since we added env vars in Vercel but didn't push new code, trigger a redeploy:

```bash
# Make a tiny commit to trigger Vercel redeploy
git commit --allow-empty -m "chore: trigger redeploy with database env vars"
git push origin main
```

OR go to Vercel Dashboard → Deployments → click "..." on latest → "Redeploy"

---

## STEP 8 — Verify Production

1. Go to https://www.fuzionwebz.com/admin/login
2. Login with: `elad@fuzionwebz.com` / `FuzionAdmin2026!`
3. Verify all admin sections work:
   - Dashboard (stats should show)
   - Tasks (Kanban board)
   - Projects
   - Contacts
   - Blog (create + publish a test post)
   - Fonts (create a test font family)
4. Check public pages:
   - https://www.fuzionwebz.com/blog (should show published posts)
   - https://www.fuzionwebz.com/fonts (should show published fonts)
   - Contact form submission (should save to DB)

---

## STEP 9 — Optional: Prisma Studio (GUI for Database)

To visually browse/edit your database:

```bash
npx prisma studio
```

Opens at http://localhost:5555 — lets you see all tables, add/edit/delete records.

---

## TROUBLESHOOTING

### "Server error" on login page
→ DATABASE_URL is not set or invalid. Check Vercel env vars.

### "Invalid credentials" when logging in
→ Seed hasn't run. Run `npx prisma db seed`.

### Vercel build fails
→ Make sure `DATABASE_URL` env var is set in Vercel. Prisma generate runs during build.

### Blog/Fonts pages crash
→ Database tables don't exist. Run `npx prisma db push`.

### "PrismaClientInitializationError"
→ Connection string is wrong or Neon project is paused. Check Neon dashboard.

---

## SUMMARY

| What | Where |
|------|-------|
| Database | Neon PostgreSQL (free tier) |
| Admin URL | `/admin/login` |
| Admin users | roei@fuzionwebz.com, elad@fuzionwebz.com |
| Password | FuzionAdmin2026! |
| Prisma schema | `prisma/schema.prisma` |
| Seed file | `prisma/seed.ts` |
| ENV vars | Vercel Settings → Environment Variables |
| Local ENV | `.env` file (gitignored) |

After completing all steps, the full admin panel will work:
- Blog CMS with rich text editor
- Font store management
- Task/project management
- Contact form inbox
- Dashboard with stats
