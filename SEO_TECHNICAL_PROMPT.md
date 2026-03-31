# SEO Technical Foundation — Claude Code Prompt

## Context
You are working on the Fuzion Webz website — a Next.js (App Router) web design studio site at `fuzionwebz.com`.
The site is deployed on Vercel. It has ZERO Google indexing right now. No sitemap, no robots.txt, no structured data.
This prompt implements the complete SEO technical foundation.

## Critical Info
- **Domain:** `https://www.fuzionwebz.com` (www version is the live one)
- **metadataBase in layout.tsx** currently points to `https://fuzionwebz.com` (without www) — needs fixing
- **Canonical URL** also points to non-www — needs fixing
- **Constants file:** `src/lib/constants.ts` — SITE_URL is `https://fuzionwebz.com` — needs fixing to `https://www.fuzionwebz.com`
- **Language:** Hebrew (he), RTL
- **Services:** website, business, ecommerce, 3d-website, landing, custom
- **Dynamic routes:** /blog/[slug], /portfolio/[slug], /fonts/[slug], /fonts/download/[token]
- **Static pages:** /, /about, /contact, /faq, /portfolio, /blog, /fonts, /privacy, /terms, /accessibility

## Tasks — Execute in this order:

### 1. Fix Domain Consistency (www)

In `src/lib/constants.ts`, change:
```ts
export const SITE_URL = "https://www.fuzionwebz.com";
```

In `src/app/layout.tsx`, change metadataBase and all URLs from `https://fuzionwebz.com` to `https://www.fuzionwebz.com`:
```ts
metadataBase: new URL("https://www.fuzionwebz.com"),
// ...
alternates: {
  canonical: "https://www.fuzionwebz.com",
  languages: {
    "he-IL": "https://www.fuzionwebz.com",
  },
},
```

### 2. Create `src/app/robots.ts`

```ts
import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api/", "/fonts/download/"],
      },
    ],
    sitemap: "https://www.fuzionwebz.com/sitemap.xml",
  };
}
```

### 3. Create `src/app/sitemap.ts`

```ts
import { MetadataRoute } from "next";

const SITE_URL = "https://www.fuzionwebz.com";

// Static pages with their priorities and change frequencies
const staticPages = [
  { path: "", priority: 1.0, changeFrequency: "weekly" as const },
  { path: "/about", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/contact", priority: 0.8, changeFrequency: "monthly" as const },
  { path: "/faq", priority: 0.6, changeFrequency: "monthly" as const },
  { path: "/portfolio", priority: 0.8, changeFrequency: "weekly" as const },
  { path: "/blog", priority: 0.9, changeFrequency: "daily" as const },
  { path: "/fonts", priority: 0.8, changeFrequency: "weekly" as const },
  { path: "/privacy", priority: 0.2, changeFrequency: "yearly" as const },
  { path: "/terms", priority: 0.2, changeFrequency: "yearly" as const },
  { path: "/accessibility", priority: 0.2, changeFrequency: "yearly" as const },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date().toISOString();

  // Static pages
  const staticEntries = staticPages.map(({ path, priority, changeFrequency }) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency,
    priority,
  }));

  // TODO: When blog/portfolio/fonts have DB entries, fetch slugs here:
  // const blogPosts = await prisma.post.findMany({ where: { published: true }, select: { slug: true, updatedAt: true } });
  // const blogEntries = blogPosts.map(post => ({
  //   url: `${SITE_URL}/blog/${post.slug}`,
  //   lastModified: post.updatedAt.toISOString(),
  //   changeFrequency: "weekly" as const,
  //   priority: 0.7,
  // }));

  return [...staticEntries];
}
```

### 4. Create JSON-LD Structured Data Component

Create `src/components/seo/JsonLd.tsx`:

