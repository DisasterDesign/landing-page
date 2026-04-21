import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PrintAgreementClient from "./PrintAgreementClient";

export const dynamic = "force-dynamic";

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
    },
  });

  if (!agreement) notFound();

  return (
    <PrintAgreementClient
      content={agreement.content}
      status={agreement.status}
      customerName={agreement.customerName}
      signedAt={agreement.signedAt ? agreement.signedAt.toISOString() : null}
    />
  );
}
