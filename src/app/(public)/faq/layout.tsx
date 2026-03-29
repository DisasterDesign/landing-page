import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/constants";

export const metadata: Metadata = {
  title: "שאלות נפוצות",
  description:
    "תשובות לשאלות הנפוצות ביותר על בניית אתרים, עיצוב, תחזוקה ועוד. Fuzion Webz – כל מה שרציתם לדעת.",
  openGraph: {
    title: `שאלות נפוצות | ${SITE_NAME}`,
    description: "תשובות לשאלות הנפוצות ביותר על בניית אתרים ועיצוב.",
  },
};

export default function FAQLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
