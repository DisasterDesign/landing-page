import type { Metadata } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

export const metadata: Metadata = {
  icons: {
    icon: "/fabicon.png",
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
      </body>
    </html>
  );
}
