import type { Metadata } from "next";
import ScrollReveal from "@/components/animations/ScrollReveal";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";

export const metadata: Metadata = {
  title: "תנאי שימוש",
  description: `תנאי השימוש של ${SITE_NAME}. קראו את התנאים, ההגבלות ותנאי האחריות לפני השימוש באתר ובשירותים שלנו.`,
  alternates: {
    canonical: `${SITE_URL}/terms`,
  },
  openGraph: {
    title: `תנאי שימוש | ${SITE_NAME}`,
    description: `תנאי השימוש של ${SITE_NAME}.`,
  },
};

export default function TermsPage() {
  return (
    <>
    <BreadcrumbJsonLd items={[
      { name: "דף הבית", url: SITE_URL },
      { name: "תנאי שימוש", url: `${SITE_URL}/terms` },
    ]} />
    <div className="min-h-screen bg-black">
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-3xl mx-auto">
          <ScrollReveal>
            <h1 className="text-5xl md:text-7xl font-extrabold text-center mb-16">
              תנאי <span className="text-pink">שימוש</span>
            </h1>
          </ScrollReveal>

          <ScrollReveal delay={0.2}>
            <div className="prose-invert space-y-8 text-gray-400 leading-relaxed">
              <div>
                <h2 className="text-xl font-bold text-white mb-3">1. כללי</h2>
                <p>
                  ברוכים הבאים לאתר של Fuzion Webz (להלן: &quot;האתר&quot;).
                  השימוש באתר ובשירותים המוצעים בו כפוף לתנאי שימוש אלה. עצם
                  השימוש באתר מהווה הסכמה לתנאים אלה. אם אינך מסכים לתנאים,
                  אנא הימנע משימוש באתר.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-white mb-3">
                  2. השירותים
                </h2>
                <p>
                  Fuzion Webz מספקת שירותי עיצוב ופיתוח אתרים, תחזוקה שוטפת,
                  קידום אורגני ושירותים דיגיטליים נוספים. תיאור השירותים באתר הוא
                  כללי ואינו מהווה הצעה מחייבת. התנאים המדויקים של כל פרויקט
                  ייקבעו בהסכם נפרד בין הצדדים.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-white mb-3">
                  3. קניין רוחני
                </h2>
                <p>
                  כל התכנים באתר, לרבות טקסטים, עיצובים, תמונות, לוגו, קוד
                  ותוכנה, הם רכושה הבלעדי של Fuzion Webz או של צדדים שלישיים
                  שהעניקו לנו רישיון שימוש. אין להעתיק, לשכפל, להפיץ או לעשות
                  שימוש מסחרי בתכנים ללא אישור בכתב מראש.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-white mb-3">
                  4. הגבלת אחריות
                </h2>
                <p>
                  האתר והשירותים מסופקים &quot;כמו שהם&quot; (AS IS). Fuzion Webz
                  אינה מתחייבת שהאתר יפעל ללא תקלות או הפרעות. החברה לא תהיה
                  אחראית לנזקים ישירים או עקיפים הנובעים משימוש באתר או מהסתמכות
                  על המידע המוצג בו.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-white mb-3">
                  5. תשלומים וביטולים
                </h2>
                <p>
                  מחירי השירותים המוצגים באתר הם לצורך התרשמות כללית בלבד ועשויים
                  להשתנות. התשלום בפועל ייקבע בהסכם ההתקשרות. מדיניות ביטולים
                  תפורט בהסכם הספציפי לכל פרויקט, בהתאם להוראות חוק הגנת הצרכן.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-white mb-3">
                  6. פרטיות
                </h2>
                <p>
                  איסוף ושימוש במידע אישי כפופים למדיניות הפרטיות שלנו, המהווה
                  חלק בלתי נפרד מתנאי שימוש אלה. אנא קראו את מדיניות הפרטיות
                  שלנו בעמוד הייעודי.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-white mb-3">
                  7. שינויים בתנאים
                </h2>
                <p>
                  Fuzion Webz שומרת לעצמה את הזכות לעדכן ולשנות תנאים אלה מעת
                  לעת. שינויים ייכנסו לתוקף עם פרסומם באתר. המשך השימוש באתר
                  לאחר השינוי מהווה הסכמה לתנאים המעודכנים.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-white mb-3">
                  8. דין חל וסמכות שיפוט
                </h2>
                <p>
                  תנאי שימוש אלה כפופים לדין הישראלי. סמכות השיפוט הבלעדית
                  בכל עניין הנוגע לתנאים אלה נתונה לבתי המשפט המוסמכים בישראל.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-white mb-3">
                  9. יצירת קשר
                </h2>
                <p>
                  לכל שאלה או בירור בנוגע לתנאי שימוש אלה, ניתן ליצור איתנו
                  קשר בכתובת:{" "}
                  <a
                    href="mailto:hello@fuzionwebz.com"
                    className="text-pink hover:text-cyan transition-colors"
                  >
                    hello@fuzionwebz.com
                  </a>
                </p>
              </div>

              <p className="text-gray-500 text-sm mt-12">
                עדכון אחרון: מרץ 2026
              </p>
            </div>
          </ScrollReveal>
        </div>
      </section>
    </div>
    </>
  );
}
