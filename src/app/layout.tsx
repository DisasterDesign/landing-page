import type { Metadata, Viewport } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import ServiceWorkerRegister from "@/components/pwa/ServiceWorkerRegister";
import "./globals.css";

export const metadata: Metadata = {
  icons: {
    icon: "/fabicon.png",
    apple: "/icons/icon-192x192.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FW Admin",
  },
  title: {
    default: "Fuzion Webz | סטודיו לעיצוב ובניית אתרים",
    template: "%s | Fuzion Webz",
  },
  description: "סטודיו בוטיק לעיצוב ובניית אתרים מתקדמים. אנחנו יוצרים חוויות דיגיטליות שממירות מבקרים ללקוחות.",
  metadataBase: new URL("https://www.fuzionwebz.com"),
  openGraph: {
    type: "website",
    locale: "he_IL",
    siteName: "Fuzion Webz",
    title: "Fuzion Webz | סטודיו לעיצוב ובניית אתרים",
    description: "סטודיו בוטיק לעיצוב ובניית אתרים מתקדמים",
  },
  twitter: {
    card: "summary_large_image",
  },
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "https://www.fuzionwebz.com",
    languages: {
      "he-IL": "https://www.fuzionwebz.com",
    },
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className="h-full antialiased">
      <head />
      <body className="min-h-full flex flex-col">
        {children}
        <SpeedInsights />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
