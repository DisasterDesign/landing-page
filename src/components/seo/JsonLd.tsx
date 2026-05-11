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
      "https://instagram.com/fuzion_webz",
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
