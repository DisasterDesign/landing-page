import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import DocumentLocale from "@/components/util/DocumentLocale";
import PrintAgreementClient from "./PrintAgreementClient";

export const dynamic = "force-dynamic";

/**
 * The document title is what the browser prints in the page header and offers
 * as the saved-PDF filename — so it must follow the agreement's language, not
 * the root layout's Hebrew default.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const agreement = await prisma.agreement.findUnique({
    where: { signToken: token },
    select: { customerName: true, businessName: true, locale: true },
  });
  const robots = { index: false, follow: false };
  if (!agreement) return { title: "Agreement / הסכם", robots };

  const who = agreement.businessName || agreement.customerName;
  return {
    title:
      agreement.locale === "en"
        ? `Service Agreement — ${who}`
        : `הסכם שירות — ${who}`,
    robots,
  };
}

export default async function AgreementPdfPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const agreement = await prisma.agreement.findUnique({
    where: { signToken: token },
    select: {
      content: true,
      status: true,
      customerName: true,
      signedAt: true,
      locale: true,
    },
  });

  if (!agreement) notFound();

  const en = agreement.locale === "en";

  return (
    <>
      <DocumentLocale lang={en ? "en" : "he"} dir={en ? "ltr" : "rtl"} />
      <PrintAgreementClient
        content={agreement.content}
        status={agreement.status}
        customerName={agreement.customerName}
        signedAt={agreement.signedAt ? agreement.signedAt.toISOString() : null}
        locale={en ? "en" : "he"}
      />
    </>
  );
}
