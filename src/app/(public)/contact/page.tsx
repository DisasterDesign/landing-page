import type { Metadata } from "next";
import ScrollReveal from "@/components/animations/ScrollReveal";
import Card from "@/components/ui/Card";
import Contact from "@/components/sections/Contact";
import { SITE_NAME, SITE_URL, WHATSAPP_NUMBER, ADDRESS_FULL } from "@/lib/constants";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";
import TrackedContactLink from "@/components/shared/TrackedContactLink";

export const metadata: Metadata = {
  title: "צור קשר",
  description:
    "צרו איתנו קשר לקבלת הצעת מחיר, ייעוץ ראשוני חינם או כל שאלה. Fuzion Webz — יצירת קשר מהירה ונוחה.",
  alternates: {
    canonical: `${SITE_URL}/contact`,
  },
  openGraph: {
    title: `צור קשר | ${SITE_NAME}`,
    description: "צרו איתנו קשר לקבלת הצעת מחיר או ייעוץ ראשוני.",
  },
};

const CONTACT_INFO = [
  {
    title: "אימייל",
    method: "email",
    value: "hello@fuzionwebz.com",
    href: "mailto:hello@fuzionwebz.com",
    icon: (
      <svg viewBox="0 0 24 24" className="w-8 h-8 fill-none stroke-current stroke-2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="M22 4L12 13L2 4" />
      </svg>
    ),
  },
  {
    title: "טלפון",
    method: "phone",
    value: "054-713-6666",
    href: "tel:+972547136666",
    icon: (
      <svg viewBox="0 0 24 24" className="w-8 h-8 fill-none stroke-current stroke-2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
      </svg>
    ),
  },
  {
    title: "וואטסאפ",
    method: "whatsapp",
    value: "054-713-6666",
    href: `https://wa.me/${WHATSAPP_NUMBER}`,
    icon: (
      <svg viewBox="0 0 24 24" className="w-8 h-8 fill-current">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    ),
  },
];

export default function ContactPage() {
  return (
    <>
    <BreadcrumbJsonLd items={[
      { name: "דף הבית", url: SITE_URL },
      { name: "צור קשר", url: `${SITE_URL}/contact` },
    ]} />
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="pt-24 md:pt-32 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <ScrollReveal>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold mb-6">
              צור <span className="text-pink">קשר</span>
            </h1>
          </ScrollReveal>
          <ScrollReveal delay={0.2}>
            <p className="text-gray-700 text-lg md:text-xl max-w-2xl mx-auto">
              רוצים לשמוע עוד? יש לכם רעיון לפרויקט? נשמח לשמוע מכם ולעזור
              להפוך את החזון שלכם למציאות.
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* Contact Info Cards */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {CONTACT_INFO.map((info, i) => (
              <ScrollReveal key={info.title} delay={i * 0.1}>
                <TrackedContactLink
                  href={info.href}
                  method={info.method}
                  location="contact_page"
                  external={info.title === "וואטסאפ"}
                >
                  <Card glowColor={i % 2 === 0 ? "pink" : "cyan"} className="text-center py-8">
                    <div className="text-cyan mb-4 flex justify-center">
                      {info.icon}
                    </div>
                    <h3 className="text-lg font-bold text-black mb-2">
                      {info.title}
                    </h3>
                    <p className="text-gray-700">{info.value}</p>
                  </Card>
                </TrackedContactLink>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Form */}
      <Contact />

      {/* Map */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <ScrollReveal>
            <p className="text-gray-700 text-lg mb-4 text-center">{ADDRESS_FULL}</p>
            <div className="w-full h-80 rounded-2xl overflow-hidden border border-gray-200">
              <iframe
                title={`מפה — ${ADDRESS_FULL}`}
                src={`https://www.google.com/maps?q=${encodeURIComponent(ADDRESS_FULL)}&output=embed&hl=iw`}
                className="w-full h-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
          </ScrollReveal>
        </div>
      </section>
    </div>
    </>
  );
}
