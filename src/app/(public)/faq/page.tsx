import type { Metadata } from "next";
import { SITE_URL } from "@/lib/constants";
import { FAQJsonLd, BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import FAQClient from "./FAQClient";

export const metadata: Metadata = {
  title: "שאלות נפוצות — בניית אתרים",
  description:
    "תשובות לשאלות נפוצות על בניית אתרים — מחיר, זמן, תחזוקה, SEO ועוד. כל מה שצריך לדעת לפני שמתחילים פרויקט עם Fuzion Webz.",
  alternates: {
    canonical: `${SITE_URL}/faq`,
  },
};

export default function FAQPage() {
  return (
    <>
      <FAQJsonLd />
      <BreadcrumbJsonLd
        items={[
          { name: "דף הבית", url: SITE_URL },
          { name: "שאלות נפוצות", url: `${SITE_URL}/faq` },
        ]}
      />
      <FAQClient />
    </>
  );
}
