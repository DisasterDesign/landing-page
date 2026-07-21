import Link from "next/link";
import DocumentLocale from "@/components/util/DocumentLocale";

/**
 * Not-found boundary for contract links specifically.
 *
 * The root 404 is Hebrew-only, and this is the one error page a FOREIGN client
 * is likely to reach — a mail client wrapped the link, the token was
 * regenerated on a re-send, or the URL was retyped. At that point the agreement
 * row does not resolve, so there is no locale to read: the copy is bilingual by
 * necessity, English first since a Hebrew reader understands the situation from
 * either half.
 */
export default function AgreementNotFound() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-6">
      {/* generateMetadata does not reach a notFound() render in production, so
          the tab would otherwise show the Hebrew site title. */}
      <DocumentLocale lang="en" dir="ltr" title="Agreement link not valid | Fuzion Webz" />
      <div className="text-center max-w-lg">
        <h1 className="text-[7rem] md:text-[11rem] font-extrabold leading-none select-none">
          <span className="text-pink">O</span>
          <span className="text-cyan">O</span>
          <span className="text-pink">P</span>
          <span className="text-cyan">S</span>
        </h1>

        <div dir="ltr" className="mt-4">
          <p className="text-2xl font-bold text-white mb-3">
            This agreement link is no longer valid
          </p>
          <p className="text-gray-400 mb-2">
            The link may have been shortened by your email client, or a newer one
            was sent. Please use the most recent link, or contact us and we will
            send a fresh one.
          </p>
        </div>

        <div dir="rtl" className="mt-8 pt-6 border-t border-white/10">
          <p className="text-lg font-bold text-white mb-2">קישור ההסכם אינו תקף</p>
          <p className="text-gray-400 text-sm">
            ייתכן שהקישור נחתך בתוכנת הדואר או שנשלח קישור חדש יותר. אנא השתמשו
            בקישור העדכני או פנו אלינו ונשלח קישור חדש.
          </p>
        </div>

        {/* Plain type, not the brand <Button> — its display font mangles Latin
            letterforms ("Contact" reads as "Cohtqct"), which is fine for Hebrew
            marketing pages but not for a foreign client who needs to act. */}
        <div className="mt-8 flex flex-col sm:flex-row gap-4 items-center justify-center">
          <Link
            href="/contact"
            className="font-sans px-8 py-3.5 rounded-full bg-pink text-white font-bold hover:bg-pink/85 transition-colors"
          >
            Contact us · צור קשר
          </Link>
          <Link
            href="/"
            className="font-sans text-sm text-gray-400 hover:text-white transition-colors"
          >
            fuzionwebz.com →
          </Link>
        </div>
      </div>
    </div>
  );
}
