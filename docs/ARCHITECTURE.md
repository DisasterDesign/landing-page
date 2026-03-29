# Fuzion Webz — Full Architecture Document
## Frontend + Backend + Infrastructure

---

## 1. TECH STACK

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Framework | Next.js 14+ (App Router) | SSR/SSG, API routes, routing |
| Language | TypeScript | Type safety throughout |
| Styling | Tailwind CSS 4 + CSS Modules | Utility-first + scoped animations |
| Animation | GSAP + Framer Motion + Lottie | Scroll, hover, page transitions |
| Database | PostgreSQL | Relational data (tasks, projects) |
| ORM | Prisma | Type-safe DB queries |
| Auth | NextAuth.js v5 | Team-only JWT authentication |
| Deployment | Vercel | Frontend + API + Edge |
| DB Hosting | Neon / Supabase | Serverless PostgreSQL |
| Package Manager | pnpm | Fast, disk-efficient |

---

## 2. PROJECT STRUCTURE

```
fuzion-webz/
├── .github/
│   └── workflows/
│       └── ci.yml                  # Lint + type-check on PR
├── prisma/
│   ├── schema.prisma               # Database schema
│   ├── seed.ts                     # Seed 2 team users
│   └── migrations/                 # Auto-generated
├── public/
│   ├── fonts/
│   │   └── Anomalia/               # Custom font files (woff2, woff)
│   ├── images/
│   │   ├── portfolio/              # Project screenshots
│   │   └── team/                   # Founder photos
│   ├── lottie/                     # Lottie JSON animations
│   ├── logo-white.svg
│   ├── logo-black.svg
│   ├── og-image.jpg                # Default Open Graph image
│   ├── favicon.ico
│   └── robots.txt
├── src/
│   ├── app/
│   │   ├── (public)/               # PUBLIC WEBSITE (no auth)
│   │   │   ├── layout.tsx          # Public layout (nav + footer)
│   │   │   ├── page.tsx            # Homepage (all sections)
│   │   │   ├── blog/
│   │   │   │   ├── page.tsx        # Blog listing
│   │   │   │   └── [slug]/
│   │   │   │       └── page.tsx    # Blog post
│   │   │   ├── portfolio/
│   │   │   │   ├── page.tsx        # Portfolio grid
│   │   │   │   └── [slug]/
│   │   │   │       └── page.tsx    # Case study
│   │   │   ├── about/
│   │   │   │   └── page.tsx
│   │   │   ├── contact/
│   │   │   │   └── page.tsx
│   │   │   ├── faq/
│   │   │   │   └── page.tsx
│   │   │   ├── terms/
│   │   │   │   └── page.tsx
│   │   │   ├── privacy/
│   │   │   │   └── page.tsx
│   │   │   └── accessibility/
│   │   │       └── page.tsx
│   │   ├── admin/                  # ADMIN PANEL (auth required)
│   │   │   ├── layout.tsx          # Admin layout (sidebar)
│   │   │   ├── page.tsx            # Dashboard
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── tasks/
│   │   │   │   ├── page.tsx        # Kanban board
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx    # Task detail
│   │   │   ├── projects/
│   │   │   │   ├── page.tsx        # Project list
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx    # Project detail
│   │   │   ├── contacts/
│   │   │   │   └── page.tsx        # Contact submissions inbox
│   │   │   └── settings/
│   │   │       └── page.tsx        # Team settings
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   └── [...nextauth]/
│   │   │   │       └── route.ts
│   │   │   ├── tasks/
│   │   │   │   ├── route.ts        # GET list, POST create
│   │   │   │   ├── [id]/
│   │   │   │   │   └── route.ts    # PATCH, DELETE
│   │   │   │   └── reorder/
│   │   │   │       └── route.ts    # PATCH reorder
│   │   │   ├── projects/
│   │   │   │   ├── route.ts
│   │   │   │   └── [id]/
│   │   │   │       └── route.ts
│   │   │   ├── comments/
│   │   │   │   ├── route.ts
│   │   │   │   └── [id]/
│   │   │   │       └── route.ts
│   │   │   ├── contacts/
│   │   │   │   ├── route.ts        # POST public, GET admin
│   │   │   │   └── [id]/
│   │   │   │       └── route.ts
│   │   │   └── dashboard/
│   │   │       └── stats/
│   │   │           └── route.ts
│   │   ├── globals.css             # Tailwind + custom props + animations
│   │   ├── layout.tsx              # Root layout (fonts, metadata)
│   │   └── not-found.tsx           # Custom 404
│   ├── components/
│   │   ├── ui/                     # Reusable primitives
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Tooltip.tsx
│   │   │   └── LoadingSpinner.tsx
│   │   ├── layout/
│   │   │   ├── Navbar.tsx          # Public nav (reveal/hide on scroll)
│   │   │   ├── Footer.tsx          # Public footer
│   │   │   ├── AdminSidebar.tsx    # Admin sidebar nav
│   │   │   └── MobileMenu.tsx      # Mobile hamburger menu
│   │   ├── sections/               # Homepage sections
│   │   │   ├── Hero.tsx
│   │   │   ├── HowItWorks.tsx
│   │   │   ├── AboutUs.tsx
│   │   │   ├── Services.tsx
│   │   │   ├── Portfolio.tsx
│   │   │   ├── Pricing.tsx
│   │   │   ├── Contact.tsx
│   │   │   └── Marquee.tsx
│   │   ├── animations/
│   │   │   ├── CustomCursor.tsx    # Global custom cursor
│   │   │   ├── PageTransition.tsx  # Route transition wrapper
│   │   │   ├── ScrollReveal.tsx    # Scroll-triggered reveal
│   │   │   ├── TextReveal.tsx      # Word-by-word text animation
│   │   │   ├── MagneticButton.tsx  # Magnetic hover effect
│   │   │   ├── ParallaxLayer.tsx   # Parallax scroll elements
│   │   │   └── CountUp.tsx         # Number count-up on scroll
│   │   ├── admin/
│   │   │   ├── KanbanBoard.tsx     # Drag-and-drop task board
│   │   │   ├── KanbanColumn.tsx
│   │   │   ├── TaskCard.tsx
│   │   │   ├── TaskForm.tsx
│   │   │   ├── ProjectCard.tsx
│   │   │   ├── StatsCards.tsx
│   │   │   └── ContactInbox.tsx
│   │   └── shared/
│   │       ├── WhatsAppButton.tsx  # Floating WhatsApp CTA
│   │       ├── CookieConsent.tsx   # Cookie banner
│   │       ├── AccessibilityWidget.tsx
│   │       ├── SocialLinks.tsx
│   │       └── SEOHead.tsx         # Per-page SEO component
│   ├── lib/
│   │   ├── prisma.ts              # Prisma client singleton
│   │   ├── auth.ts                # NextAuth configuration
│   │   ├── utils.ts               # Helper functions
│   │   └── constants.ts           # Site-wide constants
│   ├── hooks/
│   │   ├── useScrollDirection.ts  # Detect scroll up/down
│   │   ├── useInView.ts          # Intersection observer
│   │   ├── useMousePosition.ts   # Custom cursor tracking
│   │   └── useLenisScroll.ts     # Smooth scroll (Lenis)
│   ├── styles/
│   │   ├── fonts.ts              # Font declarations (Anomalia, Inter, Heebo)
│   │   └── animations.css        # GSAP & keyframe definitions
│   └── types/
│       └── index.ts              # Shared TypeScript types
├── .env.local                     # Environment variables (gitignored)
├── .env.example                   # Template for env vars
├── .eslintrc.json
├── .prettierrc
├── next.config.ts
├── next-sitemap.config.js         # Auto sitemap generation
├── tailwind.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## 3. DATABASE SCHEMA

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ==================== AUTH ====================

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String
  passwordHash  String
  role          Role      @default(MEMBER)
  avatarUrl     String?
  assignedTasks Task[]    @relation("TaskAssignee")
  createdTasks  Task[]    @relation("TaskCreator")
  comments      Comment[]
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

enum Role {
  ADMIN
  MEMBER
}

// ==================== PROJECTS ====================

model Project {
  id          String        @id @default(cuid())
  name        String
  client      String?
  description String?
  status      ProjectStatus @default(ACTIVE)
  color       String        @default("#E503A2") // for UI label
  tasks       Task[]
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
}

enum ProjectStatus {
  ACTIVE
  ON_HOLD
  COMPLETED
  ARCHIVED
}

// ==================== TASKS ====================

model Task {
  id          String     @id @default(cuid())
  title       String
  description String?
  status      TaskStatus @default(TODO)
  priority    Priority   @default(MEDIUM)
  dueDate     DateTime?
  order       Int        @default(0)
  tags        String[]
  project     Project?   @relation(fields: [projectId], references: [id])
  projectId   String?
  assignee    User?      @relation("TaskAssignee", fields: [assigneeId], references: [id])
  assigneeId  String?
  creator     User       @relation("TaskCreator", fields: [creatorId], references: [id])
  creatorId   String
  comments    Comment[]
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  @@index([status])
  @@index([projectId])
  @@index([assigneeId])
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

// ==================== COMMENTS ====================

model Comment {
  id        String   @id @default(cuid())
  content   String
  task      Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  taskId    String
  author    User     @relation(fields: [authorId], references: [id])
  authorId  String
  createdAt DateTime @default(now())

  @@index([taskId])
}

// ==================== CONTACT FORM ====================

model ContactSubmission {
  id        String   @id @default(cuid())
  name      String
  email     String
  phone     String?
  message   String
  source    String?
  isRead    Boolean  @default(false)
  createdAt DateTime @default(now())

  @@index([isRead])
}
```

