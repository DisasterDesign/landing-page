import type { Metadata } from "next";
import ScrollReveal from "@/components/animations/ScrollReveal";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { BreadcrumbJsonLd } from "@/components/seo/JsonLd";

export const metadata: Metadata = {
  title: "מדיניות פרטיות",
  description: `מדיניות הפרטיות של ${SITE_NAME}. למדו כיצד אנו אוספים, משתמשים ומגנים על המידע האישי שלכם — פרטיות, GDPR ומידע.`,
  alternates: {
    canonical: `${SITE_URL}/privacy`,
  },
  openGraph: {
    title: `מדיניות פרטיות | ${SITE_NAME}`,
    description: `מדיניות הפרטיות של ${SITE_NAME}.`,
  },
};

export default function PrivacyPage() {
  return (
    <>
    <BreadcrumbJsonLd items={[
      { name: "דף הבית", url: SITE_URL },
      { name: "מדיניות פרטיות", url: `${SITE_URL}/privacy` },
    ]} />
    <div className="min-h-screen bg-black">
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-3xl mx-auto">
          <ScrollReveal>
            <h1 className="text-5xl md:text-7xl font-extrabold text-center mb-16">
              מדיניות <span className="text-pink">פרטיות</span>
            </h1>
          </ScrollReveal>

          <ScrollReveal delay={0.2}>
            <div className="prose-invert space-y-8 text-gray-400 leading-relaxed">
              <div>
                <h2 className="text-xl font-bold text-white mb-3">1. כללי</h2>
                <p>
                  Fuzion Webz (להלן: &quot;החברה&quot;) מכבדת את פרטיותם של
                  המשתמשים באתר. מדיניות פרטיות זו מסבירה כיצד אנו אוספים,
                  משתמשים ומגנים על המידע האישי שלכם, בהתאם להוראות חוק הגנת
                  הפרטיות, תשמ&quot;א-1981 ותקנותיו.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-white mb-3">
                  2. איסוף מידע
                </h2>
                <p>אנו אוספים מידע בשני אופנים:</p>
                <ul className="list-disc list-inside space-y-2 mt-2">
                  <li>
                    <strong className="text-white">מידע שנמסר באופן פעיל:</strong>{" "}
                    שם, כתובת דוא&quot;ל, מספר טלפון ותוכן הפנייה בעת מילוי טופס
                    יצירת קשר.
                  </li>
                  <li>
                    <strong className="text-white">מידע שנאסף באופן אוטומטי:</strong>{" "}
                    כתובת IP, סוג דפדפן, מערכת הפעלה, עמודים שנצפו, זמן שהייה
                    ומקור ההפניה, באמצעות כלים כגון Google Analytics ועוגיות.
                  </li>
                </ul>
              </div>

              <div>
                <h2 className="text-xl font-bold text-white mb-3">
                  3. שימוש במידע
                </h2>
                <p>המידע שנאסף משמש למטרות הבאות:</p>
                <ul className="list-disc list-inside space-y-2 mt-2">
                  <li>מענה לפניות ובקשות</li>
                  <li>שיפור השירותים והאתר</li>
                  <li>ניתוח סטטיסטי של השימוש באתר</li>
                  <li>שליחת עדכונים ותוכן שיווקי (בכפוף להסכמתכם)</li>
                  <li>עמידה בדרישות חוק ורגולציה</li>
                </ul>
              </div>

              <div>
                <h2 className="text-xl font-bold text-white mb-3">
                  4. עוגיות (Cookies)
                </h2>
                <p>
                  האתר משתמש בעוגיות כדי לשפר את חוויית הגלישה. עוגיות הן קבצים
                  קטנים שנשמרים במכשירכם ומאפשרים לנו לזהות העדפות ולנתח את
                  השימוש באתר. ניתן לנהל את הגדרות העוגיות דרך הדפדפן שלכם.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-white mb-3">
                  5. שיתוף מידע עם צדדים שלישיים
                </h2>
                <p>
                  איננו מוכרים או משכירים מידע אישי לצדדים שלישיים. ייתכן
                  שנשתף מידע עם ספקי שירות הפועלים מטעמנו (כגון שירותי אחסון,
                  אנליטיקה), אשר מחויבים לשמור על סודיות המידע.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-white mb-3">
                  6. אבטחת מידע
                </h2>
                <p>
                  אנו נוקטים באמצעי אבטחה סבירים כדי להגן על המידע האישי
                  שלכם מפני גישה בלתי מורשית, שימוש לרעה, אובדן או שינוי. עם
                  זאת, אין אנו יכולים להבטיח אבטחה מוחלטת של מידע המועבר
                  באינטרנט.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-white mb-3">
                  7. זכויות המשתמש
                </h2>
                <p>
                  בהתאם לחוק הגנת הפרטיות, אתם זכאים לעיין במידע הנוגע אליכם
                  המוחזק במאגרינו, לבקש תיקון מידע שגוי או מחיקת מידע שאינו
                  נדרש עוד. לכל בקשה, פנו אלינו בכתובת הדוא&quot;ל שלהלן.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-white mb-3">
                  8. שינויים במדיניות
                </h2>
                <p>
                  אנו עשויים לעדכן מדיניות זו מעת לעת. שינויים מהותיים יפורסמו
                  באתר. המשך השימוש באתר לאחר העדכון מהווה הסכמה למדיניות
                  המעודכנת.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-bold text-white mb-3">
                  9. יצירת קשר
                </h2>
                <p>
                  לכל שאלה או בקשה בנוגע למדיניות הפרטיות, ניתן לפנות אלינו
                  בכתובת:{" "}
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
