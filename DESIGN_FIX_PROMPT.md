# Fuzion Webz — Design Overhaul & Backend Setup Prompt

You are working on the Fuzion Webz Next.js project at `~/Desktop/fuzion-webz`.
The site is live at https://www.fuzionwebz.com but needs major design fixes and backend setup.
Reference site: https://buzzworthystudio.com

Read this entire prompt before starting. Execute each section in order.

---

## SECTION 1 — Chromatic Aberration Color System (TikTok Effect)

**PROBLEM:** Pink (#E503A2) and Cyan (#01FFFF) are used statically throughout the site as plain text colors. This is NOT the design intent.

**DESIGN INTENT:** The pink and cyan should behave like a **chromatic aberration / TikTok glitch effect** — they are NOT meant to be used as standalone colors on static elements. Instead:

### Rules:
1. **Default state**: All text is WHITE. No pink or cyan text on load.
2. **Hover / interaction states**: Pink and cyan appear as a **split-color offset effect** — like a chromatic aberration where the text appears to "glitch" with a pink shadow offset in one direction and cyan in the other.
3. **Accent lines/borders**: Can use pink OR cyan as thin accent lines (1-2px), never as fills.
4. **CTAs (buttons)**: White text on transparent border. On hover → chromatic glitch effect on the text or a pink→cyan gradient sweep on the border.

### Implementation — Chromatic Aberration CSS Utility:
Create a reusable `.chromatic-hover` class and a React component:

```css
/* In globals.css */
.chromatic-hover {
  position: relative;
}
.chromatic-hover::before,
.chromatic-hover::after {
  content: attr(data-text);
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  transition: opacity 0.3s ease, transform 0.3s ease;
  pointer-events: none;
}
.chromatic-hover::before {
  color: #E503A2;
  z-index: -1;
}
.chromatic-hover::after {
  color: #01FFFF;
  z-index: -1;
}
.chromatic-hover:hover::before {
  opacity: 0.7;
  transform: translate(-3px, 2px);
}
.chromatic-hover:hover::after {
  opacity: 0.7;
  transform: translate(3px, -2px);
}
```

### Apply to:
- **Section headings** (h2, h3): Remove all `text-pink` and `text-cyan` classes from headings. Add `chromatic-hover` with `data-text` attribute instead. Headings should be white by default.
- **Nav links**: White by default, chromatic on hover.
- **CTA buttons**: White border + white text. On hover → chromatic text effect + border glow.
- **Card titles**: White by default, chromatic on hover.
- **Footer links**: Same treatment.
- **Pricing tier names**: White, chromatic on hover.

### What to KEEP in pink/cyan:
- The `<Badge>` "מומלץ" on pricing → keep pink background, it's a UI indicator.
- Thin accent lines (like the footer top border, card hover glow line) → keep but make subtle.
- The scroll progress indicator → can stay cyan.
- Form focus states → cyan underline is fine.

### Files to modify:
- `src/app/globals.css` — add chromatic classes
- `src/components/sections/Hero.tsx` — remove colored text, add chromatic effect to main heading
- `src/components/sections/Services.tsx` — card titles white, chromatic on hover
- `src/components/sections/AboutUs.tsx` — same
- `src/components/sections/HowItWorks.tsx` — step titles white, chromatic on hover
- `src/components/sections/Portfolio.tsx` — project names
- `src/components/sections/Pricing.tsx` — tier names, keep badge
- `src/components/sections/Contact.tsx` — heading
- `src/components/layout/Navbar.tsx` — links
- `src/components/layout/Footer.tsx` — links
- `src/components/ui/Button.tsx` — hover states
- `src/components/ui/Card.tsx` — hover glow effect

Create a `src/components/animations/ChromaticText.tsx` component:
```tsx
"use client";
import { cn } from "@/lib/utils";

interface ChromaticTextProps {
  text: string;
  as?: "h1" | "h2" | "h3" | "h4" | "span" | "p";
  className?: string;
  alwaysActive?: boolean; // for hero — always show the effect
}

export default function ChromaticText({ text, as: Tag = "span", className, alwaysActive }: ChromaticTextProps) {
  return (
    <Tag
      className={cn("chromatic-hover", alwaysActive && "chromatic-always", className)}
      data-text={text}
    >
      {text}
    </Tag>
  );
}
```

---

## SECTION 2 — Page Frame (Buzzworthy-style)

**WHAT:** The reference site has a visible frame/border around the entire viewport. Content sits inside a rounded container with a 10px gap on all sides, with the body background visible as the "frame".

### Implementation:
The site's main content wrapper should be inset from the viewport edges with rounded corners.

In `src/app/(public)/layout.tsx`, wrap all content in a frame container:

```tsx
<div className="fixed inset-0 z-0 bg-neutral-900" /> {/* Frame background - slightly lighter than content */}
<div className="fixed inset-[10px] z-[1] rounded-[20px] overflow-hidden bg-black">
  {/* All existing content goes here */}
  <div className="h-full overflow-y-auto" id="smooth-content">
    {children}
  </div>
</div>
```

**Frame color:** The body/html background = `#111` or `#0a0a0a` (very dark gray). The inner content area = `#000` (pure black). This creates a subtle but visible frame.

Make sure:
- The Navbar is positioned inside the frame container
- The custom cursor is OUTSIDE the frame (on the body level) so it moves across the frame too
- WhatsApp button is inside the frame
- Mobile: reduce inset to `5px` and border-radius to `12px`

---

## SECTION 3 — Grid Background on Scroll

**WHAT:** A subtle grid/lines pattern that appears in the background, becoming visible as users scroll through certain sections.

### Implementation:
Create `src/components/animations/GridBackground.tsx`:

```tsx
"use client";
import { motion, useScroll, useTransform } from "framer-motion";

export default function GridBackground() {
  const { scrollYProgress } = useScroll();
  const opacity = useTransform(scrollYProgress, [0, 0.1, 0.9, 1], [0, 0.15, 0.15, 0]);

  return (
    <motion.div
      className="fixed inset-[10px] rounded-[20px] pointer-events-none z-[2]"
      style={{
        opacity,
        backgroundImage: `
          linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)
        `,
        backgroundSize: "60px 60px",
      }}
    />
  );
}
```

