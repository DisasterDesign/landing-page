import type { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import FontStoreClient from "./FontStoreClient";

export const metadata: Metadata = {
  title: "חנות פונטים — פונטים מקוריים בעברית",
  description:
    "חנות פונטים מקורית של Fuzion Webz — פונט עברי, טיפוגרפיה מקצועית והורדת פונטים באיכות גבוהה לשימוש אישי ומסחרי.",
  alternates: {
    canonical: `${SITE_URL}/fonts`,
  },
  openGraph: {
    title: `חנות פונטים | ${SITE_NAME}`,
    description:
      "פונטים מקוריים באיכות גבוהה לשימוש אישי ומסחרי.",
  },
};

export default function FontStorePage() {
  return (
    <>
      <BreadcrumbJsonLd items={[
        { name: "דף הבית", url: SITE_URL },
        { name: "פונטים", url: `${SITE_URL}/fonts` },
      ]} />
      <FontStoreClient />
    </>
  );
}
