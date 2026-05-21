import { prisma } from "@/lib/prisma";
import {
  renderAgreementOgImage,
  renderOgImage,
  OG_IMAGE_SIZE,
  OG_IMAGE_CONTENT_TYPE,
} from "@/lib/og-image";

export const alt = "הסכם שירות — Fuzion Webz";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_IMAGE_CONTENT_TYPE;

interface Props {
  params: Promise<{ token: string }>;
}

export default async function Image({ params }: Props) {
  const { token } = await params;

  const agreement = await prisma.agreement.findUnique({
    where: { signToken: token },
    select: { customerName: true, businessName: true, status: true },
  });

  // Unknown / bad token — fall back to the generic brand card.
  if (!agreement) return renderOgImage();

  return renderAgreementOgImage(
    agreement.businessName || agreement.customerName,
    agreement.status === "SIGNED"
  );
}
