import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { SITE_NAME } from "@/lib/constants";
import FontDetailClient from "./FontDetailClient";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const font = await prisma.fontFamily.findUnique({
    where: { slug, published: true },
    include: { styles: { orderBy: { weight: "asc" } } },
  });

  if (!font) {
    return { title: `פונט לא נמצא | ${SITE_NAME}` };
  }

  const minPrice =
    font.styles.length > 0
      ? Math.min(...font.styles.map((s) => s.pricePersonal))
      : 0;

  return {
    title: `${font.name} | חנות פונטים | ${SITE_NAME}`,
    description:
      font.description ||
      `${font.name} — פונט ${font.category || ""} באיכות גבוהה לשימוש אישי ומסחרי.`,
    openGraph: {
      title: `${font.name} | ${SITE_NAME}`,
      description:
        font.description || `פונט ${font.name} לשימוש אישי ומסחרי.`,
    },
    other: {
      "product:price:amount": String(minPrice),
      "product:price:currency": "ILS",
    },
  };
}

export default async function FontDetailPage({ params }: Props) {
  const { slug } = await params;
  const font = await prisma.fontFamily.findUnique({
    where: { slug, published: true },
    include: { styles: { orderBy: { weight: "asc" } } },
  });

  if (!font) {
    notFound();
  }

  // Schema.org Product JSON-LD
  const minPrice =
    font.styles.length > 0
      ? Math.min(...font.styles.map((s) => s.pricePersonal))
      : 0;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: font.name,
    description: font.description || `פונט ${font.name}`,
    brand: { "@type": "Brand", name: SITE_NAME },
    offers: {
      "@type": "AggregateOffer",
      lowPrice: minPrice,
      priceCurrency: "ILS",
      availability: "https://schema.org/InStock",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <FontDetailClient font={JSON.parse(JSON.stringify(font))} />
    </>
  );
}
