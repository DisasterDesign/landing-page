# Fuzion Webz - Backend Architecture Document

## Tech Stack

**Frontend:** Next.js 14+ (App Router, React Server Components)
**Backend:** Node.js + Next.js API Routes
**Database:** PostgreSQL (via Supabase or self-hosted)
**ORM:** Prisma
**Auth:** NextAuth.js (credentials-based, team only)
**Hosting:** Vercel (frontend) + Railway/Render (DB)
**Language:** TypeScript throughout

---

## System Overview

```
┌─────────────────────────────────────────────────┐
│                  FRONTEND (Next.js)              │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ Public    │  │ Admin    │  │ API Routes   │  │
│  │ Website   │  │ Dashboard│  │ /api/*       │  │
│  │ (SSG/SSR) │  │ (CSR+SSR)│  │              │  │
│  └──────────┘  └──────────┘  └──────┬───────┘  │
│                                      │          │
└──────────────────────────────────────┼──────────┘
                                       │
                          ┌────────────▼──────────┐
                          │   PostgreSQL Database  │
                          │                        │
                          │  users / tasks /       │
                          │  projects / contacts   │
                          └────────────────────────┘
```

---

## Database Schema (Prisma)

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  password  String   // bcrypt hashed
  role      Role     @default(MEMBER)
  avatar    String?
  tasks     Task[]   @relation("assignee")
  createdTasks Task[] @relation("creator")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

enum Role {
  ADMIN
  MEMBER
}