---

## 4. API ROUTES SPECIFICATION

### Auth
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | /api/auth/[...nextauth] | Public | NextAuth handler (login/logout/session) |

### Tasks
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | /api/tasks | Team | List all tasks (query: status, project, assignee, priority) |
| POST | /api/tasks | Team | Create task |
| PATCH | /api/tasks/[id] | Team | Update task fields |
| DELETE | /api/tasks/[id] | Team | Delete task |
| PATCH | /api/tasks/reorder | Team | Reorder tasks (drag-and-drop) |

### Projects
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | /api/projects | Team | List all projects |
| POST | /api/projects | Team | Create project |
| PATCH | /api/projects/[id] | Team | Update project |
| GET | /api/projects/[id] | Team | Get project + tasks |

### Comments
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | /api/comments | Team | Add comment to task |
| DELETE | /api/comments/[id] | Team | Delete own comment |

### Contacts
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | /api/contacts | Public | Submit contact form (rate-limited) |
| GET | /api/contacts | Team | List submissions |
| PATCH | /api/contacts/[id] | Team | Mark as read |

### Dashboard
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | /api/dashboard/stats | Team | Aggregated stats |

---

## 5. FRONTEND HOMEPAGE SECTIONS — DETAILED SPEC

### 5.1 Hero
```
- Full viewport height (100vh)
- Black background
- Animated headline: "FUZION WEBZ" in Anomalia, letter-by-letter reveal (GSAP SplitText)
- Subtitle fades in 0.5s after headline: "בניית אתרים מתקדמים"
- CTA button: "בואו נדבר" → scrolls to contact section
- Button: MagneticButton component (follows cursor on proximity)
- Decorative: 2-3 floating SVG vector shapes (pink/cyan) with parallax
- Scroll indicator: animated bouncing arrow at bottom
```

