import { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import BlogPageClient from "./BlogPageClient";

export const metadata: Metadata = {
  title: `בלוג | ${SITE_NAME}`,
  description:
    "הבלוג של Fuzion Webz – טיפים, מדריכים ותובנות בנושאי עיצוב אתרים, פיתוח ושיווק דיגיטלי.",
  openGraph: {
    title: `בלוג | ${SITE_NAME}`,
    description: "טיפים, מדריכים ותובנות בנושאי עיצוב אתרים ושיווק דיגיטלי.",
    url: `${SITE_URL}/blog`,
  },
};

export default function BlogPage() {
  return <BlogPageClient />;
}
