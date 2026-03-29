# Fuzion Webz — Website Redesign Prompt

> Use this prompt with any AI design tool (v0, Lovable, Bolt, etc.) or hand it to a designer/developer as a comprehensive brief.

---

## IDENTITY

**Brand:** Fuzion Webz (פיוזאן וואב) — Boutique web design studio based in Israel
**Founders:** Roei Yehezkel & Elad Nissim
**Tagline direction:** Bold, young, playful, conversion-focused

---

## DESIGN REFERENCE

**Primary inspiration:** [buzzworthystudio.com](https://buzzworthystudio.com/)

Take from Buzzworthy:
- Black-dominant backgrounds with high-contrast accent colors
- Kinetic typography — headlines that animate, scale, and transform on scroll
- Full-viewport sections with scroll-triggered transitions
- Custom cursor that changes on hover (expand, text label, blend mode)
- Horizontal marquee text banners
- Staggered entry animations for content blocks
- Bold section numbering (RULE NO.1, RULE NO.2 style)
- Testimonial carousel with client photos
- Stats/numbers that count up on scroll
- Footer with oversized "LET'S TALK" CTA

**Do NOT copy:**
- Buzzworthy's hexagon pattern motif (we need our own visual DNA)
- Their specific layout order — adapt to our content structure
- Their black & white only palette — we add Electric Pink + Neon Cyan

---

## COLOR SYSTEM

| Role | Color | Hex | Usage |
|------|-------|-----|-------|
| Primary | Electric Pink | #E503A2 | CTAs, highlights, accents, hover states |
| Secondary | Neon Cyan | #01FFFF | Links, hover glow, secondary accents |
| Neutral | Pure White | #FFFFFF | Body text, headings on dark BG |
| Base | Deep Black | #000000 | All backgrounds, depth |

**Ratio:** Black 60% / White 20% / Pink 15% / Cyan 5%
**Gradient:** Pink → Cyan for special hover/glow effects
**Never** use light/white backgrounds for main sections

---

## TYPOGRAPHY

| Level | Font | Size | Weight | Use |
|-------|------|------|--------|-----|
| H1 Hero | Anomalia (custom) | 64-120px | Bold | Hero headlines, page titles |
| H2 Section | Anomalia | 42-56px | Bold | Section headings |
| H3 Card | Inter/Heebo | 24-32px | Semibold | Card titles, sub-sections |
| Body | Inter (EN) / Heebo (HE) | 16-18px | Regular | Paragraphs, descriptions |
| Caption | Inter/Heebo | 12-14px | Regular | Labels, metadata |

**Hebrew:** RTL with Heebo font. All content is bilingual (Hebrew primary, English secondary).
**Style:** Oversized headlines are a design element, not just text. Headlines should take up significant viewport space.

---

## SITE STRUCTURE (Single Page + Sub-pages)

### Homepage Sections (in order):

**1. HERO**
- Full-viewport black background
- Animated headline with Anomalia font (letter-by-letter reveal)
- Subtitle text fades in after headline
- CTA button "בואו נדבר" with magnetic hover effect
- Custom cursor active
- Subtle floating vector illustrations as decorative elements

**2. HOW IT WORKS (איך זה עובד?)**
- 7-step process with bold step numbers (I through VII)
- Steps reveal on scroll, staggered animation
- Each step has a short description
- Horizontal scroll or vertical timeline layout
- Pink accent on step numbers, cyan on icons

**3. ABOUT US (מי אנחנו?)**
- Two founder cards side by side
- Photos with hover effect (scale + color overlay)
- Bio text reveals on hover or scroll
- Roei Yehezkel — marketing, branding, digital strategy
- Elad Nissim — UX/UI, animation, interface design
- Buzzworthy-style "attitude" section with numbered values

**4. SERVICES (השירותים שלנו)**
- 6 service cards in a grid:
  - אתר אינטרנט (Website)
  - אתר לעסק (Business Website)
  - אתר מכירות (E-commerce)
  - אתר תלת מימדי (3D Website)
  - דף נחיתה (Landing Page)
  - Website (Custom)
- Cards with hover animations: lift + shadow + pink/cyan border glow
- Each card expandable or links to detail

**5. PORTFOLIO (העבודות שלנו)**
- Horizontal scroll carousel (like Buzzworthy's projects section)
- Projects: Inner Cosmos, Aquatis, Titans, Third Eye, Dental Care, AMS Law
- Each project card: large image, project name, hover reveals brief description
- Drag-to-scroll with custom cursor showing arrows
- "View all work" link with arrow animation

**6. PRICING (מסלולי שירות)**
- 3 pricing tiers in cards:
  - חבילת בסיס — 80₪/חודש
  - חבילה מתקדמת — 150₪/חודש (מומלץ badge)
  - חבילת פרימיום — 300₪/חודש
- Recommended plan highlighted with pink border/glow
- Feature checkmarks with smooth reveal animation
- "בתשלום נוסף" section for add-ons below

**7. CONTACT (צור קשר)**
- Oversized "LET'S TALK" or "בואו נדבר" headline (Buzzworthy-style)
- Contact form with animated input labels (float up on focus)
- WhatsApp direct link button (prominent, pink)
- Social media icons with hover scale + color effects

**8. FOOTER**
- 3 columns: שירותים (Services) | משאבים (Resources) | החברה (Company)
- Social links: Instagram, Facebook, LinkedIn, WhatsApp
- Copyright + accessibility link
- Newsletter signup form
- Subtle pink accent line at top of footer

### Sub-pages:
- /blog — Blog listing with card grid
- /portfolio/[slug] — Case study detail pages
- /faq — Expandable FAQ accordion
- /about — Extended about page
- /contact — Full contact page
- /terms, /privacy, /accessibility — Legal pages

---

## ANIMATIONS & INTERACTIONS

### Page Load
- Black screen → logo reveals (SVG draw-in animation) → content fades in
- Duration: ~1.5s total

### Scroll Animations (GSAP + Framer Motion)
- Elements enter with fade-up + slight scale (from 0.95 to 1)
- Text lines reveal word-by-word on scroll into viewport
- Parallax layers: background elements move at 0.5x speed
- Section transitions: smooth opacity crossfade

### Hover Effects
- **Buttons:** Background fills from center outward, text color inverts (black ↔ white), pink → cyan gradient on hover
- **Cards:** translateY(-8px) + box-shadow expansion + border glow
- **Images:** scale(1.05) + color overlay shift
- **Links:** Underline draws from left to right

### Custom Cursor
- Default: small white circle (12px)
- On links/buttons: expands to 48px, mix-blend-mode: difference
- On images: becomes "View" text label
- On drag areas: directional arrows
- On CTA: pink pulsing ring

### Micro-interactions
- Form inputs: label floats up + color change on focus
- Loading: pulsing pink dot sequence
- Success states: Lottie checkmark animation
- Scroll indicator: bouncing arrow in hero section

### Marquee
- Infinite horizontal scroll text banner between sections
- Text in Anomalia font, large size, low opacity
- Scrolls opposite to reading direction for visual interest

---

## TECHNICAL REQUIREMENTS

### Stack
- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + custom CSS for animations
- **Animation:** GSAP, Framer Motion, Lottie
- **CMS:** Headless (for blog/portfolio content)

### Performance
- Lighthouse score target: 90+ on all metrics
- Animate only transform & opacity (GPU-accelerated)
- Lazy-load all below-fold animations
- Respect `prefers-reduced-motion` media query
- Image optimization: WebP/AVIF via Next.js Image

### SEO
- Dynamic meta tags per page (Next.js Metadata API)
- Schema.org: LocalBusiness + Organization + Service
- Open Graph tags with custom images
- Auto-generated sitemap + robots.txt
- Proper hreflang for Hebrew content
- Canonical URLs on every page

### Accessibility (Israeli Law IS 5568 / WCAG 2.1 AA)
- Accessibility widget (UserWay or equivalent)
- Semantic HTML + ARIA labels
- Keyboard navigation + skip-to-content
- Color contrast: 4.5:1 minimum
- Focus indicators on all interactive elements
- Alt text on all images
- /accessibility statement page

### Cookie Consent
- Banner on first visit with Accept/Decline
- Categories: Essential, Analytics, Marketing
- Google Analytics loads only after consent
- Lightweight custom implementation (no heavy third-party)

### Integrations
- WhatsApp floating button (bottom-right): `wa.me/972XXXXXXXXX`
- Social links: Instagram, Facebook, LinkedIn
- Contact form → email notification
- Google Analytics 4 (post-consent)

---

## VISUAL DNA — What Makes This Site "Fuzion Webz"

1. **Electric contrast** — Pink and cyan on black feels like neon signs at night
2. **Vector playfulness** — Custom 2D illustrations, not stock photos
3. **Typography as art** — Headlines are visual elements, not just words
4. **Alive interfaces** — Everything responds to the user's presence
5. **Dark confidence** — Black backgrounds signal premium and bold
6. **Israeli soul** — Hebrew-first RTL design with local character

---

## MOOD KEYWORDS

`neon` `electric` `bold` `playful` `kinetic` `dark` `vector` `flat` `young` `sharp` `premium` `alive` `responsive` `Hebrew` `RTL` `scroll-driven` `magnetic` `fluid`