### 5.2 How It Works
```
- Section title: "איך זה עובד?" with ScrollReveal
- 7 steps displayed as vertical timeline or horizontal scroll
- Step numbers: I–VII in Anomalia font, pink color, large (48px)
- Each step: number + title + short description
- Animation: steps reveal one by one as user scrolls (stagger 0.15s)
- Connecting line animates between steps (SVG path draw)
```

### 5.3 About Us
```
- Section title: "מי אנחנו?"
- Two cards: Roei (left) + Elad (right)
- Card: photo (grayscale → color on hover) + name + role + bio
- Bio text: ScrollReveal, lines appear sequentially
- Below cards: "הערכים שלנו" section with 3-5 numbered values (Buzzworthy "Attitude" style)
- Each value: bold number + title + short text
```

### 5.4 Services
```
- Section title: "השירותים שלנו"
- 6 cards in 2x3 or 3x2 grid
- Card: icon (Lottie or SVG) + title + brief description
- Hover: card lifts (translateY -8px) + pink/cyan border-glow + icon animates
- Each card links to contact with pre-filled service type
```

### 5.5 Portfolio
```
- Section title: "העבודות שלנו"
- Horizontal scroll carousel (GSAP horizontal scroll pin)
- 6 projects: each takes ~60vw width
- Project card: large screenshot + title overlay
- Hover: image scales 1.05 + title slides up + "View Project →" appears
- Custom cursor shows drag arrows in this section
- "View all work →" link at end
```