```tsx
import { SITE_URL, SITE_NAME, FAQ_ITEMS, SERVICES } from "@/lib/constants";

// Organization schema — for the root layout or homepage
export function OrganizationJsonLd() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/logo.svg`,
    description: "סטודיו בוטיק לעיצוב ובניית אתרים מתקדמים",
    address: {
      "@type": "PostalAddress",
      addressCountry: "IL",
    },
    sameAs: [
      "https://instagram.com/fuzionwebz",
      "https://facebook.com/fuzionwebz",
      "https://linkedin.com/company/fuzionwebz",
      "https://tiktok.com/@fuzionwebz",
    ],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      availableLanguage: ["Hebrew", "English"],
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// LocalBusiness schema — for homepage
export function LocalBusinessJsonLd() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/logo.svg`,
    image: `${SITE_URL}/og-image.jpg`,
    description: "סטודיו בוטיק לעיצוב ובניית אתרים מתקדמים. עיצוב UX/UI, פיתוח אתרים, מיתוג דיגיטלי.",
    address: {
      "@type": "PostalAddress",
      addressCountry: "IL",
    },
    priceRange: "₪₪",
    areaServed: {
      "@type": "Country",
      name: "Israel",
    },
    knowsLanguage: ["he", "en"],
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "שירותי עיצוב ובניית אתרים",
      itemListElement: SERVICES.map((service, i) => ({
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: service.title,
          description: service.description,
        },
        position: i + 1,
      })),
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// FAQ schema — for FAQ page AND service pages
export function FAQJsonLd({ items }: { items?: { question: string; answer: string }[] }) {
  const faqItems = items || FAQ_ITEMS;
  const schema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqItems.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// BreadcrumbList schema — for all inner pages
export function BreadcrumbJsonLd({ items }: { items: { name: string; url: string }[] }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// BlogPosting schema — for individual blog posts
export function BlogPostJsonLd({
  title,
  description,
  url,
  datePublished,
  dateModified,
  image,
  authorName,
}: {
  title: string;
  description: string;
  url: string;
  datePublished: string;
  dateModified?: string;
  image?: string;
  authorName?: string;
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: title,
    description,
    url,
    datePublished,
    dateModified: dateModified || datePublished,
    image: image || `${SITE_URL}/og-image.jpg`,
    author: {
      "@type": "Organization",
      name: authorName || SITE_NAME,
      url: SITE_URL,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/logo.svg`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
    inLanguage: "he-IL",
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// Product schema — for individual font pages
export function FontProductJsonLd({
  name,
  description,
  url,
  image,
  price,
  currency = "ILS",
}: {
  name: string;
  description: string;
  url: string;
  image?: string;
  price?: number;
  currency?: string;
}) {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    description,
    url,
    image: image || `${SITE_URL}/og-image.jpg`,
    brand: {
      "@type": "Organization",
      name: SITE_NAME,
    },
    category: "Fonts",
    inLanguage: "he-IL",
  };

  if (price !== undefined) {
    schema.offers = {
      "@type": "Offer",
      price: price.toString(),
      priceCurrency: currency,
      availability: "https://schema.org/InStock",
      url,
    };
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}

// WebSite schema with SearchAction — for root
export function WebSiteJsonLd() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    inLanguage: "he-IL",
    description: "סטודיו בוטיק לעיצוב ובניית אתרים מתקדמים",
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
```

### 5. Inject JSON-LD into Pages

**In `src/app/(public)/layout.tsx`** — add Organization + WebSite schemas inside the layout (before or after `<Loader />`):

```tsx
import { OrganizationJsonLd, WebSiteJsonLd } from "@/components/seo/JsonLd";

// Inside the return, add:
<OrganizationJsonLd />
<WebSiteJsonLd />
```

**In `src/app/(public)/page.tsx`** (homepage) — add LocalBusiness + FAQ:

```tsx
import { LocalBusinessJsonLd, FAQJsonLd } from "@/components/seo/JsonLd";

