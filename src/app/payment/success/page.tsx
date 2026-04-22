import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ agreement?: string }>;
}

function BrandShell({ children }: { children: React.ReactNode }) {
  return (
    <div dir="rtl" className="min-h-screen bg-black text-white">
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

const fmt = (n: number | null) =>
  n != null ? n.toLocaleString("he-IL", { maximumFractionDigits: 0 }) : "—";

export default async function PaymentSuccessPage({ searchParams }: Props) {
  const { agreement: agreementId } = await searchParams;

  let summary: {
    customerName: string;
    paidAmount: number | null;
    paidAt: Date | null;
    invoiceNumber: string | null;
  } | null = null;

  if (agreementId) {
    const a = await prisma.agreement.findUnique({
      where: { id: agreementId },
      select: { customerName: true, paidAmount: true, paidAt: true, invoiceNumber: true },
    });
    if (a) summary = a;
  }

  return (
    <BrandShell>
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
          <h2 className="text-2xl font-extrabold tracking-tight mb-2">התשלום התקבל בהצלחה</h2>
          {summary ? (
            <>
              <p className="text-sm text-gray-300 mb-6">
                תודה {summary.customerName}! חשבונית דיגיטלית נשלחת אליך לאימייל.
              </p>

              <dl className="grid grid-cols-3 gap-y-3 text-sm border-t border-white/10 pt-5">
                <dt className="text-gray-400 col-span-1 text-right">סכום</dt>
                <dd className="col-span-2 text-right font-mono">
                  {fmt(summary.paidAmount)} ₪
                </dd>
                <dt className="text-gray-400 col-span-1 text-right">תאריך</dt>
                <dd className="col-span-2 text-right">
                  {summary.paidAt
                    ? summary.paidAt.toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" })
                    : "—"}
                </dd>
                {summary.invoiceNumber && (
                  <>
                    <dt className="text-gray-400 col-span-1 text-right">חשבונית</dt>
                    <dd className="col-span-2 text-right font-mono">#{summary.invoiceNumber}</dd>
                  </>
                )}
              </dl>
            </>
          ) : (
            <p className="text-sm text-gray-400 mb-2">תודה! חשבונית נשלחת אליך לאימייל.</p>
          )}

          <p className="text-xs text-gray-500 mt-6">
            אם החשבונית לא הגיעה תוך מספר דקות, בדוק בתיקיית הספאם או צור קשר.
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