### 5.6 Pricing
```
- Section title: "מסלולי שירות"
- 3 pricing cards side by side
- Middle card (מתקדמת) elevated + pink "מומלץ" badge
- Feature list with ✓/✕ icons, staggered reveal
- CTA per card: "בואו נדבר" button
- Below cards: "בתשלום נוסף" add-ons as pill/tag list
```

### 5.7 Contact
```
- Oversized "LET'S TALK" or "בואו נדבר" headline (Buzzworthy-style, full-width)
- Contact form: name, email, phone, message, service dropdown
- Animated input labels (float up on focus, color: cyan)
- Submit button with loading state (pulsing dots → Lottie checkmark)
- WhatsApp direct CTA button (prominent, pink)
- Form submits to /api/contacts
```

### 5.8 Footer
```
- Top: thin pink accent line
- 3 columns: שירותים | משאבים | החברה
- Social icons: hover scale + color pulse
- Newsletter email input + subscribe button
- Bottom: © 2026 Fuzion Webz | accessibility link
```

---

## 6. ADMIN DASHBOARD SPEC

### 6.1 Dashboard Home
- 4 stat cards: Total Tasks, In Progress, Due This Week, Unread Contacts
- Recent activity timeline
- Quick-add task button

### 6.2 Kanban Board
- 4 columns: TODO → IN_PROGRESS → REVIEW → DONE
- Drag-and-drop between columns (@dnd-kit/core)
- Task card shows: title, priority badge, assignee avatar, due date
- Click card → opens detail panel (slide-in from right)
- Filters: project, assignee, priority
- Mobile: swipeable columns

### 6.3 Project Management
- Project cards with status indicator (color dot)
- Click → project detail with task list
- Progress bar based on task completion %

### 6.4 Contact Inbox
- List view: name, email, date, read/unread badge
- Click → full message + mark as read
- Quick reply → opens WhatsApp with pre-filled message

---

## 7. ENVIRONMENT VARIABLES

```env
# Database
DATABASE_URL="postgresql://user:password@host:5432/fuzionwebz"

# NextAuth
NEXTAUTH_URL="https://fuzionwebz.com"
NEXTAUTH_SECRET="generate-a-random-secret-here"

# Analytics (loaded after cookie consent)
NEXT_PUBLIC_GA_ID="G-XXXXXXXXXX"

# WhatsApp
NEXT_PUBLIC_WHATSAPP_NUMBER="972XXXXXXXXX"
NEXT_PUBLIC_WHATSAPP_MESSAGE="היי, אשמח לשמוע עוד על השירותים שלכם"

# Site
NEXT_PUBLIC_SITE_URL="https://fuzionwebz.com"
NEXT_PUBLIC_SITE_NAME="Fuzion Webz"
```

---

## 8. DEPLOYMENT FLOW

```
1. Push to GitHub → fuzionwebz/fuzion-webz (new clean repo)
2. Connect to Vercel → auto-deploy on push to main
3. Provision Neon PostgreSQL → set DATABASE_URL
4. Run prisma migrate deploy on first deploy
5. Run prisma db seed to create 2 team users
6. Configure custom domain: fuzionwebz.com → Vercel
7. Set environment variables in Vercel dashboard
8. Enable Vercel Analytics + Speed Insights
```

---

## 9. KEY DEPENDENCIES

```json
{
  "dependencies": {
    "next": "^14.2",
    "@next-auth/prisma-adapter": "^1.0",
    "next-auth": "^5.0",
    "@prisma/client": "^5.0",
    "framer-motion": "^11.0",
    "gsap": "^3.12",
    "@dnd-kit/core": "^6.0",
    "@dnd-kit/sortable": "^8.0",
    "lottie-react": "^2.4",
    "@lenis/react": "^1.0",
    "next-sitemap": "^4.0",
    "bcryptjs": "^2.4",
    "zod": "^3.22",
    "date-fns": "^3.0",
    "react-hot-toast": "^2.4",
    "tailwind-merge": "^2.0",
    "clsx": "^2.0"
  },
  "devDependencies": {
    "prisma": "^5.0",
    "typescript": "^5.0",
    "@types/react": "^18.0",
    "@types/node": "^20.0",
    "eslint": "^8.0",
    "eslint-config-next": "^14.0",
    "prettier": "^3.0",
    "tailwindcss": "^4.0",
    "@tailwindcss/typography": "^0.5"
  }
}
```
