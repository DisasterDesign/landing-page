import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import DocumentLocale from "@/components/util/DocumentLocale";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ agreement?: string }>;
}

/** Follows the agreement's language — Cardcom lands foreign clients here too. */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { agreement: agreementId } = await searchParams;
  const a = agreementId
    ? await prisma.agreement.findUnique({
        where: { id: agreementId },
        select: { locale: true },
      })
    : null;
  return {
    title: a?.locale === "en" ? "Payment not completed" : "התשלום לא הושלם",
    robots: { index: false, follow: false },
  };
}

function BrandShell({ children, dir = "rtl" }: { children: React.ReactNode; dir?: "rtl" | "ltr" }) {
  return (
    <div dir={dir} className="min-h-screen bg-black text-white">
      {/* The root <html> is hard-coded he/rtl — realign it for English payers. */}
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

export default async function PaymentFailedPage({ searchParams }: Props) {
  const { agreement: agreementId } = await searchParams;

  let retryUrl: string | null = null;
  let en = false;
  if (agreementId) {
    const a = await prisma.agreement.findUnique({
      where: { id: agreementId },
      select: { paymentUrl: true, signToken: true, paymentStatus: true, locale: true },
    });
    if (a?.paymentUrl && a.paymentStatus !== "COMPLETED") retryUrl = a.paymentUrl;
    en = a?.locale === "en";
  }

  return (
    <BrandShell dir={en ? "ltr" : "rtl"}>
      <header className="px-6 pt-10 pb-6 text-center">
        <h1 dir="ltr" className="text-3xl md:text-5xl font-extrabold tracking-[-0.04em]">
          FUZION <span className="text-gray-500">WEBZ</span>
        </h1>
        <div className="w-24 h-[2px] mx-auto mt-4 bg-gradient-to-r from-pink to-cyan" />
      </header>

      <main className="max-w-md mx-auto px-4 pb-16">
        <div className="bg-white/5 border border-white/10 backdrop-blur-sm rounded-2xl p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center text-3xl text-red-400">
            ✕
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight mb-2">
            {en ? "Payment not completed" : "התשלום לא הושלם"}
          </h2>
          <p className="text-sm text-gray-300 mb-6">
            {en
              ? "The payment did not go through. Your card was not charged. You can try again, or contact us if the problem persists."
              : "התשלום לא עבר. הכרטיס לא חויב. אפשר לנסות שוב, או ליצור איתנו קשר אם הבעיה חוזרת."}
          </p>

          <div className="flex flex-col gap-2">
            {retryUrl && (
              <a
                href={retryUrl}
                className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-pink to-cyan text-black font-bold px-6 py-3 rounded-full hover:shadow-[0_0_30px_rgba(229,3,162,0.4)] transition-shadow"
              >
                {en ? "Try again" : "נסה שוב"}
              </a>
            )}
            <Link
              href="https://www.fuzionwebz.com/contact"
              className="text-sm text-cyan hover:underline mt-2"
            >
              {en ? "Contact us" : "צור קשר"}
            </Link>
          </div>
        </div>

        <footer className="text-center text-xs text-gray-600 pt-8">
          <Link href="https://www.fuzionwebz.com" className="hover:text-cyan">
            fuzionwebz.com
          </Link>
        </footer>
      </main>
    </BrandShell>
  );
}
