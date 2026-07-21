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
    title: a?.locale === "en" ? "Payment received" : "התשלום התקבל",
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

const fmt = (n: number | null, locale: string) =>
  n != null
    ? n.toLocaleString(locale === "en" ? "en-US" : "he-IL", { maximumFractionDigits: 0 })
    : "—";

export default async function PaymentSuccessPage({ searchParams }: Props) {
  const { agreement: agreementId } = await searchParams;

  let summary: {
    customerName: string;
    paidAmount: number | null;
    paidAt: Date | null;
    invoiceNumber: string | null;
    locale: string;
  } | null = null;

  if (agreementId) {
    const a = await prisma.agreement.findUnique({
      where: { id: agreementId },
      select: { customerName: true, paidAmount: true, paidAt: true, invoiceNumber: true, locale: true },
    });
    if (a) summary = a;
  }

  const en = summary?.locale === "en";
  const dir = en ? "ltr" : "rtl";
  const dateLocale = en ? "en-GB" : "he-IL";
  const colAlign = en ? "text-left" : "text-right";

  return (
    <BrandShell dir={dir}>
      <header className="px-6 pt-10 pb-6 text-center">
        <h1 dir="ltr" className="text-3xl md:text-5xl font-extrabold tracking-[-0.04em]">
          FUZION <span className="text-gray-500">WEBZ</span>
        </h1>
        <div className="w-24 h-[2px] mx-auto mt-4 bg-gradient-to-r from-pink to-cyan" />
      </header>

      <main className="max-w-md mx-auto px-4 pb-16">
        <div className="bg-white/5 border border-white/10 backdrop-blur-sm rounded-2xl p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-gradient-to-br from-pink to-cyan flex items-center justify-center text-3xl">
            ✓
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight mb-2">
            {en ? "Payment received successfully" : "התשלום התקבל בהצלחה"}
          </h2>
          {summary ? (
            <>
              <p className="text-sm text-gray-300 mb-6">
                {en
                  ? `Thank you ${summary.customerName}! A digital invoice is on its way to your email.`
                  : `תודה ${summary.customerName}! חשבונית דיגיטלית נשלחת אליך לאימייל.`}
              </p>

              <dl className={`grid grid-cols-3 gap-y-3 text-sm border-t border-white/10 pt-5 ${colAlign}`}>
                <dt className={`text-gray-400 col-span-1 ${colAlign}`}>{en ? "Amount" : "סכום"}</dt>
                <dd className={`col-span-2 font-mono ${colAlign}`}>
                  {fmt(summary.paidAmount, summary.locale)} ₪
                </dd>
                <dt className={`text-gray-400 col-span-1 ${colAlign}`}>{en ? "Date" : "תאריך"}</dt>
                <dd className={`col-span-2 ${colAlign}`}>
                  {summary.paidAt
                    ? summary.paidAt.toLocaleString(dateLocale, { dateStyle: "short", timeStyle: "short" })
                    : "—"}
                </dd>
                {summary.invoiceNumber && (
                  <>
                    <dt className={`text-gray-400 col-span-1 ${colAlign}`}>{en ? "Invoice" : "חשבונית"}</dt>
                    <dd className={`col-span-2 font-mono ${colAlign}`}>#{summary.invoiceNumber}</dd>
                  </>
                )}
              </dl>
            </>
          ) : (
            <p className="text-sm text-gray-400 mb-2">
              {en ? "Thank you! An invoice is on its way to your email." : "תודה! חשבונית נשלחת אליך לאימייל."}
            </p>
          )}

          <p className="text-xs text-gray-500 mt-6">
            {en
              ? "If the invoice doesn't arrive within a few minutes, check your spam folder or contact us."
              : "אם החשבונית לא הגיעה תוך מספר דקות, בדוק בתיקיית הספאם או צור קשר."}
          </p>
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