model Project {
  id          String   @id @default(cuid())
  name        String
  client      String?
  status      ProjectStatus @default(ACTIVE)
  description String?
  tasks       Task[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

enum ProjectStatus {
  ACTIVE
  ON_HOLD
  COMPLETED
  ARCHIVED
}

model Task {
  id          String     @id @default(cuid())
  title       String
  description String?
  status      TaskStatus @default(TODO)
  priority    Priority   @default(MEDIUM)
  dueDate     DateTime?
  project     Project?   @relation(fields: [projectId], references: [id])
  projectId   String?
  assignee    User?      @relation("assignee", fields: [assigneeId], references: [id])
  assigneeId  String?
  creator     User       @relation("creator", fields: [creatorId], references: [id])
  creatorId   String
  tags        String[]   // PostgreSQL array
  comments    Comment[]
  order       Int        @default(0) // for drag-and-drop sorting
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
}

enum TaskStatus {
  TODO
  IN_PROGRESS
  REVIEW
  DONE
}

enum Priority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

model Comment {
  id        String   @id @default(cuid())
  content   String
  task      Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  taskId    String
  authorId  String
  createdAt DateTime @default(now())
}

model ContactSubmission {
  id        String   @id @default(cuid())
  name      String
  email     String
  phone     String?
  message   String
  source    String?  // landing page, contact form, etc.
  read      Boolean  @default(false)
  createdAt DateTime @default(now())
}
```

---

## API Routes Structure

```
/api
├── /auth
│   ├── [...nextauth].ts    # NextAuth handler
│   └── /register.ts        # Initial team setup only
│
├── /tasks
│   ├── GET    /             # List tasks (filterable)
│   ├── POST   /             # Create task
│   ├── PATCH  /[id]         # Update task
│   ├── DELETE /[id]         # Delete task
│   ├── PATCH  /[id]/status  # Quick status update
│   └── POST   /reorder      # Drag-and-drop reorder
│
├── /projects
│   ├── GET    /             # List projects
│   ├── POST   /             # Create project
│   ├── PATCH  /[id]         # Update project
│   └── GET    /[id]/tasks   # Tasks by project
│
├── /comments
│   ├── POST   /             # Add comment to task
│   └── DELETE /[id]         # Delete comment
│
├── /contacts
│   ├── POST   /             # Public: submit contact form
│   ├── GET    /             # Admin: list submissions
│   └── PATCH  /[id]/read    # Mark as read
│
└── /dashboard
    └── GET    /stats        # Task counts, project summary
```

---

## Authentication Flow

```
1. Team member navigates to /admin
2. Redirected to /admin/login
3. Enters email + password
4. NextAuth validates credentials against DB
5. JWT session created (httpOnly cookie)
6. Middleware protects all /admin/* and /api/* routes
7. No public registration - users created manually or via seed
```

**Security layers:**
- bcrypt password hashing (12 rounds)
- JWT with 24h expiration + refresh
- CSRF protection via NextAuth
- Rate limiting on auth endpoints
- All /api routes check session before processing

---

## Admin Dashboard Pages

```
/admin
├── /dashboard          # Overview: active tasks, project stats
├── /tasks              # Kanban board (TODO → IN_PROGRESS → REVIEW → DONE)
├── /tasks/[id]         # Task detail + comments
├── /projects           # Project list with status filters
├── /projects/[id]      # Project detail + associated tasks
├── /contacts           # Contact form submissions inbox
├── /settings           # Team member management
└── /login              # Auth page
```

**Key UI features:**
- Drag-and-drop Kanban board (using @dnd-kit/core)
- Real-time task status updates
- Filter by assignee, project, priority, status
- Mobile-responsive admin panel
- WhatsApp notification integration for urgent tasks

---

## Public Website Architecture

```
/                       # Homepage (SSG - static generation)
├── /blog               # Blog listing (ISR - incremental static regen)
├── /blog/[slug]        # Blog post (ISR)
├── /portfolio          # Portfolio grid
├── /portfolio/[slug]   # Case study detail
├── /faq                # FAQ page (SSG)
├── /about              # About page (SSG)
├── /contact            # Contact form page
├── /terms              # Terms & Conditions
├── /privacy            # Privacy Policy
├── /accessibility      # Accessibility statement
└── /sitemap.xml        # Auto-generated sitemap
```

---

## SEO Implementation

- **Meta tags:** Dynamic per page via Next.js Metadata API
- **Schema.org:** LocalBusiness + Organization + Service structured data
- **Open Graph:** og:title, og:description, og:image per page
- **Sitemap:** Auto-generated via next-sitemap
- **Robots.txt:** Generated at build time
- **Canonical URLs:** Set on every page
- **Performance:** Core Web Vitals optimized (LCP < 2.5s, CLS < 0.1)
- **Hebrew RTL:** Proper dir="rtl" + hreflang tags
- **Image optimization:** Next.js Image component with WebP/AVIF

---

## Accessibility (Israeli Law - Equal Rights for Persons with Disabilities)

Per Israeli Standard IS 5568, the site must comply with WCAG 2.1 AA:

- **Accessibility widget:** UserWay or similar overlay (quick compliance)
- **Native implementation:**
  - Semantic HTML throughout
  - ARIA labels on interactive elements
  - Keyboard navigation support
  - Skip-to-content link
  - Sufficient color contrast ratios (4.5:1 minimum)
  - Focus indicators on all interactive elements
  - Alt text on all images
  - Form labels properly associated
- **Accessibility statement page** at /accessibility
- **Annual audit** recommended

---

## Cookie Consent (GDPR/Israeli Privacy Protection Law)

- Cookie consent banner on first visit
- Categories: Essential, Analytics, Marketing
- Consent stored in localStorage + cookie
- Google Analytics / Tag Manager loads only after consent
- Cookie policy page with full disclosure
- Implementation: custom lightweight component (no heavy third-party)

---

## Social & WhatsApp Integration

- **WhatsApp:** Floating button (bottom-right) with pre-filled message
- **Social links:** Instagram, Facebook, LinkedIn, TikTok (configurable via admin)
- **WhatsApp API:** Direct link format `https://wa.me/972XXXXXXXXX?text=...`
- **Share buttons:** On blog posts and portfolio items

---

## Deployment Pipeline

```
GitHub Repository
    │
    ├── Push to main → Vercel auto-deploy (production)
    ├── Push to dev  → Vercel preview deployment
    │
    └── Database
        ├── Production: Railway/Supabase PostgreSQL
        └── Development: Local Docker PostgreSQL
```

**CI/CD:**
- ESLint + TypeScript check on every PR
- Lighthouse CI for performance monitoring
- Prisma migrations run on deploy

---

## Project Structure

```
fuzionwebz/
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
├── public/
│   ├── fonts/              # Custom fonts
│   ├── images/
│   └── icons/
├── src/
│   ├── app/
│   │   ├── (public)/       # Public website routes
│   │   │   ├── page.tsx    # Homepage
│   │   │   ├── blog/
│   │   │   ├── portfolio/
│   │   │   ├── contact/
│   │   │   └── layout.tsx
│   │   ├── admin/          # Protected admin routes
│   │   │   ├── dashboard/
│   │   │   ├── tasks/
│   │   │   ├── projects/
│   │   │   ├── contacts/
│   │   │   └── layout.tsx
│   │   ├── api/            # API routes
│   │   └── layout.tsx      # Root layout
│   ├── components/
│   │   ├── ui/             # Reusable UI components
│   │   ├── public/         # Public site components
│   │   ├── admin/          # Admin dashboard components
│   │   └── animations/     # Framer Motion animations
│   ├── lib/
│   │   ├── prisma.ts       # Prisma client
│   │   ├── auth.ts         # NextAuth config
│   │   └── utils.ts
│   ├── hooks/              # Custom React hooks
│   ├── styles/
│   │   ├── globals.css     # Tailwind + custom CSS
│   │   └── fonts.ts        # Font definitions
│   └── types/
│       └── index.ts
├── package.json
├── tailwind.config.ts
├── next.config.ts
└── tsconfig.json
```

---

## Animation Stack (Frontend)

- **Framer Motion:** Page transitions, scroll animations, hover effects
- **GSAP (GreenSock):** Complex timeline animations, scroll-triggered
- **Lottie:** Vector animations for illustrations and icons
- **CSS Animations:** Micro-interactions, cursor effects
- **Intersection Observer:** Lazy loading + scroll reveal

**No 3D** - all effects are 2D vector-based, playful, and performant.

---

## Estimated Timeline

| Phase | Duration | Deliverables |
|-------|----------|-------------|
| Design System | 1 week | Fonts, colors, logo, component library |
| Frontend Development | 3-4 weeks | All public pages + animations |
| Backend + Admin | 2-3 weeks | Task management system + auth |
| Content & SEO | 1 week | Content migration, meta tags, schema |
| Testing & Launch | 1 week | QA, accessibility audit, deployment |

**Total: ~8-10 weeks**
