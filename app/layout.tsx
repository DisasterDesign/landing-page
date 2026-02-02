import type { Metadata } from "next";
import { Heebo, Qwigley } from "next/font/google";
import "./globals.css";

const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  variable: "--font-heebo",
});

const qwigley = Qwigley({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-qwigley",
});

const siteUrl = "https://fuzionwebz.com";

export const metadata: Metadata = {
  // Basic
  title: {
    default: "Fuzion Webz | פיוזאן וואב - בניית אתרים מתקדמים",
    template: "%s | Fuzion Webz",
  },
  description:
    "פיוזאן וואב - סטודיו לבניית אתרים מתקדמים ודפי נחיתה. עיצוב אתרים תלת מימדי, אתרי תדמית, אתרי מכירות ועוד. הפכו את החזון שלכם למציאות.",
  keywords: [
    "פיוזאן וואב",
    "fuzion webz",
    "בניית אתרים",
    "עיצוב אתרים",
    "דף נחיתה",
    "אתר תלת מימדי",
    "אתר לעסק",
    "web design israel",
  ],
  authors: [{ name: "Fuzion Webz" }],
  creator: "Fuzion Webz",

  // Canonical
  metadataBase: new URL(siteUrl),
  alternates: {
    canonical: "/",
  },

  // Open Graph (Facebook, WhatsApp, LinkedIn)
  openGraph: {
    type: "website",
    locale: "he_IL",
    url: siteUrl,
    siteName: "Fuzion Webz",
    title: "Fuzion Webz | פיוזאן וואב - בניית אתרים מתקדמים",
    description:
      "סטודיו לבניית אתרים מתקדמים ודפי נחיתה. עיצוב אתרים תלת מימדי, אתרי תדמית, אתרי מכירות ועוד.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Fuzion Webz - בניית אתרים מתקדמים",
      },
    ],
  },

  // Twitter Card
  twitter: {
    card: "summary_large_image",
    title: "Fuzion Webz | פיוזאן וואב",
    description: "סטודיו לבניית אתרים מתקדמים ודפי נחיתה",
    images: ["/og-image.png"],
  },

  // Icons
  icons: {
    icon: "/fabicon.svg",
    apple: "/apple-touch-icon.png",
  },

  // Robots
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

// JSON-LD structured data
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Fuzion Webz",
  alternateName: "פיוזאן וואב",
  url: siteUrl,
  logo: `${siteUrl}/logo.svg`,
  sameAs: [
    "https://instagram.com/fuzionwebz",
    "https://linkedin.com/company/fuzionwebz",
  ],
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer service",
    availableLanguage: ["Hebrew", "English"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${heebo.variable} ${qwigley.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
