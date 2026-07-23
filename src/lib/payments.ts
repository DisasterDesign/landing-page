import { prisma } from "@/lib/prisma";
import { createPaymentPage, getCardcomConfig, type CreatePaymentResult } from "@/lib/cardcom";
import { recordAgreementPaymentPage } from "@/lib/leads/agreement-lifecycle";
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
  LANDING: "דף נחיתה",
  BASIC: "בסיס",
  ADVANCED: "מתקדם",
  PREMIUM: "פרימיום",
};

const TIER_LABEL_EN: Record<string, string> = {
  LANDING: "Landing Page",
  BASIC: "Basic",
  ADVANCED: "Advanced",
  PREMIUM: "Premium",
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
  locale: string;
}): string {
  const subject = a.businessName?.trim() || a.customerName;
  if (a.locale === "en") {
    if (a.tier && TIER_LABEL_EN[a.tier]) {
      return `${TIER_LABEL_EN[a.tier]} package — ${subject}`;
    }
    return `Custom package — ${subject}`;
  }
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
      locale: true,
      vatExempt: true,
    },
  });
  if (!agreement) return null;

  // Already paid → don't regenerate
  if (agreement.paymentStatus === "COMPLETED") return null;

  // First charge = setup fee + first month (if both exist), or whichever exists.
  // The figures stored on the agreement are NET (what the contract declares).
  // Israeli clients are charged GROSS (net + VAT); VAT-exempt foreign clients
  // are charged the NET amount with a zero-rate invoice.
  const setup = agreement.oneTimeFee ?? 0;
  const netAmount = setup + agreement.monthlyPrice;
  if (netAmount <= 0) return null;
  const amount = agreement.vatExempt ? netAmount : withVat(netAmount);
  const language = agreement.locale === "en" ? "en" : "he";

  const base = siteUrl();
  const result: CreatePaymentResult = await createPaymentPage({
    agreementId: agreement.id,
    amount,
    productName: describeAgreement({
      tier: agreement.tier,
      customerName: agreement.customerName,
      businessName: agreement.businessName,
      locale: agreement.locale,
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
    language,
    vatFree: agreement.vatExempt,
  });

  await recordAgreementPaymentPage({
    agreementId: agreement.id,
    paymentUrl: result.url,
    providerPaymentId: result.lowProfileId,
  });

  return { url: result.url };
}
