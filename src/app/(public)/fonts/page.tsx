import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/constants";
import FontStoreClient from "./FontStoreClient";

export const metadata: Metadata = {
  title: `חנות פונטים | ${SITE_NAME}`,
  description:
    "חנות פונטים מקורית של Fuzion Webz — פונטים עבריים ואנגליים באיכות גבוהה לשימוש אישי ומסחרי.",
  openGraph: {
    title: `חנות פונטים | ${SITE_NAME}`,
    description:
      "פונטים מקוריים באיכות גבוהה לשימוש אישי ומסחרי.",
  },
};

export default function FontStorePage() {
  return <FontStoreClient />;
}
