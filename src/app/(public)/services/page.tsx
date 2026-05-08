import type { Metadata } from "next";
import Link from "next/link";
import ScrollReveal from "@/components/animations/ScrollReveal";
import Card from "@/components/ui/Card";
import { SERVICES, SITE_NAME, SITE_URL } from "@/lib/constants";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";

export const metadata: Metadata = {
  title: "שירותים — בניית אתרים ופתרונות דיגיטל",
  description:
    "Fuzion Webz בונים אתרי תדמית, חנויות אונליין, אתרי תלת מימד, דפי נחיתה ופתרונות מותאמים. גלו את כל השירותים שאנחנו מציעים — עם דוגמאות, יכולות ומחירים.",
  alternates: {
    canonical: `${SITE_URL}/services`,
  },
  openGraph: {
    title: `שירותים | ${SITE_NAME}`,
    description:
      "בניית אתרים, חנויות אונליין, אתרי תלת מימד, דפי נחיתה ופתרונות ווב מותאמים.",
    url: `${SITE_URL}/services`,
  },
};

const icons: Record<string, React.ReactNode> = {
  globe: (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  briefcase: (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    </svg>
  ),
  "shopping-cart": (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  ),
  cube: (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12" />
    </svg>
  ),
  rocket: (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  ),
  settings: (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
};

interface ServiceDetail {
  longDescription: string;
  features: string[];
}

const SERVICE_DETAILS: Record<string, ServiceDetail> = {
  website: {
    longDescription:
      "בניית אתרים מודרניים על Next.js עם עיצוב responsive, ביצועים מהירים, SEO מובנה ואנימציות חלקות. מתאים לעסקים שרוצים נוכחות דיגיטלית מקצועית שמרשימה כבר בשנייה הראשונה.",
    features: [
      "עיצוב responsive בכל המכשירים",
      "מהירות טעינה מתחת ל-2 שניות",
      "SEO טכני מובנה (sitemap, structured data, OG)",
      "אנימציות חלקות מותאמות למיתוג",
      "תמיכה מלאה ב-RTL וב-LTR",
    ],
  },
  business: {
    longDescription:
      "אתר תדמיתי-עסקי שמייצג את המותג, כולל עמודי שירות, טפסי יצירת קשר, אינטגרציה עם Google Analytics ו-Search Console ואופטימיזציה להמרות מהיום הראשון.",
    features: [
      "עמוד מותאם לכל שירות / מוצר",
      "טופס לידים מתקדם עם הגנת ספאם",
      "חיבור Google Analytics ו-Search Console",
      "שילוב WhatsApp וצ׳אט חי",
      "מבנה SEO מותאם לתחום העסק",
    ],
  },
  ecommerce: {
    longDescription:
      "חנות אונליין מלאה עם קטלוג מוצרים, עגלת קניות, סליקה מאובטחת (Cardcom / Stripe / PayPal), ניהול מלאי בזמן אמת ודשבורד ניהול הזמנות ולקוחות.",
    features: [
      "קטלוג מוצרים עם פילטרים וחיפוש",
      "עגלה וצ׳קאאוט מותאמים להמרה",
      "סליקה מאובטחת ב-Cardcom / Stripe / PayPal",
      "ניהול מלאי והתראות אוטומטיות",
      "דשבורד הזמנות, לקוחות וקופונים",
    ],
  },
  "3d-website": {
    longDescription:
      "חוויית גלישה ייחודית עם Three.js — אנימציות 3D אינטראקטיביות, אפקטים ויזואליים מרשימים ומודלים תלת-ממדיים שמבדלים את המותג מהמתחרים.",
    features: [
      "מודלים תלת-ממדיים אינטראקטיביים",
      "אנימציות מבוססות גלילה (scroll-driven)",
      "חוויית WebGL מתקדמת ב-React Three Fiber",
      "ביצועים מותאמים גם למובייל",
      "אפקטים תפורים למיתוג ולקמפיין",
    ],
  },
  landing: {
    longDescription:
      "דף נחיתה ממוקד עם מסר שיווקי חד, עיצוב ממיר ו-A/B testing מובנה. מותאם לקמפיינים ממומנים בפייסבוק, אינסטגרם ו-Google Ads, ולהשקות מוצר.",
    features: [
      "עיצוב ממוקד לקריאה לפעולה (CTA)",
      "טופס לידים אופטימלי עם honeypot",
      "מהירות טעינה גבוהה במיוחד",
      "טרקינג קונברז'נים ו-A/B testing",
      "תאימות מלאה למודעות פייסבוק / Google Ads",
    ],
  },
  custom: {
    longDescription:
      "מערכות ווב מורכבות לצרכים ייחודיים — דשבורדים אדמיניסטרטיביים, CRM, אוטומציות, אינטגרציות עם API חיצוניים ומערכות ניהול תוכן מותאמות לעסק.",
    features: [
      "דשבורדים אדמיניסטרטיביים מותאמים",
      "אינטגרציות עם API חיצוניים",
      "אוטומציות וזרימות עבודה (workflows)",
      "מערכות הזדהות והרשאות (RBAC)",
      "תכנון ארכיטקטוני מותאם להיקף הצמיחה",
    ],
  },
};

export default function ServicesPage() {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "דף הבית", url: SITE_URL },
          { name: "שירותים", url: `${SITE_URL}/services` },
        ]}
      />
      <div className="min-h-screen bg-white">
        {/* Hero */}
        <section className="py-24 md:py-32 px-6">
          <div className="max-w-5xl mx-auto text-center">
            <ScrollReveal>
              <h1 className="text-5xl md:text-7xl lg:text-8xl font-extrabold mb-6">
                השירותים <span className="text-pink">שלנו</span>
              </h1>
            </ScrollReveal>
            <ScrollReveal delay={0.2}>
              <p className="text-gray-700 text-lg md:text-xl leading-relaxed max-w-3xl mx-auto">
                מאתרי תדמית מינימליסטיים ועד מערכות ווב מורכבות עם אינטגרציות —
                Fuzion Webz בונה את הפתרון הדיגיטלי שמתאים בדיוק לעסק שלך.
                בחר את התחום שמעניין אותך ונבנה לך משהו ייחודי.
              </p>
            </ScrollReveal>
          </div>
        </section>

        {/* Services grid */}
        <section className="py-12 md:py-20 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
              {SERVICES.map((service, i) => {
                const detail = SERVICE_DETAILS[service.id];
                const accentColor: "pink" | "cyan" = i % 2 === 0 ? "pink" : "cyan";
                return (
                  <ScrollReveal key={service.id} delay={(i % 3) * 0.1}>
                    <Card glowColor={accentColor} className="h-full flex flex-col">
                      <div
                        className={`mb-5 ${accentColor === "pink" ? "text-pink" : "text-cyan-dark"}`}
                      >
                        {icons[service.icon]}
                      </div>
                      <h2 className="text-2xl font-extrabold text-black mb-3">
                        {service.title}
                      </h2>
                      <p className="text-gray-700 leading-relaxed text-[15px] mb-5">
                        {detail?.longDescription ?? service.description}
                      </p>
                      {detail?.features && (
                        <ul className="space-y-2 mt-auto">
                          {detail.features.map((feature, j) => (
                            <li
                              key={j}
                              className="flex items-start gap-2 text-sm text-gray-700"
                            >
                              <span
                                className={`shrink-0 mt-0.5 ${
                                  accentColor === "pink" ? "text-pink" : "text-cyan-dark"
                                }`}
                                aria-hidden="true"
                              >
                                ✓
                              </span>
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </Card>
                  </ScrollReveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 md:py-28 px-6">
          <div className="max-w-3xl mx-auto text-center">
            <ScrollReveal>
              <h2 className="text-3xl md:text-5xl font-extrabold mb-5">
                מוכנים <span className="text-cyan-dark">להתחיל?</span>
              </h2>
            </ScrollReveal>
            <ScrollReveal delay={0.15}>
              <p className="text-gray-700 text-lg leading-relaxed mb-10">
                ספרו לנו מה אתם רוצים להשיג ונחזור אליכם תוך 24 שעות עם הצעה
                מותאמת. אין מחויבות, רק שיחה טובה על מה שאפשר לבנות.
              </p>
            </ScrollReveal>
            <ScrollReveal delay={0.3}>
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-3 bg-pink text-white px-8 py-4 rounded-full font-bold text-base hover:bg-pink-light hover:shadow-[0_0_30px_rgba(229,3,162,0.4)] transition-all duration-300"
                  data-cursor="pointer"
                >
                  בואו נדבר
                  <span aria-hidden="true">←</span>
                </Link>
                <Link
                  href="/portfolio"
                  className="inline-flex items-center gap-3 border-2 border-black text-black px-8 py-4 rounded-full font-bold text-base hover:border-pink hover:text-pink transition-all duration-300"
                  data-cursor="pointer"
                >
                  לראות עבודות
                </Link>
              </div>
            </ScrollReveal>
          </div>
        </section>
      </div>
    </>
  );
}