// At the top of the JSX (before or after <Hero />):
<LocalBusinessJsonLd />
<FAQJsonLd />
```

**In `src/app/(public)/faq/page.tsx`** — add FAQ schema:

```tsx
import { FAQJsonLd, BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import { SITE_URL } from "@/lib/constants";

// Add at top of JSX:
<FAQJsonLd />
<BreadcrumbJsonLd items={[
  { name: "דף הבית", url: SITE_URL },
  { name: "שאלות נפוצות", url: `${SITE_URL}/faq` },
]} />
```

**Do the same BreadcrumbJsonLd for all inner pages:**
- /about → breadcrumb: Home > אודות
- /contact → breadcrumb: Home > צור קשר
- /portfolio → breadcrumb: Home > תיק עבודות
- /blog → breadcrumb: Home > בלוג
- /fonts → breadcrumb: Home > פונטים
- /privacy → breadcrumb: Home > מדיניות פרטיות
- /terms → breadcrumb: Home > תנאי שימוש
- /accessibility → breadcrumb: Home > נגישות

### 6. Create OG Image

Create `src/app/opengraph-image.tsx` (Next.js auto OG image generation):

```tsx
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Fuzion Webz — סטודיו לעיצוב ובניית אתרים";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#000000",
          color: "#ffffff",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "24px",
          }}
        >
          <div
            style={{
              fontSize: "72px",
              fontWeight: "bold",
              letterSpacing: "-2px",
            }}
          >
            FUZION WEBZ
          </div>
        </div>
        <div
          style={{
            fontSize: "28px",
            color: "#E503A2",
            direction: "rtl",
          }}
        >
          סטודיו לעיצוב ובניית אתרים מתקדמים
        </div>
        <div
          style={{
            fontSize: "20px",
            color: "#01FFFF",
            marginTop: "12px",
            direction: "rtl",
          }}
        >
          עיצוב • פיתוח • חדשנות
        </div>
      </div>
    ),
    { ...size }
  );
}
```

### 7. Add `generateMetadata` to Key Pages

For each page that doesn't have its own metadata export, add one. Example for `/about`:

In `src/app/(public)/about/page.tsx`, add:

```tsx
import type { Metadata } from "next";
import { SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "אודות — הצוות מאחורי Fuzion Webz",
  description: "הכירו את הצוות של Fuzion Webz — סטודיו בוטיק לעיצוב ובניית אתרים מתקדמים עם מעל עשור ניסיון בעולם הדיגיטל.",
  alternates: {
    canonical: `${SITE_URL}/about`,
  },
};
```

**Do this for every static page under (public)/**, with unique Hebrew title and description that include target keywords:

| Page | Title | Description Keywords |
|------|-------|---------------------|
| /about | אודות — הצוות מאחורי Fuzion Webz | צוות, ניסיון, עיצוב, פיתוח |
| /contact | צור קשר — Fuzion Webz | יצירת קשר, הצעת מחיר, ייעוץ |
| /faq | שאלות נפוצות — בניית אתרים | מחיר, זמן, תחזוקה, SEO |
| /portfolio | תיק עבודות — פרויקטים נבחרים | עבודות, פרויקטים, עיצוב אתרים |
| /blog | בלוג — טיפים ומדריכים לעיצוב אתרים | עיצוב, פיתוח, טרנדים, טיפים |
| /fonts | חנות פונטים — פונטים מקוריים בעברית | פונט עברי, טיפוגרפיה, הורדה |
| /privacy | מדיניות פרטיות | פרטיות, GDPR, מידע |
| /terms | תנאי שימוש | תנאים, שימוש, אחריות |
| /accessibility | הצהרת נגישות | נגישות, IS 5568, WCAG |

Each page must also include:
```tsx
alternates: { canonical: `${SITE_URL}/<path>` }
```

### 8. Add Security + Performance Headers to next.config.ts

Keep existing headers and add:
```ts
{
  key: "X-Robots-Tag",
  value: "index, follow",
},
```

### 9. Fix Missing Image Alt Text

Go through all `<Image>` and `<img>` tags in all section components and ensure every single one has a descriptive Hebrew `alt` attribute. For example:
- Portfolio project images: use the project title as alt
- Team member photos: use `צילום של [name]`
- Logo: `לוגו Fuzion Webz`
- Decorative images: use `alt=""` (empty string, NOT missing)

### 10. Verification

After all changes, run `npm run build` and verify:
- `/robots.txt` returns proper text (not 404)
- `/sitemap.xml` returns valid XML with all pages
- Homepage HTML source contains `<script type="application/ld+json">` with Organization, WebSite, LocalBusiness, and FAQ schemas
- All pages have unique `<title>` and `<meta name="description">`
- Canonical URLs all point to `https://www.fuzionwebz.com/...`
- No TypeScript errors
- No build errors

## Important Notes
- Do NOT remove or change any existing visual/UI code
- Do NOT change the design, layout, animations, or styles
- This is purely an SEO infrastructure task
- Test with `npm run build` after completing all changes
- If a page already has metadata, MERGE with the existing one, don't replace
