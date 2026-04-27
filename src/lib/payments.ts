import { prisma } from "@/lib/prisma";
import { createPaymentPage, getCardcomConfig, type CreatePaymentResult } from "@/lib/cardcom";
import { withVat } from "@/lib/vat";

/**
 * Builds a Cardcom checkout URL for a given Agreement and persists the
 * paymentUrl + paymentId on the row. Sets paymentStatus → SENT on success.
 *
 * Returns { url } on success, or null if Cardcom is not configured (caller
 * decides whether to surface this to the user or silently fall through).
 *
 * Throws on Cardcom API errors (caller logs + retries via UI).
 */

const TIER_LABEL: Record<string, string> = {
  BASIC: "בסיס",
  ADVANCED: "מתקדם",
  PREMIUM: "פרימיום",
};

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ||
    "https://www.fuzionwebz.com"
  );
}

function describeAgreement(a: {
  tier: string | null;
  customerName: string;
  businessName: string | null;
}): string {
  const subject = a.businessName?.trim() || a.customerName;
  if (a.tier && TIER_LABEL[a.tier]) {
    return `חבילת ${TIER_LABEL[a.tier]} — ${subject}`;
  }
  return `חבילה מותאמת — ${subject}`;
}

export async function ensurePaymentUrlForAgreement(agreementId: string): Promise<{ url: string } | null> {
  if (!getCardcomConfig()) return null;

  const agreement = await prisma.agreement.findUnique({
    where: { id: agreementId },
    select: {
      id: true,
      tier: true,
      monthlyPrice: true,
      oneTimeFee: true,
      customerName: true,
      businessName: true,
      email: true,
      phone: true,
      paymentStatus: true,
      paymentUrl: true,
    },
  });
  if (!agreement) return null;

  // Already paid → don't regenerate
  if (agreement.paymentStatus === "COMPLETED") return null;

  // First charge = setup fee + first month (if both exist), or whichever exists.
  // The figures stored on the agreement are NET (what the contract declares as
  // "X ₪ + מע״מ"); Cardcom is charged the GROSS amount.
  const setup = agreement.oneTimeFee ?? 0;
  const netAmount = setup + agreement.monthlyPrice;
  if (netAmount <= 0) return null;
  const grossAmount = withVat(netAmount);

  const base = siteUrl();
  const result: CreatePaymentResult = await createPaymentPage({
    agreementId: agreement.id,
    amount: grossAmount,
    productName: describeAgreement({
      tier: agreement.tier,
      customerName: agreement.customerName,
      businessName: agreement.businessName,
    }),
    saveToken: agreement.monthlyPrice > 0, // need a token only for recurring billing
    successUrl: `${base}/payment/success?agreement=${encodeURIComponent(agreement.id)}`,
    failedUrl: `${base}/payment/failed?agreement=${encodeURIComponent(agreement.id)}`,
    webhookUrl: `${base}/api/payments/webhook`,
    customer: {
      name: agreement.customerName,
      email: agreement.email,
      phone: agreement.phone,
    },
  });

  await prisma.agreement.update({
    where: { id: agreement.id },
    data: {
      paymentUrl: result.url,
      paymentId: result.lowProfileId,
      paymentStatus: "SENT",
    },
  });

  return { url: result.url };
}
