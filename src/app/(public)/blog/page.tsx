import { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import BlogPageClient from "./BlogPageClient";

export const metadata: Metadata = {
  title: "בלוג — טיפים ומדריכים לעיצוב אתרים",
  description:
    "הבלוג של Fuzion Webz — טיפים, מדריכים ותובנות בנושאי עיצוב אתרים, פיתוח, טרנדים וטיפים לשיווק דיגיטלי.",
  alternates: {
    canonical: `${SITE_URL}/blog`,
  },
  openGraph: {
    title: `בלוג | ${SITE_NAME}`,
    description: "טיפים, מדריכים ותובנות בנושאי עיצוב אתרים ושיווק דיגיטלי.",
    url: `${SITE_URL}/blog`,
  },
};

export default function BlogPage() {
  return (
    <>
      <BreadcrumbJsonLd items={[
        { name: "דף הבית", url: SITE_URL },
        { name: "בלוג", url: `${SITE_URL}/blog` },
      ]} />
      <BlogPageClient />
    </>
  );
}
