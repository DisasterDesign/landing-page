import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import DocumentLocale from "@/components/util/DocumentLocale";
import SignAgreementClient from "./SignAgreementClient";

export const dynamic = "force-dynamic";

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

// Cached so generateMetadata + the page render share a single query
// per request instead of hitting the DB twice.
const getAgreement = cache(async (token: string) => {
  return prisma.agreement.findUnique({
    where: { signToken: token },
    select: {
      tier: true,
      monthlyPrice: true,
      oneTimeFee: true,
      customerName: true,
      businessName: true,
      idNumber: true,
      phone: true,
      email: true,
      status: true,
      content: true,
      signedAt: true,
      locale: true,
      vatExempt: true,
    },
  });
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const agreement = await getAgreement(token);

  // Contract links are private — never index them.
  if (!agreement) {
    // No row means no locale to read, and a foreign client is the likeliest
    // visitor on a broken link — English first, matching agreement/not-found.
    return { title: "Agreement link not valid", robots: { index: false, follow: false } };
  }

  const who = agreement.businessName || agreement.customerName;
  const signed = agreement.status === "SIGNED";
  const en = agreement.locale === "en";
  // Root layout's title template appends " | Fuzion Webz" — keep the
  // brand out of `title` to avoid doubling it.
  const title = en
    ? signed
      ? "Signed Agreement"
      : "Service Agreement to Sign"
    : signed
      ? "הסכם חתום"
      : "הסכם שירות לחתימה";
  const description = en
    ? signed
      ? `${who}'s agreement with Fuzion Webz has been signed.`
      : `${who}, your agreement with Fuzion Webz is ready to review and sign digitally.`
    : signed
      ? `ההסכם של ${who} עם Fuzion Webz נחתם.`
      : `${who}, ההסכם שלך עם Fuzion Webz מוכן לעיון ולחתימה דיגיטלית.`;

  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title: `${title} — Fuzion Webz`,
      description,
      type: "website",
      // opengraph-image.tsx in this segment is wired in automatically.
    },
  };
}

function BrandShell({ children, dir = "rtl" }: { children: React.ReactNode; dir?: "rtl" | "ltr" }) {
  return (
    <div dir={dir} className="min-h-screen bg-black text-white">
      {/* The root <html> is hard-coded he/rtl — realign it for English signers. */}
      <DocumentLocale lang={dir === "ltr" ? "en" : "he"} dir={dir} />
      <div
        className="pointer-events-none fixed inset-0 opacity-30"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

export default async function AgreementSignPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const agreement = await getAgreement(token);

  if (!agreement) notFound();

  const en = agreement.locale === "en";
  const dir = en ? "ltr" : "rtl";

  if (agreement.status === "CANCELLED") {
    return (
      <BrandShell dir={dir}>
        <div className="min-h-screen flex items-center justify-center px-6">
          <div className="max-w-md text-center bg-white/5 border border-white/10 backdrop-blur-sm rounded-2xl p-10">
            <h1 className="text-3xl font-extrabold tracking-tight mb-3">
              {en ? "Agreement Cancelled" : "ההסכם בוטל"}
            </h1>
            <p className="text-gray-400">
              {en
                ? "This agreement can no longer be signed. Please contact Fuzion Webz."
                : "לא ניתן לחתום על הסכם זה. אנא צור קשר עם Fuzion Webz."}
            </p>
            <Link href="https://www.fuzionwebz.com" className="inline-block mt-6 text-sm text-cyan hover:underline">
              fuzionwebz.com →
            </Link>
          </div>
        </div>
      </BrandShell>
    );
  }

  if (agreement.status === "SIGNED") {
    return (
      <BrandShell dir={dir}>
        <div className="min-h-screen flex items-center justify-center px-6">
          <div className="max-w-md text-center bg-white/5 border border-white/10 backdrop-blur-sm rounded-2xl p-10">
            <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-gradient-to-br from-pink to-cyan flex items-center justify-center text-3xl">
              ✓
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight mb-3">
              {en ? "Agreement Signed" : "ההסכם נחתם"}
            </h1>
            <p className="text-gray-400 mb-6">
              {en
                ? `Signed on ${
                    agreement.signedAt
                      ? new Date(agreement.signedAt).toLocaleDateString("en-GB")
                      : ""
                  }. Thank you!`
                : `ההסכם נחתם בתאריך ${
                    agreement.signedAt
                      ? new Date(agreement.signedAt).toLocaleDateString("he-IL")
                      : ""
                  }. תודה!`}
            </p>
            <a
              href={`/agreement/${token}/pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-pink to-cyan text-black font-bold px-6 py-3 rounded-full hover:shadow-[0_0_30px_rgba(229,3,162,0.4)] transition-shadow"
            >
              {en ? "Download signed agreement (PDF)" : "הורדת ההסכם החתום (PDF)"}
              <span>↓</span>
            </a>
          </div>
        </div>
      </BrandShell>
    );
  }

  return (
    <BrandShell dir={dir}>
      <SignAgreementClient
        token={token}
        content={agreement.content}
        locale={en ? "en" : "he"}
        vatExempt={agreement.vatExempt}
        priceInfo={{
          tier: agreement.tier,
          tierLabel: agreement.tier
            ? en
              ? TIER_LABEL_EN[agreement.tier]
              : TIER_LABEL[agreement.tier]
            : null,
          monthlyPrice: agreement.monthlyPrice,
          oneTimeFee: agreement.oneTimeFee,
        }}
        initial={{
          customerName: agreement.customerName,
          businessName: agreement.businessName,
          idNumber: agreement.idNumber,
          phone: agreement.phone,
          email: agreement.email,
        }}
      />
    </BrandShell>
  );
}