Add this component to the public layout, rendered inside the frame but behind content (z-index between frame and content).

---

## SECTION 4 — Loader / Intro Animation

**WHAT:** A loading screen animation that plays on first visit:
1. Full-screen black background
2. The Fuzion Webz logo SVG draws on with a line animation (stroke-dasharray → stroke-dashoffset animation)
3. After the logo draws, the chromatic aberration effect fires — the logo splits briefly into pink and cyan offset copies
4. Then the logo scales down and "drives" (translates) to the top-right corner (where it sits in the navbar)
5. The loader fades out revealing the site

### Implementation:
Create `src/components/animations/Loader.tsx`:

Key technical approach:
- Use the existing `logo-white.svg` from `/public/` — load it inline as an SVG component
- Apply `stroke-dasharray` and `stroke-dashoffset` CSS animation to draw the paths
- Use GSAP timeline:
  1. `0s → 1.5s`: SVG paths animate from dashoffset=length to 0 (drawing on)
  2. `1.5s → 2s`: Chromatic split — clone the SVG twice, tint pink and cyan, offset them ±4px, then merge back
  3. `2s → 2.8s`: Logo scales from centered (scale ~2) down to navbar size and translates to top-right position
  4. `2.8s → 3.2s`: Black overlay fades out, site is revealed
- Store "has visited" in sessionStorage so the loader only plays once per session
- The loader should be in the root layout, above everything, with z-index 9999
- After animation completes, set `display: none` on the loader

### Files:
- Create `src/components/animations/Loader.tsx`
- Modify `src/app/(public)/layout.tsx` to include `<Loader />`
- The logo SVG paths need to be inlined — read the SVG file from `public/logo-white.svg` and convert to a React component

---

## SECTION 5 — Backend Setup

**PROBLEM:** The backend (admin dashboard, API routes) requires a PostgreSQL database but none is configured yet.

### Steps:

### 5a. Create a Vercel Postgres database:
This step must be done manually by the user in the Vercel dashboard. But prepare everything else:

Create `.env.example`:
```env
# Database
DATABASE_URL="postgresql://user:password@host:5432/fuzionwebz?sslmode=require"

# Auth
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="https://www.fuzionwebz.com"
```

### 5b. Fix Prisma for Vercel deployment:
Update `prisma/schema.prisma` — add Vercel-compatible settings:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

### 5c. Add postinstall script for Prisma generate:
In `package.json`, add to scripts:
```json
"postinstall": "prisma generate"
```
This ensures Prisma client is generated during Vercel's `npm install` step.

### 5d. Create NextAuth route handler:
Verify `src/app/api/auth/[...nextauth]/route.ts` exists and exports:
```ts
import { handlers } from "@/lib/auth";
export const { GET, POST } = handlers;
```

### 5e. Seed script is ready:
`prisma/seed.ts` already exists with admin users (roei@fuzionwebz.com, elad@fuzionwebz.com, password: FuzionAdmin2026!).

### 5f. Add build-time safety:
Some API routes import `prisma` which will fail at build time without DATABASE_URL.
Add a build-safe prisma client in `src/lib/prisma.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

This is likely already correct, but verify it.

---

## SECTION 6 — Push & Deploy

After ALL fixes above:

```bash
git add -A
git commit -m "feat: chromatic aberration color system, page frame, grid bg, loader animation, backend prep

- Replace static pink/cyan with chromatic aberration hover effect (TikTok-style)
- Add Buzzworthy-style page frame with 10px inset and rounded corners
- Add subtle grid background that appears on scroll
- Add SVG logo loader with line draw, chromatic split, and fly-to-corner animation
- Add postinstall prisma generate for Vercel deployment
- Add .env.example for backend configuration"

git push origin main
```

Vercel will auto-deploy from the push.

---

## IMPORTANT NOTES

- **Font:** Anomalia is the ONLY font. Do not add any other fonts.
- **Language:** All UI text is in Hebrew. Direction is RTL.
- **Backgrounds:** ALL section backgrounds are pure BLACK (#000). Never white.
- **Frame background:** Very dark gray (#111 or #0a0a0a) — just enough contrast to see the frame.
- **No 3D:** Everything is 2D vector only. No Three.js, no WebGL.
- **The grid is CSS only** — no canvas, no WebGL. Just CSS `background-image` with `linear-gradient`.
- **Test on mobile:** The frame should adapt (smaller inset), the loader should work, chromatic effect can be reduced/disabled on touch devices.
- **`prefers-reduced-motion`:** Respect it — skip loader, disable chromatic animation, simplify transitions.
